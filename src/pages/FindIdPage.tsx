import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabaseClient'
import '../styles/auth.css'

// 아이디 찾기 — 회원가입 때 적은 이름·휴대폰 번호로 가입 이메일을 찾는다(일부 가려서 보여 줌)
export default function FindIdPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<string[] | null>(null)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setNotice('')
    setResult(null)
    const { data, error } = await supabase.functions.invoke('find-id', { body: { name, phone } })
    setSubmitting(false)
    if (error || !data?.ok) { setNotice(data?.message ?? '찾지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return }
    setResult(data.emails as string[])
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">아이디 찾기</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="fi-name">이름</label>
            <input id="fi-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="회원가입 때 적은 이름" required />
          </div>
          <div className="form-field">
            <label htmlFor="fi-phone">휴대폰 번호</label>
            <input id="fi-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="010-1234-5678" required />
          </div>
          <Button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? '찾는 중...' : '아이디 찾기'}
          </Button>
        </form>

        {result && (
          result.length ? (
            <div className="auth-demo-note">
              <p style={{ margin: '0 0 6px' }}>가입하신 아이디(이메일)예요.</p>
              {result.map((m) => <p key={m} style={{ margin: 0, fontWeight: 700 }}>{m}</p>)}
            </div>
          ) : (
            <p className="auth-demo-note">일치하는 회원을 찾지 못했어요. 이름과 번호를 다시 확인해 주세요.</p>
          )
        )}
        {notice && <p className="auth-demo-note">{notice}</p>}
        <div className="form-row" style={{ justifyContent: 'center', gap: 16 }}>
          <Link to="/login" className="form-link">로그인</Link>
          <Link to="/forgot-password" className="form-link">비밀번호 찾기</Link>
        </div>
      </div>
    </div>
  )
}
