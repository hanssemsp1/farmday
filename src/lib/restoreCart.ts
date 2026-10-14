import { fetchOrderById } from './orders'
import { guestItemsOf } from './guestOrder'
import type { CartOption } from '../context/CartContext'

type AddToCart = (productId: string, quantity?: number, option?: CartOption) => void

/** 결제가 안 된 주문의 상품을 장바구니에 되돌려 담는다. 같은 주문은 한 번만(새로고침해도 두 배로 안 담기게). */
export async function restoreCartFromOrder(orderId: string, addToCart: AddToCart) {
  const key = `farmday_restored_${orderId}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    /* 저장소를 못 쓰면 그냥 담는다 */
  }
  const { data: order } = await fetchOrderById(orderId)
  if (order?.paid_at) return
  // 비회원 주문은 브라우저가 읽지 못한다 → 주문할 때 이 탭에 적어 둔 상품으로
  const items = order?.items ?? guestItemsOf(orderId)
  for (const it of items) {
    addToCart(
      it.productId,
      it.quantity,
      it.optionId && it.optionName ? { id: it.optionId, name: it.optionName, price: it.price } : undefined,
    )
  }
}
