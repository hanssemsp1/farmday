// 토스 결제 승인 — 브라우저가 보낸 금액을 믿지 않고 DB 가격으로 다시 계산해 맞을 때만 승인한다.
// 받는 값: { paymentKey, orderId, amount, guestToken? }  (Authorization: 로그인 사용자 토큰 — 비회원은 guestToken)
// 필요한 비밀값: TOSS_SECRET_KEY  (SUPABASE_URL·SUPABASE_ANON_KEY·SUPABASE_SERVICE_ROLE_KEY 는 Supabase가 자동으로 넣어 준다)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { computeTotals } from '../_shared/pricing.ts'
import { remoteAreaOf, REMOTE_AREA_MESSAGE } from '../_shared/remoteArea.ts'
import { orderNoOf, sha256 } from '../_shared/guest.ts'

const PAID = '결제완료'
const PENDING = '결제대기'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return reply(status, { ok: false, code, message, ...extra })
}

interface Item { productId: string; optionId?: string; optionName?: string; quantity: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST만 받습니다.')

  // 대시보드에 붙여 넣을 때 따라 들어간 줄바꿈·공백은 떼어 낸다
  const secret = Deno.env.get('TOSS_SECRET_KEY')?.trim()
  if (!secret) return fail(500, 'NO_SECRET', '결제 승인 키가 서버에 설정되지 않았어요.')

