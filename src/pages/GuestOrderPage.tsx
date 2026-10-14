import { FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { cancelView, CANCEL_REASONS } from '../lib/orderCancel'
import { trackingUrl } from '../lib/tracking'
import { cancelGuestOrder, GuestCred, GuestOrder, lookupGuestOrder, saveGuestHint, savedGuestHint } from '../lib/guestOrder'
import '../styles/auth.css'
import './OrderHistoryPage.css'

// 비회원 주문 조회 — 주문번호 + 휴대폰 번호 + 주문 때 정한 조회 비밀번호. 확인·취소는 모두 서버에서(틀리면 10분에 5번까지)
export default function GuestOrderPage() {
  const [params] = useSearchParams()
  const hint = savedGuestHint()
  const [orderNo, setOrderNo] = useState(params.get('no') ?? hint?.orderNo ?? '')
  const [phone, setPhone] = useState(hint?.phone ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [order, setOrder] = useState<GuestOrder | null>(null)
  const [cred, setCred] = useState<GuestCred | null>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0])
  const [msg, setMsg] = useState('')

  async function find(c: GuestCred) {
    const r = await lookupGuestOrder(c)
    if (!r.ok || !r.order) {
      setOrder(null)
      setNotice(r.message ?? '주문을 찾지 못했어요.')
      return false
    }
    setOrder(r.order)
    setCred(c)
    saveGuestHint(c)
    return true
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setNotice('')
    setMsg('')
    await find({ orderNo: orderNo.trim(), phone, password })
    setBusy(false)
  }

  async function submitCancel() {
    if (!cred) return
    setBusy(true)
    const r = await cancelGuestOrder(cred, reason)
    setOpen(false)
    setMsg(r.message ?? (r.ok ? '처리했어요.' : '취소하지 못했어요.'))
    await find(cred)
    setBusy(false)
  }

  if (order) {
    const v = cancelView(order)
    return (
      <div className="container order-history">
        <h1>비회원 주문 조회</h1>
        <div className="order-history-list">
          <div className="order-history-item">
            <div className="order-history-row">
              <div className="order-history-thumb" style={{ background: order.items[0]?.thumbnail }} />
              <div className="order-history-info">
                <p className="order-history-meta">
                  {new Date(order.created_at).toLocaleDateString('ko-KR')} · 주문번호 {order.order_no}
                </p>
                {order.items.map((it, i) => (
                  <p key={i} className="order-history-name">
                    {it.name}
                    {it.optionName && ` (${it.optionName})`} × {it.quantity}
                  </p>
                ))}
                <p className="order-history-price">{order.total_amount.toLocaleString()}원</p>
                <p className="order-history-meta">
                  받는 분 {order.recipient_name} · {order.address1} {order.address2}
                </p>
              </div>
              <div className="order-history-side">
                <span className={`order-status ${v.tone === 'off' ? 'canceled' : 'pending'}`}>{v.label}</span>
                {v.canCancel && !open && (
                  <button className="order-cancel-link" onClick={() => { setOpen(true); setReason(CANCEL_REASONS[0]); setMsg('') }}>
                    {v.isRequest ? '취소 요청' : '주문 취소'}
                  </button>
                )}
              </div>
            </div>

            {open && (
              <div className="order-cancel-box">
                <p>
                  {v.isRequest
                    ? '이미 산지에 주문이 넘어갔어요. 취소를 요청하면 산지에 확인한 뒤 알려 드려요. 상품이 이미 출발했으면 취소가 어려울 수 있어요.'
                    : '아직 산지로 넘어가기 전이라 바로 취소되고, 결제가 전액 취소돼요.'}
                </p>
                <select value={reason} onChange={(e) => setReason(e.target.value)}>
                  {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                <div className="order-cancel-actions">
                  <button className="order-cancel-btn danger" disabled={busy} onClick={submitCancel}>
                    {busy ? '처리 중…' : v.isRequest ? '취소 요청하기' : '주문 취소하기'}
                  </button>
                  <button className="order-cancel-btn" disabled={busy} onClick={() => setOpen(false)}>그만두기</button>
                </div>
              </div>
            )}
            {(order.shipments ?? []).length > 0 && (
              <div className="order-tracking">
                {(order.shipments ?? []).map((s) => (
                  <a key={s.number} href={trackingUrl(s.courier, s.number)} target="_blank" rel="noreferrer">
                    {s.courier} {s.number} · 배송 조회 →
                  </a>
                ))}
              </div>
            )}
            {order.cancel_status === '거절' && order.cancel_note && (
              <p className="order-cancel-note">취소 요청 답변: {order.cancel_note}</p>
            )}
            {msg && <p className="order-cancel-note">{msg}</p>}
          </div>
        </div>
        <div className="checkout-result-actions" style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={() => { setOrder(null); setPassword(''); setMsg('') }}>다른 주문 조회</Button>
          <Link to="/best">
            <Button variant="accent">쇼핑 계속하기</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">
          Farmday<span className="logo-dot">.</span>
        </Link>
        <p className="auth-title">비회원 주문 조회</p>
        <p className="guest-lookup-note">
          이미 결제한 주문을 찾아보는 곳이에요. 아직 주문 전이시면{' '}
          <Link to="/cart">장바구니</Link>에서 「비회원으로 주문하기」를 눌러 주세요.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="g-no">주문번호</label>
            <input id="g-no" value={orderNo} onChange={(e) => setOrderNo(e.target.value.slice(0, 12))} placeholder="FD-1A2B3C4D" required />
          </div>
          <div className="form-field">
            <label htmlFor="g-phone">휴대폰 번호 (주문하신 분)</label>
            <input id="g-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, '').slice(0, 13))} placeholder="010-1234-5678" autoComplete="off" required />
          </div>
          <div className="form-field">
            <label htmlFor="g-pw">조회 비밀번호</label>
            <input id="g-pw" type="password" inputMode="numeric" value={password} onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="주문할 때 정한 숫자 4~6자리" autoComplete="off" required />
          </div>
          <Button type="submit" className="auth-submit" disabled={busy}>
            {busy ? '찾는 중...' : '주문 조회'}
          </Button>
        </form>

        {notice && <p className="auth-demo-note">{notice}</p>}
        <div className="form-row" style={{ justifyContent: 'center', gap: 16 }}>
          <Link to="/login?next=/mypage/orders" className="form-link">회원 주문내역</Link>
          <Link to="/signup" className="form-link">회원가입</Link>
        </div>
      </div>
    </div>
  )
}