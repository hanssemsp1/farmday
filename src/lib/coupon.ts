import { supabase } from './supabaseClient'
import { FIRST_ORDER_COUPON } from '../../supabase/functions/_shared/pricing'

export { FIRST_ORDER_COUPON }

export interface FirstOrderCouponState {
  /** 결제 완료 주문이 0건 → 첫 구매 쿠폰을 쓸 수 있다 */
  available: boolean
  /** 첫 구매 쿠폰으로 할인받은 결제 완료 주문이 있다 */
  used: boolean
  usedAt: string | null
  /** 서버에 쿠폰 칸이 아직 없거나 읽기 실패 → 쿠폰을 보여주지 않는다 */
  unknown: boolean
}

const UNKNOWN: FirstOrderCouponState = { available: false, used: false, usedAt: null, unknown: true }

/** 로그인 사용자의 첫 구매 쿠폰 상태. 최종 판정은 결제 승인 서버가 다시 한다. */
export async function fetchFirstOrderCoupon(userId: string | undefined): Promise<FirstOrderCouponState> {
  if (!userId) return UNKNOWN
  const { data, error } = await supabase
    .from('orders')
    .select('paid_at,coupon_amount')
    .eq('user_id', userId)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: true })
  if (error) return UNKNOWN
  const paid = data ?? []
  const usedRow = paid.find((o) => (o.coupon_amount ?? 0) > 0)
  return { available: paid.length === 0, used: !!usedRow, usedAt: usedRow?.paid_at ?? null, unknown: false }
}

export interface ConfirmResult {
  ok: boolean
  code?: string
  message?: string
  total?: number
  subtotal?: number
  shipping?: number
  coupon?: number
  already?: boolean
  /** 비회원 주문이면 손님에게 보여 줄 주문번호(FD-…) */
  orderNo?: string
}

/** 결제 승인 요청 — 서버가 금액을 다시 계산해 맞을 때만 토스에 승인한다 */
export async function confirmPayment(paymentKey: string, orderId: string, amount: number, guestToken = ''): Promise<ConfirmResult> {
  const { data, error } = await supabase.functions.invoke('toss-confirm', { body: { paymentKey, orderId, amount, ...(guestToken ? { guestToken } : {}) } })
  if (data && typeof data === 'object') return data as ConfirmResult
  // 4xx/5xx 응답이면 본문이 error.context 에 들어 있다
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try {
      return (await ctx.json()) as ConfirmResult
    } catch {
      /* 본문 없음 */
    }
  }
  return { ok: false, code: 'NETWORK', message: error?.message ?? '결제 승인 서버에 연결하지 못했어요.' }
}
