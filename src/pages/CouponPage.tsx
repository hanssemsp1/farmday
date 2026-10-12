import './CouponPage.css'

interface Coupon {
  id: string
  title: string
  discount: string
  condition: string
  expiresAt: string
  status: '사용가능' | '사용완료' | '기간만료'
}

// 쿠폰 기능은 아직 없다 — 예시 쿠폰을 보여주면 쓸 수 없는 쿠폰이 보이므로 비워 둔다
const COUPONS: Coupon[] = []

export default function CouponPage() {
  const available = COUPONS.filter((c) => c.status === '사용가능')

  return (
    <div className="container coupon-page">
      <h1>쿠폰함 ({available.length})</h1>

      {COUPONS.length === 0 && <p className="coupon-condition">아직 받은 쿠폰이 없어요.</p>}
      <div className="coupon-list">
        {COUPONS.map((coupon) => (
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
