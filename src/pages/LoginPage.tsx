import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import '../styles/auth.css'

export default function LoginPage() {
  const navigate = useNavigate()
  // 장바구니에서 「로그인하고 주문」으로 왔으면 로그인 뒤 그 화면으로 (사이트 안 주소만)
  const [params] = useSearchParams()
  const next = params.get('next') ?? ''
  const backTo = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const { signInWithPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [keepLoggedIn, setKeepLoggedIn] = useState(false)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setNotice('')
    const { error } = await signInWithPassword(email, password)
    setSubmitting(false)
    if (error) {
      setNotice(error === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않아요.' : error)
      return
    }
    navigate(backTo)
  }

  function handleSocial(provider: string) {
    setNotice(`${provider} 로그인은 소셜 제공자 설정 후 동작해요.`)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">신선한 오늘, 팜데이에서 시작하세요</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
              />
              로그인 상태 유지
            </label>
            <span className="form-link-group">
              <Link to="/find-id" className="form-link">아이디 찾기</Link>
              <span className="form-link-sep">|</span>
              <Link to="/forgot-password" className="form-link">비밀번호 찾기</Link>
            </span>
          </div>

          <Button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        {notice && <p className="auth-demo-note">{notice}</p>}

        <div className="auth-divider">또는</div>

        <div className="social-buttons">
          <button className="social-btn" onClick={() => handleSocial('Google')}>
            <span className="social-monogram google">G</span>
            Google로 계속하기
          </button>
          <button className="social-btn kakao" onClick={() => handleSocial('카카오')}>
            <span className="social-monogram kakao">K</span>
            카카오로 계속하기
          </button>
        </div>

        <p className="auth-footer">
          아직 회원이 아니신가요? <Link to="/signup" className="form-link">회원가입</Link>
        </p>
        {/* 휴대폰에서는 헤더의 「비회원 주문조회」가 숨겨지므로 여기에 한 줄 따로 둔다 */}
        <p className="auth-footer auth-footer-guest">
          비회원으로 주문하셨나요? <Link to="/guest-orders" className="form-link">비회원 주문조회</Link>
        </p>
      </div>
    </div>
  )
}
