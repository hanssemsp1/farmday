import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSiteSettings } from '../../context/SiteSettingsContext'
import './Footer.css'
import { BUSINESS } from '../../config/business'

export default function Footer() {
  const { settings } = useSiteSettings()
  // 로고 모양에 따라 크기를 달리한다 — 헤더와 같은 규칙
  const [shape, setShape] = useState<'wide' | 'mix' | 'round'>('wide')

  const companyName = settings?.companyName || BUSINESS.companyName
  const ceoName = settings?.ceoName || BUSINESS.ceoName
  const businessRegNo = settings?.businessRegNo || BUSINESS.businessRegNo
  const phone = settings?.phone || BUSINESS.phone
  // 주소는 사업자등록증 표기(읍·면 포함)를 쓴다
  const address = BUSINESS.address

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="logo">{settings?.logoFooter
              ? <img src={settings.logoFooter} alt={companyName}
                className={`logo-img logo-${shape}`}
                onLoad={(e) => {
                  const r = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight
                  setShape(r < 1.7 ? 'round' : r < 4.2 ? 'mix' : 'wide')
                }} />
              : <>Farmday<span className="logo-dot">.</span></>}</Link>
            <p>{settings?.tagline || '매일이 수확하는 날, 산지직송 신선식품 마켓'}</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>고객센터</h4>
              <Link to="/notice">공지사항</Link>
              <a href={BUSINESS.kakaoChannel} target="_blank" rel="noopener noreferrer">카카오채널 1:1 문의</a>
            </div>
            <div className="footer-col">
              <h4>쇼핑 정보</h4>
              <Link to="/terms">이용약관</Link>
              <Link to="/privacy">개인정보처리방침</Link>
              <Link to="/shipping">배송·교환·환불</Link>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            상호 {companyName} · 대표자 {ceoName} · 사업자등록번호 {businessRegNo}{' '}
            <a href={BUSINESS.ftcBizInfo} target="_blank" rel="noopener noreferrer" className="footer-bizinfo">
              [사업자정보확인]
            </a>
            <br />
            통신판매업 신고번호 {BUSINESS.mailOrderNo} · 주소 {address}
            <br />
            고객센터 {phone} (평일 09:00–18:00) · 이메일 {BUSINESS.email} · 카카오채널 1:1 상담
            <br />
            개인정보보호책임자 {BUSINESS.privacyOfficer} · 호스팅서비스 제공자 {BUSINESS.hosting}
          </p>
          <p className="footer-copyright">&copy; {new Date().getFullYear()} Farmday. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
