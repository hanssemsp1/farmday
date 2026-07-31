import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import './CheckoutResultPage.css'

export default function CheckoutFailPage() {
  const [searchParams] = useSearchParams()
  const message = searchParams.get('message') || '결제가 취소됐거나 처리 중 오류가 발생했어요.'

  return (
    <div className="container checkout-result">
      <div className="checkout-result-icon fail">✕</div>
      <h1>결제에 실패했어요</h1>
      <p className="checkout-result-hint">{message}</p>
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
