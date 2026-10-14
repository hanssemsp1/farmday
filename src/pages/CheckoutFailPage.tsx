import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useCart } from '../context/CartContext'
import { restoreCartFromOrder } from '../lib/restoreCart'
import './CheckoutResultPage.css'

export default function CheckoutFailPage() {
  const [searchParams] = useSearchParams()
  const message = searchParams.get('message') || '결제가 취소됐거나 처리 중 오류가 발생했어요.'
  const code = searchParams.get('code')
  const orderId = searchParams.get('orderId')
  const { addToCart } = useCart()

  // 결제창에서 취소·실패하면 주문할 때 뺀 상품을 장바구니에 되돌려 담는다
  useEffect(() => {
    if (orderId) restoreCartFromOrder(orderId, addToCart)
    // addToCart 는 렌더마다 새로 만들어지므로 orderId 가 바뀔 때만 돈다
  }, [orderId])

  return (
    <div className="container checkout-result">
      <div className="checkout-result-icon fail">✕</div>
      <h1>결제에 실패했어요</h1>
      <p className="checkout-result-hint">{message}</p>
      {code && <p className="checkout-result-code">오류 코드: {code}</p>}
      {orderId && <p className="checkout-result-hint">담았던 상품은 장바구니에 그대로 있어요.</p>}
      <div className="checkout-result-actions">
        <Link to="/cart">
          <Button variant="accent">장바구니로 돌아가기</Button>
        </Link>
        <Link to="/">
          <Button variant="outline">홈으로</Button>
        </Link>
      </div>
    </div>
  )
}
