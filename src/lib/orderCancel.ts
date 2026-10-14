import { supabase } from './supabaseClient'
import type { DbOrder } from '../types/order'

export type CancelAction = 'cancel' | 'approve' | 'reject'
export interface CancelResult { ok: boolean; state?: 'canceled' | 'requested' | 'rejected'; message?: string; code?: string }

export const CANCEL_REASONS = ['단순 변심', '주문을 잘못했어요', '배송지를 잘못 적었어요', '다른 상품으로 다시 주문할게요', '기타'] as const

/** 주문 취소 서버(order-cancel)에 요청 — 환불은 서버가 토스로 처리한다 */
export async function cancelOrder(orderId: string, action: CancelAction, reason = '', note = ''): Promise<CancelResult> {
  const { data, error } = await supabase.functions.invoke('order-cancel', { body: { orderId, action, reason, note } })
  if (data && typeof data === 'object') return data as CancelResult
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try { return (await ctx.json()) as CancelResult } catch { /* 본문 없음 */ }
  }
  return { ok: false, code: 'NETWORK', message: error?.message ?? '취소 서버에 연결하지 못했어요.' }
}

/** 손님 화면에 보여 줄 상태와 할 수 있는 일 */
export function cancelView(o: DbOrder): { label: string; tone: 'ok' | 'wait' | 'off'; canCancel: boolean; isRequest: boolean } {
  if (o.status === '취소완료') return { label: '취소완료', tone: 'off', canCancel: false, isRequest: false }
  if (o.cancel_status === '요청') return { label: '취소 요청 중', tone: 'wait', canCancel: false, isRequest: false }
  if (o.status !== '결제완료') return { label: o.status, tone: 'wait', canCancel: false, isRequest: false }
  // 상품이 출발했으면 취소 대신 배송 조회 — 신선식품 단순변심은 받지 않고, 문제가 있으면 문의로
  if (o.delivery_status === '배송완료') return { label: '배송완료', tone: 'ok', canCancel: false, isRequest: false }
  if (o.delivery_status === '배송중' || (o.shipments ?? []).length) return { label: '배송중', tone: 'ok', canCancel: false, isRequest: false }
  const before = (o.supply_status ?? '미발주') === '미발주'
  if (o.cancel_status === '거절') return { label: '배송 준비 중', tone: 'ok', canCancel: false, isRequest: false }
  return { label: before ? '결제완료' : '배송 준비 중', tone: 'ok', canCancel: true, isRequest: !before }
}
