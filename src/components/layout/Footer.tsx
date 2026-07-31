import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <span className="logo">Farmday<span className="logo-dot">.</span></span>
            <p>매일이 수확하는 날, 산지직송 신선식품 마켓</p>
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
              <a href="#">이용약관</a>
              <a href="#">개인정보처리방침</a>
              <a href="#">배송·교환·환불</a>
            </div>
            <div className="footer-col">
              <h4>회사 정보</h4>
              <a href="#">회사소개</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>
            (주)팜데이 · 대표 홍길동 · 사업자등록번호 000-00-00000
            <br />
            서울특별시 어딘가 123 · 고객센터 1544-0000 (평일 09:00–18:00)
          </p>
          <p className="footer-copyright">&copy; {new Date().getFullYear()} Farmday. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
