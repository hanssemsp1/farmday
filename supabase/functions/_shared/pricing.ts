// 금액 규칙 한 곳 — 장바구니(브라우저)와 결제 승인(Edge Function)이 같은 계산을 쓴다.
// 이 파일은 Deno·브라우저 양쪽에서 돌아야 하므로 아무것도 import 하지 않는다.

// 팜데이는 모든 상품 무료배송 (대표님 확정 2026-10-12) — 배송비는 상품 가격에 들어 있다
export const SHIPPING_FEE = 0
export const FIRST_ORDER_COUPON = {
  title: '첫 구매 할인 쿠폰',
  amount: 3000, // 정액 할인
  minSubtotal: 30000, // 상품금액(할인 전) 기준
} as const

export interface Totals {
  subtotal: number
  shipping: number
  coupon: number
  total: number
  /** 첫 구매인데 상품금액이 모자라 쿠폰을 못 쓸 때, 더 담아야 하는 금액 (아니면 0) */
  couponShortBy: number
}

/** 상품금액과 「첫 구매 여부」로 결제금액을 정한다. */
export function computeTotals(subtotal: number, isFirstOrder: boolean, hasItems = subtotal > 0): Totals {
  const shipping = hasItems ? SHIPPING_FEE : 0
  const couponOk = isFirstOrder && subtotal >= FIRST_ORDER_COUPON.minSubtotal
  const coupon = couponOk ? FIRST_ORDER_COUPON.amount : 0
  const couponShortBy =
    isFirstOrder && hasItems && !couponOk ? FIRST_ORDER_COUPON.minSubtotal - subtotal : 0
  return { subtotal, shipping, coupon, total: subtotal + shipping - coupon, couponShortBy }
}
