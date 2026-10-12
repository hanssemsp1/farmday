import Icon from '../ui/Icon'
import './PromoBanner.css'

// 쿠폰 기능이 아직 없어서 「가입 쿠폰」 대신 실제로 운영 중인 카카오채널을 안내한다
const KAKAO_CHANNEL = 'https://pf.kakao.com/_nxdMwX'

export default function PromoBanner() {
  return (
    <section className="container">
      <a href={KAKAO_CHANNEL} target="_blank" rel="noopener noreferrer" className="promo-banner">
        <div className="promo-icon">
          <Icon name="gift" className="icon-lg" />
        </div>
        <div className="promo-text">
          <h3>팜데이 카카오채널</h3>
          <p>새 제철 상품 소식과 주문 문의를 카톡으로 받아보세요</p>
        </div>
        <Icon name="chevron-right" className="promo-arrow" />
      </a>
    </section>
  )
}
