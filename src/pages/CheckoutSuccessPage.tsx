import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { updateOrderStatus } from '../lib/orders'
import { createNotification } from '../lib/notifications'
import './CheckoutResultPage.css'

export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')
  const [status, setStatus] = useState<'processing' | 'done' | 'error'>('processing')

  useEffect(() => {
    if (!orderId) {
      setStatus('error')
      return
    }
    updateOrderStatus(orderId, '결제완료').then(({ error }) => {
      setStatus(error ? 'error' : 'done')
      if (!error) {
        createNotification(
          '결제가 완료됐어요',
          `${amount ? Number(amount).toLocaleString() + '원 ' : ''}주문이 정상적으로 결제됐어요.`,
          '/mypage/orders',
        )
      }
    })
  }, [orderId, amount])

  return (
    <div className="container checkout-result">
      {status === 'processing' && <p className="checkout-result-hint">결제 결과를 확인하는 중이에요...</p>}

      {status === 'done' && (
        <>
          <div className="checkout-result-icon success">
            <Icon name="tag" className="icon-lg" />
          </div>
          <h1>결제가 완료됐어요</h1>
          {amount && <p className="checkout-result-amount">{Number(amount).toLocaleString()}원</p>}
          <p className="checkout-result-hint">
            결제창 연동까지만 진행된 상태예요. 서버(Edge Function)에서 실제 승인(confirm) API를 호출하는 단계는
            아직 연결되지 않았어요.
          </p>
          <div className="checkout-result-actions">
            <Link to="/mypage/orders">
              <Button variant="accent">주문내역 보기</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">홈으로</Button>
            </Link>
          </div>
        </>
      )}

      {status === 'error' && (
        <>
          <h1>주문 정보를 확인하지 못했어요</h1>
          <p className="checkout-result-hint">주문 상태 업데이트 중 문제가 발생했어요. 주문내역을 확인해주세요.</p>
          <Link to="/mypage/orders">
            <Button variant="outline">주문내역 보기</Button>
          </Link>
        </>
      )}
    </div>
  )
}
