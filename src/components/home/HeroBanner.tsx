import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import './HeroBanner.css'

const SLIDES = [
  {
    eyebrow: 'NEW MEMBER',
    title: '첫 구매 15% 할인 쿠폰',
    desc: '지금 가입하고 웰컴 쿠폰을 받아보세요',
    cta: '쿠폰 받기',
    to: '/login',
    gradient: 'linear-gradient(120deg,#4A154B,#1264A3 75%)',
  },
  {
    eyebrow: '2026 SUMMER BEST',
    title: '지금 가장 많이 찾는\n팜데이 베스트 상품',
    desc: '최대 30% 할인 · 무료배송 · 오늘 발송',
    cta: '베스트 보러가기',
    to: '/best',
    gradient: 'linear-gradient(120deg,#1264A3,#2EB67D 75%)',
  },
  {
    eyebrow: 'WEEKLY PICK',
    title: '이번 주, 팜데이가 고른\n제철 과일·채소 모음',
    desc: '산지에서 오늘 막 도착한 신선함 그대로',
    cta: '제철 상품 보기',
    to: '/best',
    gradient: 'linear-gradient(120deg,#ECB22E,#4A154B 75%)',
  },
]

export default function HeroBanner() {
  const [active, setActive] = useState(0)
  const slide = SLIDES[active]

  return (
    <section className="hero-banner" style={{ background: slide.gradient }}>
      <div className="container hero-banner-inner">
        <p className="hero-eyebrow">{slide.eyebrow}</p>
        <h1>
          {slide.title.split('\n').map((line, i) => (
            <span key={i}>
              {line}
              <br />
            </span>
          ))}
        </h1>
        <p className="hero-desc">{slide.desc}</p>
        <Link to={slide.to}>
          <Button variant="green" size="lg" className="hero-cta">
            {slide.cta}
          </Button>
        </Link>
      </div>

      <div className="hero-dots">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            className={`hero-dot ${i === active ? 'active' : ''}`}
            aria-label={`${i + 1}번째 배너`}
            onClick={() => setActive(i)}
          />
        ))}
      </div>
    </section>
  )
}
