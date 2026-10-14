import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import { confirmPayment, ConfirmResult, FIRST_ORDER_COUPON } from '../lib/coupon'
import { createNotification } from '../lib/notifications'
import { restoreCartFromOrder } from '../lib/restoreCart'
import { useCart } from '../context/CartContext'
import { forgetGuestToken, guestTokenOf } from '../lib/guestOrder'
import { BUSINESS } from '../config/business'

// 결제(카드 승인)가 됐을 수도 있는 실패 — 토스 승인 요청을 보낸 뒤에 생기거나, 서버 응답을 못 받은 경우.
// 나머지 실패(금액 불일치·품절·배송지 없음·로그인 풀림 등)는 토스 승인 전에 멈춘 것이라 돈이 나가지 않는다
// (토스 결제창에서 인증만 된 결제는 우리 서버가 승인하지 않으면 확정되지 않는다).
const MAY_BE_PAID = new Set(['UNCERTAIN', 'RECORD', 'NETWORK', 'IN_PROGRESS'])
const mayBePaid = (code?: string) => !!code && MAY_BE_PAID.has(code)
import './CheckoutResultPage.css'

// 토스 결제창이 돌려보낸 곳 — 서버(toss-confirm)가 금액을 다시 계산해 승인한 뒤에만 「결제 완료」
export default function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('orderId')
  const paymentKey = searchParams.get('paymentKey')
  const amount = searchParams.get('amount')
  const [result, setResult] = useState<ConfirmResult | null>(null)
  const asked = useRef(false)
  const { addToCart } = useCart()
  // 비회원 결제인지 — 주문할 때 이 탭에 적어 둔 일회용 표가 있으면 비회원 (승인 뒤엔 지우므로 처음 값을 잡아 둔다)
  const [isGuest] = useState(() => !!orderId && !!guestTokenOf(orderId))

  useEffect(() => {
    if (asked.current) return
    asked.current = true
    if (!orderId || !paymentKey || !amount) {
      setResult({ ok: false, code: 'BAD_INPUT', message: '결제 정보가 빠져 있어요.' })
      return
    }
    confirmPayment(paymentKey, orderId, Number(amount), guestTokenOf(orderId)).then(async (r) => {
      setResult(r)
      if (r.ok) forgetGuestToken(orderId)
      // 주문할 때 장바구니에서 뺀 상품을 되돌려 담는다 — 다시 주문할 수 있게.
      // 단 결제가 됐을 수도 있는 경우(연결 끊김·기록 실패·승인 중)에는 되돌리지 않는다 — 두 번 결제하지 않게
      if (!r.ok && !mayBePaid(r.code)) await restoreCartFromOrder(orderId, addToCart)
      if (r.ok && !r.already && !r.orderNo) {
        createNotification(
          '결제가 완료됐어요',
          `${(r.total ?? Number(amount)).toLocaleString()}원 주문이 정상적으로 결제됐어요.`,
          '/mypage/orders',
        )
      }
    })
  }, [orderId, paymentKey, amount])

  if (!result) {
    return (
      <div className="container checkout-result">
        <p className="checkout-result-hint">결제를 승인하는 중이에요. 창을 닫지 말아 주세요...</p>
      </div>
    )
  }

  if (!result.ok && mayBePaid(result.code)) {
    return (
      <div className="container checkout-result">
        <div className="checkout-result-icon fail">!</div>
        <h1>결제 결과를 확인하고 있어요</h1>
        <p className="checkout-result-hint">{result.message ?? '결제가 됐을 수 있어요.'}</p>
        <p className="checkout-result-hint">
          <b>다시 결제하지 마세요.</b> 카드에서 돈이 나갔을 수 있어요. 잠시 뒤 주문내역을 확인하시거나 카카오채널로 알려 주시면 바로 확인해 드려요.
        </p>
        {result.code && <p className="checkout-result-code">오류 코드: {result.code}</p>}
        <div className="checkout-result-actions">
          <Link to={isGuest ? '/guest-orders' : '/mypage/orders'}>
            <Button variant="accent">주문내역 보기</Button>
          </Link>
          <a href={BUSINESS.kakaoChannel} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">카카오채널로 알리기</Button>
          </a>
        </div>
      </div>
    )
  }

  if (!result.ok) {
    return (
      <div className="container checkout-result">
        <div className="checkout-result-icon fail">✕</div>
        <h1>결제가 승인되지 않았어요</h1>
        <p className="checkout-result-hint">{result.message ?? '결제 승인 중 문제가 생겼어요.'}</p>
        <p className="checkout-result-hint">카드 승인은 이뤄지지 않았어요. 상품을 장바구니에 다시 담아 두었어요.</p>
        {result.code && <p className="checkout-result-code">오류 코드: {result.code}</p>}
        <div className="checkout-result-actions">
          <Link to="/cart">
            <Button variant="accent">장바구니로 돌아가기</Button>
          </Link>
          <Link to={isGuest ? '/guest-orders' : '/mypage/orders'}>
            <Button variant="outline">주문내역 보기</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container checkout-result">
      <div className="checkout-result-icon success">
        <Icon name="tag" className="icon-lg" />
      </div>
      <h1>결제가 완료됐어요</h1>
      <p className="checkout-result-amount">{(result.total ?? 0).toLocaleString()}원</p>
      <dl className="checkout-result-breakdown">
        <div>
          <dt>상품금액</dt>
          <dd>{(result.subtotal ?? 0).toLocaleString()}원</dd>
        </div>
        <div>
          <dt>배송비</dt>
          <dd>{result.shipping ? `${result.shipping.toLocaleString()}원` : '무료'}</dd>
        </div>
        {!!result.coupon && (
          <div className="is-coupon">
            <dt>{FIRST_ORDER_COUPON.title}</dt>
            <dd>−{result.coupon.toLocaleString()}원</dd>
          </div>
        )}
      </dl>
      {result.orderNo && (
        <div className="checkout-guest-no">
          <p>비회원 주문번호</p>
          <strong>{result.orderNo}</strong>
          <span>주문 확인·취소 때 이 번호와 휴대폰 번호, 조회 비밀번호가 필요해요. 꼭 적어 두세요.</span>
        </div>
      )}
      <div className="checkout-result-actions">
        <Link to={result.orderNo ? `/guest-orders?no=${result.orderNo}` : '/mypage/orders'}>
          <Button variant="accent">주문내역 보기</Button>
        </Link>
        <Link to="/">
          <Button variant="outline">홈으로</Button>
        </Link>
      </div>
    </div>
  )
}
