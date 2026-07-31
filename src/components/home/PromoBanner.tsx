import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import './PromoBanner.css'

export default function PromoBanner() {
  return (
    <section className="container">
      <Link to="/login" className="promo-banner">
        <div className="promo-icon">
          <Icon name="gift" className="icon-lg" />
        </div>
        <div className="promo-text">
          <h3>지금 가입하면 3,000원 쿠폰</h3>
          <p>첫 구매 시 바로 사용 가능해요</p>
        </div>
        <Icon name="chevron-right" className="promo-arrow" />
      </Link>
    </section>
  )
}
