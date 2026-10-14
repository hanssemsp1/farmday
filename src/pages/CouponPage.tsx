import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchFirstOrderCoupon, FirstOrderCouponState, FIRST_ORDER_COUPON } from '../lib/coupon'
import './CouponPage.css'

interface Coupon {
  id: string
  title: string
  discount: string
  condition: string
  expiresAt: string
  status: '사용가능' | '사용완료' | '기간만료'
}

// 쿠폰은 지금 「첫 구매 할인」 하나 — 결제 완료 주문이 없으면 사용가능, 쿠폰으로 결제했으면 사용완료
function couponsFor(state: FirstOrderCouponState | null): Coupon[] {
  if (!state || state.unknown) return []
  const base = {
    id: 'first-order',
    title: FIRST_ORDER_COUPON.title,
    discount: `${FIRST_ORDER_COUPON.amount.toLocaleString()}원`,
    condition: `상품금액 ${FIRST_ORDER_COUPON.minSubtotal.toLocaleString()}원 이상 · 첫 결제 1회 · 장바구니에서 자동 적용`,
  }
  if (state.available) return [{ ...base, expiresAt: '첫 결제 때 사용', status: '사용가능' }]
  if (state.used) {
    const d = state.usedAt ? new Date(state.usedAt).toLocaleDateString('ko-KR') : ''
    return [{ ...base, expiresAt: d ? `${d} 사용` : '사용함', status: '사용완료' }]
  }
  return []
}

export default function CouponPage() {
  const { user } = useAuth()
  const [state, setState] = useState<FirstOrderCouponState | null>(null)

  useEffect(() => {
    if (user) fetchFirstOrderCoupon(user.id).then(setState)
  }, [user])

  const coupons = couponsFor(state)
  const available = coupons.filter((c) => c.status === '사용가능')

  return (
    <div className="container coupon-page">
      <h1>쿠폰함 ({available.length})</h1>

      {state && coupons.length === 0 && <p className="coupon-condition">아직 받은 쿠폰이 없어요.</p>}
      <div className="coupon-list">
        {coupons.map((coupon) => (
          <div key={coupon.id} className={`coupon-card ${coupon.status !== '사용가능' ? 'is-inactive' : ''}`}>
            <div className="coupon-discount">{coupon.discount}</div>
            <div className="coupon-info">
              <p className="coupon-title">{coupon.title}</p>
              <p className="coupon-condition">{coupon.condition}</p>
              <p className="coupon-expiry">{coupon.expiresAt}</p>
            </div>
            <span className={`coupon-status ${coupon.status === '사용가능' ? 'active' : ''}`}>
              {coupon.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
