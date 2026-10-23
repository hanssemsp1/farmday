// 1:1 문의 — 교환 · 반품 · 배송 · 상품. 브라우저는 표에 직접 쓰지 못하고 여기서만 쓴다.
// 받는 값:
//  · { action: 'create', guest?: { orderNo, phone, password }, orderNo?, kind, buyerName, phone, productName, body, photos?: [{ type, data(base64) }] }
//      회원: 로그인 토큰(Authorization)으로 확인. 비회원: guest 로 주문 확인(틀리면 10분에 5번까지 — _shared/guest.ts)
//  · { action: 'mine', guest? } → 내 문의와 답변(사진 경로는 개수만)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { digits, findGuestOrder, normOrderNo, orderNoOf } from '../_shared/guest.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region', // x-region = 실행 지역 서울 고정
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => reply(status, { ok: false, code, message })
const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

const KINDS = ['교환·반품', '배송', '상품', '기타']
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }
const MAX_PHOTOS = 3
const MAX_BYTES = 5 * 1024 * 1024

function b64ToBytes(b64: string) {
  const bin = atob(b64.replace(/^data:[^,]+,/, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST만 받습니다.')
  // deno-lint-ignore no-explicit-any
  let body: any
  try { body = await req.json() } catch { return fail(400, 'BAD_JSON', '요청 형식이 올바르지 않아요.') }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // 누가 쓰는지 — 비회원 정보가 오면 그 주문으로, 아니면 로그인 토큰으로
  let userId: string | null = null
  let guestOrder: { id: string; buyer_name?: string; buyer_phone?: string } | null = null
  if (body.guest) {
    const r = await findGuestOrder(db, req, body.guest)
    if (!('order' in r)) return fail(r.status, r.code, r.message)
    guestOrder = r.order
  } else {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data } = await asUser.auth.getUser()
    userId = data.user?.id ?? null
    if (!userId) return fail(401, 'LOGIN', '로그인하시거나, 비회원은 주문번호 · 휴대폰 번호 · 조회 비밀번호를 적어 주세요.')
  }

  if (body.action === 'mine') {
    const q = db.from('inquiries').select('id, order_no, kind, product_name, body, photos, status, answer, answered_at, created_at').order('created_at', { ascending: false }).limit(50)
    const { data, error } = guestOrder ? await q.eq('order_id', guestOrder.id) : await q.eq('user_id', userId!)
    if (error) return fail(500, 'DB', '문의를 불러오지 못했어요.')
    return reply(200, { ok: true, inquiries: (data ?? []).map((x) => ({ ...x, photos: (x.photos ?? []).length })) })
  }

  if (body.action !== 'create') return fail(400, 'BAD_INPUT', '요청이 올바르지 않아요.')

  const kind = KINDS.includes(body.kind) ? body.kind : '기타'
  const buyerName = text(body.buyerName, 30)
  const phone = digits(body.phone).slice(0, 11)
  const productName = text(body.productName, 120)
  const msg = text(body.body, 3000)
  if (!buyerName || !/^0\d{9,10}$/.test(phone)) return fail(400, 'BAD_BUYER', '주문하신 분 이름과 연락처를 확인해 주세요.')
  if (msg.length < 5) return fail(400, 'SHORT', '내용을 조금 더 자세히 적어 주세요.')

  // 너무 잦은 글 막기 — 같은 사람(회원 · 주문) 1분에 1건
  const since = new Date(Date.now() - 60_000).toISOString()
  const recent = db.from('inquiries').select('id', { count: 'exact', head: true }).gte('created_at', since)
  const { count } = guestOrder ? await recent.eq('order_id', guestOrder.id) : await recent.eq('user_id', userId!)
  if ((count ?? 0) > 0) return fail(429, 'TOO_FAST', '방금 문의를 남기셨어요. 1분 뒤에 다시 보내 주세요.')

  // 회원이 주문번호를 적었으면 자기 주문인지 확인해서 이어 둔다(남의 주문번호는 글자로만 남긴다)
  let orderId: string | null = guestOrder?.id ?? null
  let orderNo = guestOrder ? orderNoOf(guestOrder.id) : ''
  if (!guestOrder && body.orderNo) {
    const no = normOrderNo(body.orderNo)
    orderNo = no ? 'FD-' + no : ''
    if (no.length === 8) {
      const { data } = await db.from('orders').select('id').eq('user_id', userId!)
      const mine = (data ?? []).find((o: { id: string }) => o.id.slice(0, 8).toUpperCase() === no)
      if (mine) orderId = mine.id
    }
  }

  // 사진 — 최대 3장, 한 장 5MB, 그림 파일만
  const raw = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : []
  const id = crypto.randomUUID()
  const paths: string[] = []
  for (const [i, p] of raw.entries()) {
    const ext = TYPES[String(p?.type ?? '')]
    if (!ext) return fail(400, 'BAD_PHOTO', '사진은 JPG · PNG · WEBP · HEIC 파일만 올릴 수 있어요.')
    const bytes = b64ToBytes(String(p?.data ?? ''))
    if (!bytes.length || bytes.length > MAX_BYTES) return fail(400, 'BIG_PHOTO', '사진은 한 장에 5MB까지 올릴 수 있어요.')
    const path = `${id}/${i + 1}.${ext}`
    const { error } = await db.storage.from('inquiry-photos').upload(path, bytes, { contentType: p.type, upsert: false })
    if (error) { console.error(error); return fail(500, 'UPLOAD', '사진을 올리지 못했어요. 사진 없이 먼저 보내 주셔도 됩니다.') }
    paths.push(path)
  }

  const { error } = await db.from('inquiries').insert({
    id, user_id: userId, order_id: orderId, order_no: orderNo || null, kind,
    buyer_name: buyerName, phone, product_name: productName || null, body: msg, photos: paths,
  })
  if (error) { console.error(error); return fail(500, 'DB', '문의를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.') }
  return reply(200, { ok: true, id })
})
