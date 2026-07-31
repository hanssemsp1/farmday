import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import '../styles/auth.css'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [agree, setAgree] = useState(false)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) {
      setNotice('비밀번호가 일치하지 않아요.')
      return
    }
    if (!agree) {
      setNotice('이용약관에 동의해주세요.')
      return
    }

    setSubmitting(true)
    setNotice('')
    const { error, needsEmailConfirm } = await signUp(email, password, {
      name,
      phone,
      address,
    })
    setSubmitting(false)

    if (error) {
      setNotice(error === 'User already registered' ? '이미 가입된 이메일이에요.' : error)
      return
    }
    if (needsEmailConfirm) {
      setNotice('가입 확인 이메일을 보냈어요. 메일함에서 인증 링크를 눌러주세요.')
      return
    }
    navigate('/')
  }

  function handleSocial(provider: string) {
    setNotice(`${provider} 회원가입은 소셜 제공자 설정 후 동작해요.`)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">팜데이의 첫 회원이 되어보세요</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">이름</label>
            <input
              id="name"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="phone">연락처</label>
            <input
              id="phone"
              type="tel"
              placeholder="010-1234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="address">주소</label>
            <input
              id="address"
              type="text"
              placeholder="배송받으실 주소를 입력하세요"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="signup-email">이메일</label>
            <input
              id="signup-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              placeholder="8자 이상 입력하세요"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password-confirm">비밀번호 확인</label>
            <input
              id="password-confirm"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label className="form-checkbox">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              이용약관 및 개인정보처리방침에 동의합니다
            </label>
          </div>

          <Button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '가입 처리 중...' : '회원가입'}
          </Button>
        </form>

        {notice && <p className="auth-demo-note">{notice}</p>}

        <div className="auth-divider">또는</div>

        <div className="social-buttons">
          <button className="social-btn" onClick={() => handleSocial('Google')}>
            <span className="social-monogram google">G</span>
            Google로 시작하기
          </button>
          <button className="social-btn kakao" onClick={() => handleSocial('카카오')}>
            <span className="social-monogram kakao">K</span>
            카카오로 시작하기
          </button>
        </div>

        <p className="auth-footer">
          이미 회원이신가요? <Link to="/login" className="form-link">로그인</Link>
        </p>
      </div>
    </div>
  )
}
