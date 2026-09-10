import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import { fetchBanners, type SiteBanner } from '../../lib/siteBanners'
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

/** 한 장이 머무는 시간 */
const HOLD_MS = 6000

export default function HeroBanner() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  // 관리자 화면에서 바꾼 배너를 서버에서 가져온다.
  // 못 가져오면 위에 적어둔 기본 배너를 그대로 쓴다 — 화면이 비지 않게.
  const [saved, setSaved] = useState<SiteBanner[] | null>(null)
  useEffect(() => {
    let alive = true
    fetchBanners().then((rows) => { if (alive && rows.length) setSaved(rows) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const slides = saved
    ? saved.map((b) => ({
      eyebrow: b.eyebrow, title: b.title, desc: b.descr,
      cta: b.cta, to: b.link || '/best', gradient: b.gradient, image: b.image,
    }))
    : SLIDES.map((s) => ({ ...s, image: '' }))

  const i = Math.min(active, slides.length - 1)
  const slide = slides[i]

  // 시간이 지나면 다음 장으로. 마우스를 올려두면 읽는 중이니 멈춘다.
  // active 가 바뀔 때마다 타이머를 새로 걸어서, 점을 눌러 넘긴 직후에도 한 장을 온전히 보여준다.
  useEffect(() => {
    if (paused || slides.length < 2) return
    const t = setTimeout(() => setActive((k) => (k + 1) % slides.length), HOLD_MS)
    return () => clearTimeout(t)
  }, [i, paused, slides.length])

  // 사진 위에 글씨가 묻히지 않게 왼쪽을 살짝 어둡게 덮는다
  const bgOf = (s: (typeof slides)[number]) =>
    s.image
      ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.70) 0%,rgba(0,0,0,.40) 50%,rgba(0,0,0,.12) 100%), url(${s.image})`,
        backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: s.gradient }

  // 사진에 글씨가 이미 들어 있으면 관리자 화면에서 글칸을 비우면 된다 — 그때는 글씨를 아예 안 그린다.
  const hasText = !!(slide.eyebrow || slide.title || slide.desc || slide.cta)

  return (
    <section className="hero-banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}>
      {/* 배경을 겹쳐 두고 켜진 장만 보이게 해서, 넘어갈 때 툭 끊기지 않고 서서히 바뀐다 */}
      {slides.map((s, k) => (
        <div key={k} className={`hero-bg ${k === i ? 'on' : ''}`} style={bgOf(s)} aria-hidden="true" />
      ))}

      {hasText && (
        <div className="container hero-banner-inner" key={i}>
          {slide.eyebrow && <p className="hero-eyebrow">{slide.eyebrow}</p>}
          {slide.title && (
            <h1>
              {slide.title.split('\n').map((line, k) => (
                <span key={k}>
                  {line}
                  <br />
                </span>
              ))}
            </h1>
          )}
          {slide.desc && <p className="hero-desc">{slide.desc}</p>}
          {slide.cta && (
            <Link to={slide.to}>
              <Button variant="green" size="lg" className="hero-cta">
                {slide.cta}
              </Button>
            </Link>
          )}
        </div>
      )}

      <div className="hero-dots">
        {slides.map((_, k) => (
          <button
            key={k}
            className={`hero-dot ${k === i ? 'active' : ''}`}
            aria-label={`${k + 1}번째 배너`}
            onClick={() => setActive(k)}
          />
        ))}
      </div>
    </section>
  )
}
