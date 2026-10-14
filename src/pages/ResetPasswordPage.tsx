import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'
import '../styles/auth.css'

// 재설정 메일의 링크로 들어오는 곳 — 링크가 잠시 로그인 상태를 만들어 주고, 여기서 새 비밀번호를 정한다.
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) setReady(true)
    })
    supabase.auth.getSession().then(({ data: s }) => { if (s.session) setReady(true) })
    // 링크가 만료됐거나 잘못된 경우 주소에 오류가 붙어 온다
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.get('error')) setNotice('링크가 만료됐거나 이미 쓴 링크예요. 비밀번호 찾기를 다시 해 주세요.')
    return () => data.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setNotice('비밀번호는 6자 이상으로 정해 주세요.'); return }
    if (password !== confirm) { setNotice('두 비밀번호가 같지 않아요.'); return }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) { setNotice('바꾸지 못했어요: ' + error.message); return }
    setNotice('비밀번호를 바꿨어요. 이제 새 비밀번호로 로그인돼 있어요.')
    setTimeout(() => navigate('/'), 1500)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">새 비밀번호 정하기</p>
        {!ready ? (
          <p className="auth-demo-note">{notice || '재설정 메일의 링크로 들어와 주세요. 확인 중이에요…'}</p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="rp-pw">새 비밀번호</label>
              <input id="rp-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" required />
            </div>
            <div className="form-field">
              <label htmlFor="rp-pw2">새 비밀번호 확인</label>
              <input id="rp-pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            <Button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? '바꾸는 중...' : '비밀번호 바꾸기'}
            </Button>
          </form>
        )}
        {ready && notice && <p className="auth-demo-note">{notice}</p>}
        <Link to="/forgot-password" className="form-link">비밀번호 찾기 다시 하기</Link>
      </div>
    </div>
  )
}