  let body: { paymentKey?: string; orderId?: string; amount?: number | string; guestToken?: string }
  try { body = await req.json() } catch { return fail(400, 'BAD_JSON', '요청 형식이 올바르지 않아요.') }
  const paymentKey = String(body.paymentKey ?? '')
  const orderId = String(body.orderId ?? '')
  const amount = Number(body.amount)
  if (!paymentKey || !orderId || !Number.isFinite(amount)) return fail(400, 'BAD_INPUT', '결제 정보가 빠졌어요.')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // 1) 누가 보냈나 — 회원은 로그인 토큰, 비회원은 주문 만들 때 받은 일회용 표(guestToken)
  const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: who } = await asUser.auth.getUser()
  const userId = who.user?.id
  const guestToken = String(body.guestToken ?? '')
  if (!userId && !guestToken) return fail(401, 'LOGIN', '로그인이 필요해요.')

  const db = createClient(url, service, { auth: { persistSession: false } })

  // 2) 주문 확인
  const { data: order, error: oe } = await db.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (oe || !order) return fail(404, 'NO_ORDER', '주문을 찾지 못했어요.')
  const isGuest = !!order.guest
  if (isGuest) {
    // 표는 결제가 끝나면 지운다 — 그 뒤 새로고침은 같은 결제키일 때만 아래 「이미 결제」로 돌려준다
    const tokenOk = !!guestToken && !!order.guest_token_hash && order.guest_token_hash === await sha256(guestToken)
    if (!tokenOk && !(order.paid_at && order.payment_key === paymentKey)) return fail(403, 'NOT_YOURS', '본인 주문만 결제할 수 있어요.')
  } else if (!userId || order.user_id !== userId) {
    return fail(403, 'NOT_YOURS', '본인 주문만 결제할 수 있어요.')
  }
  if (order.paid_at) {
    // 성공 페이지를 새로고침한 경우 — 같은 결제면 그대로 성공으로 돌려준다
    if (order.payment_key === paymentKey) {
      return reply(200, { ok: true, already: true, orderId, total: order.total_amount, subtotal: order.subtotal, shipping: order.shipping_fee, coupon: order.coupon_amount, ...(order.guest ? { orderNo: orderNoOf(orderId) } : {}) })
    }
    return fail(409, 'ALREADY_PAID', '이미 결제된 주문이에요.')
  }
  if (order.status !== PENDING) return fail(409, 'BAD_STATUS', `결제할 수 없는 주문 상태예요(${order.status}).`)

  // 3) 먼저 이 주문을 「승인 중」으로 잡는다 — payment_key 가 들어가면 지킴이(orders_paid_lock.sql)가
  //    상품·금액·배송지를 브라우저에서 못 바꾸게 막는다. 그다음 다시 읽어서 검사하므로 「검사한 내용 = 결제한 내용」이 된다.
  const { data: claimed, error: claimErr } = await db.from('orders')
    .update({ payment_key: paymentKey })
    .eq('id', orderId).is('payment_key', null).is('paid_at', null).select('id')
  if (claimErr) return fail(500, 'DB', '주문을 잡아 두지 못했어요.')
  if (!claimed?.length) return fail(409, 'IN_PROGRESS', '이 주문은 이미 승인 처리 중이에요. 다시 결제하지 마시고 주문내역을 확인해 주세요.')

  // 승인하지 않고 멈출 때는 잡은 것을 풀어 다시 결제할 수 있게 한다
  const stop = async (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => {
    await db.from('orders').update({ payment_key: null, coupon_amount: 0 }).eq('id', orderId).eq('payment_key', paymentKey).is('paid_at', null)
    return fail(status, code, message, extra)
  }

  const { data: cur } = await db.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (!cur || cur.payment_key !== paymentKey) return fail(409, 'IN_PROGRESS', '이 주문은 이미 승인 처리 중이에요. 다시 결제하지 마시고 주문내역을 확인해 주세요.')

  // 산지 발주에 필요한 배송지가 없으면 결제하지 않는다 — 우편번호 5자리도 반드시(비어 있으면 도서산간 검사를 건너뛰게 되므로)
  if (!cur.recipient_name || !cur.recipient_phone || !cur.address1 || !cur.supply_consent || String(cur.zipcode ?? '').replace(/\D/g, '').length !== 5) {
    return stop(400, 'NO_ADDRESS', '배송지가 빠진 주문이에요. 장바구니에서 배송지를 적고 다시 주문해 주세요.')
  }
  // 제주·도서산간은 주문을 받지 않는다(대표님 26.10.14)
  if (remoteAreaOf(cur.zipcode)) return stop(400, 'REMOTE_AREA', REMOTE_AREA_MESSAGE)

  // 4) DB 가격으로 다시 계산하고, 주문 상품 목록도 DB 값으로 다시 쓴다
  //    (발주 엑셀은 이 목록의 이름·수량을 그대로 쓴다 — 브라우저가 보낸 이름·수량을 믿지 않는다)
  const items = (cur.items ?? []) as Item[]
  if (!items.length) return stop(400, 'EMPTY', '주문에 상품이 없어요.')
  const productIds = [...new Set(items.map((i) => i.productId))]
  const [{ data: products }, { data: options }] = await Promise.all([
    db.from('products').select('id,name,brand,thumbnail,price,sold_out').in('id', productIds),
    db.from('product_options').select('id,product_id,name,price,sold_out').in('product_id', productIds),
  ])
  let subtotal = 0
  const clean: Record<string, unknown>[] = []
  for (const it of items) {
    const qty = Number(it.quantity)
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return stop(400, 'BAD_QTY', '수량이 올바르지 않아요.')
    const p = products?.find((x) => x.id === it.productId)
    if (!p) return stop(409, 'GONE', '판매하지 않는 상품이 들어 있어요. 장바구니를 다시 확인해 주세요.')
    const opts = (options ?? []).filter((o) => o.product_id === p.id)
    let price: number
    let soldOut = !!p.sold_out
    let opt: { id: string; name: string } | null = null
    if (opts.length) {
      // 옵션 id는 관리자가 옵션을 고치면 새로 바뀐다 → id가 없으면 같은 이름 옵션으로 찾는다
      const o = opts.find((x) => x.id === it.optionId) ?? opts.find((x) => it.optionName && x.name === it.optionName)
      if (!o) return stop(409, 'OPTION_GONE', `「${p.name}」 옵션이 바뀌었어요. 장바구니에서 다시 담아 주세요.`)
      price = Number(o.price)
      soldOut = soldOut || !!o.sold_out
      opt = { id: o.id, name: o.name }
    } else {
      price = Number(p.price)
    }
    if (soldOut) return stop(409, 'SOLD_OUT', `「${p.name}」이(가) 품절됐어요.`)
    if (!(Number.isFinite(price) && price > 0)) return stop(409, 'GONE', `「${p.name}」은(는) 지금 가격이 정해져 있지 않아 주문할 수 없어요.`)
    subtotal += price * qty
    clean.push({
      productId: p.id, name: p.name, brand: p.brand ?? (it as { brand?: string }).brand ?? '', price, quantity: qty,
      thumbnail: p.thumbnail ?? (it as { thumbnail?: string }).thumbnail ?? '',
      ...(opt ? { optionId: opt.id, optionName: opt.name } : {}),
    })
  }

  // 5) 첫 구매인가 — 결제 완료(paid_at 있는) 주문이 하나도 없으면 첫 구매. 쿠폰은 회원만(비회원은 늘 쿠폰 없음)
  let firstOrder = false
  if (!isGuest) {
    const { count: paidCount, error: ce } = await db.from('orders').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).not('paid_at', 'is', null)
    if (ce) return stop(500, 'DB', '주문 기록을 확인하지 못했어요.')
    firstOrder = (paidCount ?? 0) === 0
  }
  const t = computeTotals(subtotal, firstOrder)

  if (t.total !== amount) {
    return stop(400, 'AMOUNT_MISMATCH', '결제 금액이 주문 금액과 달라 승인하지 않았어요. 장바구니에서 다시 주문해 주세요.', { expected: t.total, received: amount })
  }

  // 6) 확정한 목록·금액을 적는다 — 쿠폰은 사람당 한 번(유일 색인)이라 동시에 두 주문이 쓰면 여기서 막힌다
  const { error: fixErr } = await db.from('orders')
    .update({ items: clean, subtotal: t.subtotal, shipping_fee: t.shipping, coupon_amount: t.coupon })
    .eq('id', orderId).eq('payment_key', paymentKey).is('paid_at', null)
  if (fixErr) {
    if (fixErr.code === '23505') return stop(409, 'COUPON_USED', '첫 구매 쿠폰을 이미 다른 주문에서 쓰고 있어요. 장바구니에서 다시 주문해 주세요.')
    return stop(500, 'DB', '주문을 잡아 두지 못했어요.')
  }

  // 7) 토스 승인 — 응답이 안 오면(시간 초과·연결 끊김) 결과를 모르는 것이므로 토스에 결제를 조회해 맞춘다
  const auth = 'Basic ' + btoa(secret + ':')
  // deno-lint-ignore no-explicit-any
  let toss: any = null
  let definiteFail: { code: string; message: string } | null = null
  try {
    const res = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', 'Idempotency-Key': paymentKey },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(20_000),
    })
    const b = await res.json().catch(() => ({}))
    if (res.ok) toss = b
    else definiteFail = { code: b.code ?? 'TOSS', message: b.message ?? '카드사 승인에 실패했어요.' }
  } catch {
    try {
      const q = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
        headers: { Authorization: auth }, signal: AbortSignal.timeout(10_000),
      })
      const b = await q.json().catch(() => ({}))
      if (q.ok && b.status === 'DONE') toss = b
    } catch { /* 조회도 안 됨 */ }
    if (!toss) {
      // 잡은 것을 풀지 않는다 — 관리자 화면 「결제 확인 필요」에 남아 대표님이 토스에서 확인한다
      return fail(502, 'UNCERTAIN', '결제 결과를 확인하지 못했어요. 다시 결제하지 마시고 잠시 뒤 주문내역을 보시거나 카카오채널로 알려 주세요.', { paymentKey })
    }
  }
  if (definiteFail) return stop(402, definiteFail.code, definiteFail.message)

  // 8) 토스가 승인한 내용이 우리 주문과 같은지 — 다르면 바로 취소한다
  if (toss.status !== 'DONE' || Number(toss.totalAmount) !== t.total || String(toss.orderId) !== orderId) {
    let undone = false
    try {
      const c = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json', 'Idempotency-Key': 'mismatch-' + paymentKey },
        body: JSON.stringify({ cancelReason: '결제 내용이 주문과 달라 자동 취소' }),
        signal: AbortSignal.timeout(20_000),
      })
      undone = c.ok
    } catch { /* 아래 */ }
    if (!undone) return fail(502, 'UNCERTAIN', '결제 확인 중 문제가 생겼어요. 다시 결제하지 마시고 카카오채널로 알려 주세요.', { paymentKey })
    return stop(402, 'TOSS_MISMATCH', '결제 내용이 주문과 달라 결제를 취소했어요. 장바구니에서 다시 주문해 주세요.')
  }

  const { error: pe } = await db.from('orders')
    .update({ status: PAID, paid_at: toss.approvedAt ?? new Date().toISOString(), total_amount: t.total, ...(isGuest ? { guest_token_hash: null } : {}) })
    .eq('id', orderId)
  if (pe) {
    // 돈은 빠졌는데 기록을 못 한 경우 — 관리자 화면 「결제 확인 필요」에 남는다(payment_key 있고 paid_at 없음)
    return fail(500, 'RECORD', '결제는 됐지만 주문 기록에 실패했어요. 다시 결제하지 마시고 카카오채널로 알려 주세요.', { paymentKey })
  }
  return reply(200, { ok: true, orderId, total: t.total, subtotal: t.subtotal, shipping: t.shipping, coupon: t.coupon, method: toss.method, ...(isGuest ? { orderNo: orderNoOf(orderId) } : {}) })
})
