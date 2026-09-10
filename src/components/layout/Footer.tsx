import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteSettings } from '../../context/SiteSettingsContext'
import './Footer.css'

export default function Footer() {
  const { settings } = useSiteSettings()
  // 동그란 로고를 올리면 가로로 긴 로고보다 크게 — 안 그러면 글자가 뭉개진다
  const [round, setRound] = useState(false)

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="logo">{settings?.logoFooter
              ? <img src={settings.logoFooter} alt={settings.companyName || 'Farmday'}
                className={`logo-img ${round ? 'logo-round' : ''}`}
                onLoad={(e) => setRound(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight < 1.7)} />
              : <>Farmday<span className="logo-dot">.</span></>}</Link>
            <p>{settings?.tagline || '매일이 수확하는 날, 산지직송 신선식품 마켓'}</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>고객센터</h4>
              <Link to="/notice">공지사항</Link>
              <Link to="/board">게시판</Link>
              <a href="#">1:1 문의</a>
            </div>
            <div className="footer-col">
              <h4>쇼핑 정보</h4>
              <Link to="/terms">이용약관</Link>
              <Link to="/privacy">개인정보처리방침</Link>
              <Link to="/shipping">배송·교환·환불</Link>
            </div>
            <div className="footer-col">
              <h4>회사 정보</h4>
              <a href="#">회사소개</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            {settings ? (
              <>
                {settings.companyName} · 대표 {settings.ceoName} · 사업자등록번호 {settings.businessRegNo}
                <br />
                {settings.address} · 고객센터 {settings.phone} (평일 09:00–18:00)
              </>
            ) : (
              <>
                (주)팜데이 · 대표 홍길동 · 사업자등록번호 000-00-00000
                <br />
                서울특별시 어딘가 123 · 고객센터 1544-0000 (평일 09:00–18:00)
              </>
            )}
          </p>
          <p className="footer-copyright">&copy; {new Date().getFullYear()} Farmday. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
