import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { findAddress, preloadPostcode } from '../lib/postcode'
import '../styles/auth.css'

export default function SignupPage() {
  const navigate = useNavigate()
  // 장바구니 「회원가입하고 3,000원 할인받기」로 왔으면 가입 뒤 장바구니로 (사이트 안 주소만)
  const [params] = useSearchParams()
  const next = params.get('next') ?? ''
  const backTo = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [address2, setAddress2] = useState('')
  useEffect(() => preloadPostcode(), [])
  async function pickAddress() {
    try {
      await findAddress((a) => {
        setZipcode(a.zipcode)
        setAddress(a.address)
      })
    } catch {
      setNotice('주소 찾기를 열지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    }
  }
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
      zipcode,
      address2,
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
    navigate(backTo)
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
            <div className="addr-search-row">
              <input id="zipcode" type="text" placeholder="우편번호" value={zipcode} readOnly className="addr-zip" />
              <button type="button" className="addr-find-btn" onClick={pickAddress}>주소 찾기</button>
            </div>
            <input
              id="address"
              type="text"
              placeholder="「주소 찾기」를 눌러 주소를 골라 주세요"
              value={address}
              readOnly
              onClick={() => !address && pickAddress()}
              required
            />
            <input
              id="address2"
              type="text"
              placeholder="상세 주소 (동·호수)"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
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
