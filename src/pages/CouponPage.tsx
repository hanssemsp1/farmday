import './CouponPage.css'

interface Coupon {
  id: string
  title: string
  discount: string
  condition: string
  expiresAt: string
  status: '사용가능' | '사용완료' | '기간만료'
}

const COUPONS: Coupon[] = [
  {
    id: 'c1',
    title: '신규가입 웰컴 쿠폰',
    discount: '3,000원 할인',
    condition: '1만원 이상 구매 시',
    expiresAt: '2026.08.31까지',
    status: '사용가능',
  },
  {
    id: 'c2',
    title: '여름 신선식품 특가 쿠폰',
    discount: '15% 할인',
    condition: '과일·야채 카테고리',
    expiresAt: '2026.08.15까지',
    status: '사용가능',
  },
  {
    id: 'c3',
    title: '첫 구매 할인 쿠폰',
    discount: '2,000원 할인',
    condition: '전 상품',
    expiresAt: '2026.07.10까지',
    status: '사용완료',
  },
  {
    id: 'c4',
    title: '봄맞이 프로모션 쿠폰',
    discount: '10% 할인',
    condition: '3만원 이상 구매 시',
    expiresAt: '2026.05.31까지',
    status: '기간만료',
  },
]

export default function CouponPage() {
  const available = COUPONS.filter((c) => c.status === '사용가능')

  return (
    <div className="container coupon-page">
      <h1>쿠폰함 ({available.length})</h1>

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
