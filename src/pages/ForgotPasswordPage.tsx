import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'
import '../styles/auth.css'

// 비밀번호 찾기 — 가입한 이메일로 재설정 링크를 보낸다. 링크를 누르면 /reset-password 에서 새 비밀번호를 정한다.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setNotice('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    if (error) {
      // 가입 여부를 알려 주지 않도록, 잦은 요청만 따로 안내한다
      if (/rate|seconds/i.test(error.message)) {
        setNotice('잠시 뒤에 다시 시도해 주세요. (짧은 시간에 여러 번 요청했어요)')
        return
      }
      setNotice('메일을 보내지 못했어요. 잠시 뒤 다시 시도하시거나 카카오채널로 알려 주세요.')
      return
    }
    setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">비밀번호 찾기</p>

        {sent ? (
          <>
            <p className="auth-demo-note">
              {email} 로 비밀번호 재설정 메일을 보냈어요. 메일의 링크를 누르면 새 비밀번호를 정할 수 있어요.
              메일이 안 보이면 스팸함도 확인해 주세요.
            </p>
            <Link to="/login" className="form-link">로그인으로 돌아가기</Link>
          </>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="fp-email">가입한 이메일</label>
              <input id="fp-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? '보내는 중...' : '재설정 메일 받기'}
            </Button>
            <Link to="/login" className="form-link">로그인으로 돌아가기</Link>
          </form>
        )}
        {notice && <p className="auth-demo-note">{notice}</p>}
      </div>
    </div>
  )
}
