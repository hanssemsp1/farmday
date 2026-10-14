// 주문 취소 — 손님 「취소」「취소 요청」, 관리자 「승인」「거절」을 서버에서 처리한다.
// 받는 값: { orderId, action: 'cancel' | 'approve' | 'reject', reason?, note? }  (Authorization: 로그인 사용자 토큰)
//        비회원: { action: 'cancel', reason?, guest: { orderNo, phone, password } }  (로그인 없이)
//  · 손님 cancel: 발주 전이면 토스 전액 취소 → 취소완료. 발주 후면 「취소 요청」으로 남긴다.
//  · 관리자 approve: 요청 건을 토스 전액 취소 → 취소완료 / reject: 요청 거절(note 를 손님에게 보여 준다)
// 첫 구매 쿠폰은 되살리지 않는다 — paid_at 을 지우지 않으므로 「결제했던 주문」으로 계속 센다.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { findGuestOrder } from '../_shared/guest.ts'

const ADMIN_EMAIL = 'farmday.testuser02@gmail.com'
const PAID = '결제완료'
const CANCELED = '취소완료'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (status: number, code: string, message: string) => reply(status, { ok: false, code, message })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'METHOD', 'POST만 받습니다.')

  const secret = Deno.env.get('TOSS_SECRET_KEY')?.trim()
  if (!secret) return fail(500, 'NO_SECRET', '결제 키가 서버에 설정되지 않았어요.')

  let body: { orderId?: string; action?: string; reason?: string; note?: string; guest?: { orderNo?: string; phone?: string; password?: string } }
  try { body = await req.json() } catch { return fail(400, 'BAD_JSON', '요청 형식이 올바르지 않아요.') }
  const action = String(body.action ?? '')
  const reason = String(body.reason ?? '').slice(0, 100)
  const note = String(body.note ?? '').slice(0, 200)
  if (!['cancel', 'approve', 'reject'].includes(action)) return fail(400, 'BAD_INPUT', '요청이 올바르지 않아요.')

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(url, service, { auth: { persistSession: false } })

  // 비회원 — 주문번호 + 휴대폰 + 조회 비밀번호로 본인 확인(틀리면 횟수 제한). 할 수 있는 건 손님 「취소」뿐
  // deno-lint-ignore no-explicit-any
  let order: any
  let user: { id: string; email?: string } | null = null
  if (body.guest) {
    if (action !== 'cancel') return fail(403, 'ADMIN', '관리자만 할 수 있어요.')
    const r = await findGuestOrder(db, req, body.guest)
    if (!('order' in r)) return fail(r.status, r.code, r.message)
    order = r.order
  } else {
    const orderId = String(body.orderId ?? '')
    if (!orderId) return fail(400, 'BAD_INPUT', '요청이 올바르지 않아요.')
    const asUser = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
    const { data: who } = await asUser.auth.getUser()
    user = who.user
    if (!user) return fail(401, 'LOGIN', '로그인이 필요해요.')
    ;({ data: order } = await db.from('orders').select('*').eq('id', orderId).maybeSingle())
  }
  const isAdmin = !!user && user.email === ADMIN_EMAIL
  if (!order) return fail(404, 'NO_ORDER', '주문을 찾지 못했어요.')
  if (order.status === CANCELED) return reply(200, { ok: true, already: true, state: 'canceled', message: '이미 취소된 주문이에요.' })
  if (order.status !== PAID || !order.paid_at || !order.payment_key) return fail(409, 'NOT_PAID', '결제가 끝난 주문만 취소할 수 있어요.')

  // 토스 전액 취소 → 주문을 취소완료로
  async function tossCancel(why: string) {
    const res = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(secret + ':'), 'Content-Type': 'application/json', 'Idempotency-Key': 'cancel-' + order.id },
      body: JSON.stringify({ cancelReason: why || '고객 요청' }),
    })
    const t = await res.json().catch(() => ({}))
    // 이미 취소된 결제면 토스가 ALREADY_CANCELED_PAYMENT — 우리 기록만 맞춘다
    if (!res.ok && t.code !== 'ALREADY_CANCELED_PAYMENT') return { ok: false as const, code: t.code ?? 'TOSS', message: t.message ?? '결제 취소에 실패했어요.' }
    const { error } = await db.from('orders').update({
      status: CANCELED, cancel_status: '완료', canceled_at: new Date().toISOString(),
      ...(order.supply_status === '미발주' || order.supply_status === '취소중' ? { supply_status: '미발주' } : {}),
      cancel_reason: order.cancel_reason ?? why, cancel_requested_at: order.cancel_requested_at ?? new Date().toISOString(),
    }).eq('id', order.id)
    if (error) return { ok: false as const, code: 'RECORD', message: '환불은 됐지만 주문 기록에 실패했어요. 관리자에게 알려 주세요.' }
    return { ok: true as const }
  }

  if (action === 'cancel') {
    if (!body.guest && order.user_id !== user!.id) return fail(403, 'NOT_YOURS', '본인 주문만 취소할 수 있어요.')
    if (order.cancel_status === '요청') return reply(200, { ok: true, state: 'requested', message: '이미 취소를 요청했어요. 확인 후 알려 드릴게요.' })
    if (order.cancel_status === '거절') return fail(409, 'REJECTED', order.cancel_note || '이미 상품이 출발해 취소할 수 없어요.')
    // 송장이 붙었으면(상품 출발) 취소 대신 문의로 — 신선식품 단순변심 반품 제한(교환·반품 안내에 표시)
    if (order.delivery_status || (Array.isArray(order.shipments) && order.shipments.length)) {
      return fail(409, 'SHIPPED', '이미 상품이 출발해 주문을 취소할 수 없어요. 받으신 상품에 문제가 있으면 카카오채널로 사진과 함께 알려 주세요.')
    }
    // 발주 전이면 바로 취소·환불 — 먼저 「취소중」으로 잡는다(미발주일 때만). 관리자 발주 잠금(lockSupplying)도
    // 「미발주」일 때만 잠그므로, 둘 중 먼저 잡은 쪽만 이긴다 → 환불했는데 산지에 발주되는 일이 없다
    const { data: grabbed } = await db.from('orders').update({ supply_status: '취소중' })
      .eq('id', order.id).eq('supply_status', '미발주').select('id')
    if (grabbed?.length) {
      const r = await tossCancel(reason)
      if (!r.ok) {
        await db.from('orders').update({ supply_status: '미발주' }).eq('id', order.id).eq('supply_status', '취소중')
        return fail(502, r.code, r.message)
      }
      return reply(200, { ok: true, state: 'canceled', message: '주문을 취소했어요. 카드 결제는 카드사에 따라 3~5영업일 안에 취소돼요.' })
    }
    // 같은 취소가 이미 처리 중(두 번 누름)이면 요청으로 남기지 않는다
    const { data: now } = await db.from('orders').select('supply_status').eq('id', order.id).maybeSingle()
    if (now?.supply_status === '취소중') return reply(200, { ok: true, state: 'requested', message: '취소를 처리하고 있어요. 잠시 뒤 주문내역을 확인해 주세요.' })
    // 공급처에 이미 넘어갔으면 요청으로 남긴다
    const { error } = await db.from('orders').update({ cancel_status: '요청', cancel_reason: reason || '고객 요청', cancel_requested_at: new Date().toISOString() }).eq('id', order.id)
    if (error) return fail(500, 'DB', '취소 요청을 남기지 못했어요.')
    return reply(200, { ok: true, state: 'requested', message: '이미 산지에 주문이 넘어가 있어 취소를 요청해 두었어요. 산지에 확인한 뒤 알려 드릴게요.' })
  }

  // 관리자
  if (!isAdmin) return fail(403, 'ADMIN', '관리자만 할 수 있어요.')
  if (action === 'approve') {
    const r = await tossCancel(order.cancel_reason ?? reason ?? '판매자 취소')
    if (!r.ok) return fail(502, r.code, r.message)
    return reply(200, { ok: true, state: 'canceled', message: '취소·환불했어요.' })
  }
  // reject
  const { error } = await db.from('orders').update({ cancel_status: '거절', cancel_note: note || '이미 산지에서 상품이 출발해 취소할 수 없어요.' }).eq('id', order.id)
  if (error) return fail(500, 'DB', '거절을 기록하지 못했어요.')
  return reply(200, { ok: true, state: 'rejected', message: '취소 요청을 거절했어요.' })
})
