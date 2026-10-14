// 비회원 주문 — 로그인 없이(anon 키) 부른다. 비회원 주문은 브라우저가 DB에 직접 쓰거나 읽지 못하므로 여기서만 다룬다.
// 받는 값:
//  · { action: 'create', items, ship, email, password, privacyConsent }
//      → 결제대기 주문을 만들고 { orderId, orderNo, token } 을 돌려준다. token 은 결제 확인(toss-confirm)에 한 번 쓰는 표.
//  · { action: 'lookup', orderNo, phone, password }
//      → 그 주문 하나를 돌려준다(비밀번호 해시·결제키 등은 뺌). 틀리면 10분에 5번까지(_shared/guest.ts).
// 첫 구매 쿠폰은 회원만 — 비회원 주문은 쿠폰 없이 계산한다(toss-confirm).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { remoteAreaOf, REMOTE_AREA_MESSAGE } from '../_shared/remoteArea.ts'
import { digits, findGuestOrder, hashPin, newToken, orderNoOf, pinOk, publicOrder, sha256 } from '../_shared/guest.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => reply(status, { ok: false, code, message })

/** 010-1234-5678 모양으로 (공급처 주문서와 같게) */
function dashPhone(v: string) {
  const d = digits(v)
  if (/^02\d{7,8}$/.test(d)) return d.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3')
  if (/^0\d{9,10}$/.test(d)) return d.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3')
  return v.trim()
}
const phoneOk = (v: string) => /^0\d{9,10}$/.test(digits(v))
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST만 받습니다.')
  // deno-lint-ignore no-explicit-any
  let body: any
  try { body = await req.json() } catch { return fail(400, 'BAD_JSON', '요청 형식이 올바르지 않아요.') }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  if (body.action === 'lookup') {
    const r = await findGuestOrder(db, req, body)
    if (!('order' in r)) return fail(r.status, r.code, r.message)
    return reply(200, { ok: true, order: publicOrder(r.order) })
  }

  if (body.action !== 'create') return fail(400, 'BAD_INPUT', '요청이 올바르지 않아요.')

  // 1) 상품 — 표시용 칸만 남긴다. 결제 승인(toss-confirm) 때 DB 이름·가격·옵션으로 다시 써서 저장한다(발주 엑셀은 그 값을 쓴다).
  const raw = Array.isArray(body.items) ? body.items : []
  if (!raw.length || raw.length > 30) return fail(400, 'EMPTY', '주문할 상품을 골라 주세요.')
  const items = raw.map((it: Record<string, unknown>) => ({
    productId: text(it.productId, 80),
    name: text(it.name, 120),
    brand: text(it.brand, 60),
    price: Math.max(0, Math.floor(Number(it.price) || 0)),
    quantity: Number(it.quantity), // 1.9 같은 값은 내리지 않고 거부한다(아래)
    thumbnail: text(it.thumbnail, 500),
    ...(it.optionId ? { optionId: text(it.optionId, 80) } : {}),
    ...(it.optionName ? { optionName: text(it.optionName, 120) } : {}),
  }))
  if (items.some((i: { productId: string; quantity: number }) => !i.productId || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
    return fail(400, 'BAD_QTY', '상품 수량이 올바르지 않아요.')
  }

  // 2) 주문자·배송지 — 브라우저 검사(ShippingForm)와 같은 규칙을 서버에서 다시
  const s = body.ship ?? {}
  const buyerName = text(s.buyerName, 30)
  const recipientName = text(s.recipientName, 30)
  const zipcode = digits(s.zipcode).slice(0, 5)
  const address1 = text(s.address1, 200)
  const address2 = text(s.address2, 100)
  const email = text(body.email, 120)
  const password = String(body.password ?? '')
  if (!buyerName || !phoneOk(s.buyerPhone)) return fail(400, 'BAD_BUYER', '주문하시는 분 이름과 휴대폰 번호를 확인해 주세요.')
  if (!recipientName || !phoneOk(s.recipientPhone)) return fail(400, 'BAD_RECIPIENT', '받는 분 이름과 연락처를 확인해 주세요.')
  if (zipcode.length !== 5 || !address1 || !address2) return fail(400, 'NO_ADDRESS', '「주소 찾기」로 주소를 고르고 상세 주소를 적어 주세요.')
  if (remoteAreaOf(zipcode)) return fail(400, 'REMOTE_AREA', REMOTE_AREA_MESSAGE)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, 'BAD_EMAIL', '이메일 주소를 확인해 주세요.')
  if (!pinOk(password)) return fail(400, 'BAD_PIN', '주문 조회 비밀번호는 숫자 4~6자리로 정해 주세요.')
  if (s.consent !== true || body.privacyConsent !== true) return fail(400, 'NO_CONSENT', '필수 동의 항목에 체크해 주세요.')

  // 3) 주문 만들기 (서버 권한)
  const token = newToken()
  const { data: order, error } = await db.from('orders').insert({
    // 주문번호(FD-앞 8자리)를 남이 짐작하지 못하게 — DB 기본값에 맡기지 않고 무작위 UUID(v4)를 직접 정한다
    id: crypto.randomUUID(),
    user_id: null,
    guest: true,
    guest_phone: digits(s.buyerPhone),
    guest_email: email,
    guest_pw_hash: await hashPin(password),
    guest_token_hash: await sha256(token),
    items,
    total_amount: items.reduce((n: number, i: { price: number; quantity: number }) => n + i.price * i.quantity, 0),
    status: '결제대기',
    buyer_name: buyerName,
    buyer_phone: dashPhone(String(s.buyerPhone)),
    recipient_name: recipientName,
    recipient_phone: dashPhone(String(s.recipientPhone)),
    zipcode,
    address1,
    address2,
    delivery_memo: text(s.memo, 50),
    supply_consent: true,
  }).select('id').single()
  if (error || !order) return fail(500, 'DB', '주문을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.')

  return reply(200, { ok: true, orderId: order.id, orderNo: orderNoOf(order.id), token })
})
