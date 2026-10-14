import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import { useAuth } from '../../context/AuthContext'
import { FIRST_ORDER_COUPON } from '../../lib/coupon'
import './PromoBanner.css'

// 첫 구매 쿠폰 안내 — 로그인 전이면 회원가입으로, 회원이면 쿠폰함으로
export default function PromoBanner() {
  const { user } = useAuth()
  const amount = FIRST_ORDER_COUPON.amount.toLocaleString()
  const min = FIRST_ORDER_COUPON.minSubtotal / 10000
  return (
    <section className="container">
      <Link to={user ? '/mypage/coupons' : '/signup'} className="promo-banner">
        <div className="promo-icon">
          <Icon name="gift" className="icon-lg" />
        </div>
        <div className="promo-text">
          <h3>첫 구매 {amount}원 할인 쿠폰</h3>
          <p>
            {user
              ? `첫 주문이 ${min}만 원 이상이면 ${amount}원을 바로 빼 드려요 · 쿠폰함 보기`
              : `회원가입하고 ${min}만 원 이상 첫 주문 때 ${amount}원을 바로 빼 드려요`}
          </p>
        </div>
        <Icon name="chevron-right" className="promo-arrow" />
      </Link>
    </section>
  )
}
