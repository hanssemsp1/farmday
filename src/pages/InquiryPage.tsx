import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { fetchOrders } from '../lib/orders'
import { GuestCred, savedGuestHint } from '../lib/guestOrder'
import { INQUIRY_KINDS, InquiryKind, MyInquiry, myInquiries, photoPayload, sendInquiry } from '../lib/inquiry'
import { DbOrder } from '../types/order'
import '../styles/auth.css'
import './InquiryPage.css'

// 1:1 문의 (교환 · 반품 · 배송 · 상품) — 쓴 사람과 관리자만 본다.
// 회원은 로그인으로, 비회원은 주문번호 + 휴대폰 + 조회 비밀번호로 확인한 뒤 쓰고 본다(서버 inquiry 함수).
const orderNoOf = (id: string) => 'FD-' + id.slice(0, 8).toUpperCase()

export default function InquiryPage() {
  const { user, loading } = useAuth()
  const hint = savedGuestHint()
  const [guest, setGuest] = useState<GuestCred | null>(null)
  const [g, setG] = useState({ orderNo: hint?.orderNo ?? '', phone: hint?.phone ?? '', password: '' })
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [list, setList] = useState<MyInquiry[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const [kind, setKind] = useState<InquiryKind>('교환·반품')
  const [orderPick, setOrderPick] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [phone, setPhone] = useState('')
  const [productName, setProductName] = useState('')
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])

  const ready = !!user || !!guest

  async function loadList(cred?: GuestCred) {
    const r = await myInquiries(cred)
    if (r.ok) setList(r.inquiries ?? [])
    return r
  }

  useEffect(() => {
    if (!user) return
    loadList()
    fetchOrders(user.id).then(({ data }) => setOrders(data.filter((o) => o.status !== '결제대기')))
    setBuyerName((user.user_metadata?.name as string | undefined) ?? '')
  }, [user])

  // 회원이 주문을 고르면 주문번호 · 상품명 · 연락처를 채운다
  function pickOrder(id: string) {
    setOrderPick(id)
    const o = orders.find((x) => x.id === id)
    if (!o) { setOrderNo(''); return }
    setOrderNo(orderNoOf(o.id))
    setProductName(o.items.map((it) => it.name + (it.optionName ? ` (${it.optionName})` : '')).join(', ').slice(0, 120))
    if (o.buyer_name) setBuyerName(o.buyer_name)
    if (o.buyer_phone) setPhone(o.buyer_phone)
  }

  async function confirmGuest(e: FormEvent) {
    e.preventDefault()
    setErr(''); setBusy(true)
    const cred = { orderNo: g.orderNo.trim(), phone: g.phone, password: g.password }
    const r = await loadList(cred)
    setBusy(false)
    if (!r.ok) { setErr(r.message ?? '주문을 확인하지 못했어요.'); return }
    setGuest(cred)
    setOrderNo(cred.orderNo.toUpperCase().startsWith('FD') ? cred.orderNo.toUpperCase() : 'FD-' + cred.orderNo.toUpperCase())
    setPhone(cred.phone)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr(''); setMsg('')
    if (text.trim().length < 5) { setErr('내용을 조금 더 자세히 적어 주세요.'); return }
    setBusy(true)
    try {
      const photos = await photoPayload(files)
      const r = await sendInquiry({ guest: guest ?? undefined, orderNo, kind, buyerName, phone, productName, body: text, photos })
      if (!r.ok) { setErr(r.message ?? '보내지 못했어요.'); return }
      setMsg('문의를 받았어요. 답변은 이 화면에서 확인하실 수 있어요.')
      setText(''); setFiles([])
      await loadList(guest ?? undefined)
    } catch (x) {
      setErr(x instanceof Error ? x.message : '보내지 못했어요.')
    } finally { setBusy(false) }
  }

  if (loading) return null

  // 로그인도 비회원 확인도 아직 — 둘 중 하나
  if (!ready) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p className="auth-title">1:1 문의</p>
          <p className="guest-lookup-note">
            교환 · 반품 · 배송 문의를 남기는 곳이에요. 쓰신 분과 관리자만 볼 수 있어요.<br />
            회원은 <Link to="/login?next=/inquiry">로그인</Link>해 주세요. 비회원은 주문을 먼저 확인해 주세요.
          </p>
          <form className="auth-form" onSubmit={confirmGuest}>
            <div className="form-field">
              <label htmlFor="q-no">주문번호</label>
              <input id="q-no" value={g.orderNo} onChange={(e) => setG({ ...g, orderNo: e.target.value.slice(0, 12) })} placeholder="FD-1A2B3C4D" required />
            </div>
            <div className="form-field">
              <label htmlFor="q-phone">휴대폰 번호 (주문하신 분)</label>
              <input id="q-phone" type="tel" inputMode="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value.replace(/[^0-9-]/g, '').slice(0, 13) })} placeholder="010-1234-5678" autoComplete="off" required />
            </div>
            <div className="form-field">
              <label htmlFor="q-pw">조회 비밀번호</label>
              <input id="q-pw" type="password" inputMode="numeric" value={g.password} onChange={(e) => setG({ ...g, password: e.target.value.replace(/\D/g, '').slice(0, 6) })} placeholder="주문할 때 정한 숫자 4~6자리" autoComplete="off" required />
            </div>
            <Button type="submit" className="auth-submit" disabled={busy}>{busy ? '확인 중...' : '주문 확인하고 문의하기'}</Button>
          </form>
          {err && <p className="auth-demo-note">{err}</p>}
          <div className="form-row" style={{ justifyContent: 'center', gap: 16 }}>
            <Link to="/login?next=/inquiry" className="form-link">회원 로그인</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container inquiry">
      <h1>1:1 문의</h1>
      <p className="inquiry-lead">교환 · 반품 · 배송 문의를 남겨 주세요. <b>쓰신 분과 관리자만</b> 볼 수 있어요. 상품에 문제가 있으면 사진을 함께 올려 주시면 빨리 확인할 수 있어요.</p>

      <form className="inquiry-form" onSubmit={submit}>
        <div className="inquiry-kinds" role="radiogroup" aria-label="문의 종류">
          {INQUIRY_KINDS.map((k) => (
            <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>

        {user && orders.length > 0 && (
          <div className="form-field">
            <label htmlFor="i-order">어느 주문인가요?</label>
            <select id="i-order" value={orderPick} onChange={(e) => pickOrder(e.target.value)}>
              <option value="">주문을 골라 주세요(주문과 상관없는 문의면 비워 두세요)</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {new Date(o.created_at).toLocaleDateString('ko-KR')} · {orderNoOf(o.id)} · {o.items[0]?.name}{o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="inquiry-grid">
          <div className="form-field">
            <label htmlFor="i-no">주문번호</label>
            <input id="i-no" value={orderNo} readOnly={!!guest} onChange={(e) => setOrderNo(e.target.value.slice(0, 12))} placeholder="FD-1A2B3C4D" />
          </div>
          <div className="form-field">
            <label htmlFor="i-name">주문자명</label>
            <input id="i-name" value={buyerName} onChange={(e) => setBuyerName(e.target.value.slice(0, 30))} required />
          </div>
          <div className="form-field">
            <label htmlFor="i-phone">연락처</label>
            <input id="i-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9-]/g, '').slice(0, 13))} placeholder="010-1234-5678" required />
          </div>
          <div className="form-field">
            <label htmlFor="i-product">상품명</label>
            <input id="i-product" value={productName} onChange={(e) => setProductName(e.target.value.slice(0, 120))} placeholder="예: 성주 참외 2kg" />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="i-body">내용</label>
          <textarea id="i-body" rows={7} value={text} maxLength={3000} onChange={(e) => setText(e.target.value)} placeholder="받으신 날짜, 어떤 문제가 있는지, 원하시는 처리(교환 · 반품 · 환불)를 적어 주세요." required />
        </div>
        <div className="form-field">
          <label htmlFor="i-photo">사진 <span className="inquiry-opt">(선택 · 최대 3장 · 한 장 5MB)</span></label>
          <input id="i-photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
          <p className="inquiry-files">송장 · 주소 · 얼굴이 나오지 않게 찍어 주세요</p>
          {files.length > 0 && <p className="inquiry-files">{files.map((f) => f.name).join(', ')}</p>}
        </div>
        {err && <p className="inquiry-err">{err}</p>}
        {msg && <p className="inquiry-ok">{msg}</p>}
        <Button type="submit" disabled={busy}>{busy ? '보내는 중...' : '문의 보내기'}</Button>
      </form>

      <section className="inquiry-list">
        <h2>내 문의 {list.length > 0 && <span>{list.length}건</span>}</h2>
        {list.length === 0 && <p className="inquiry-empty">아직 남기신 문의가 없어요.</p>}
        {list.map((q) => (
          <article key={q.id} className="inquiry-item">
            <p className="inquiry-meta">
              {new Date(q.created_at).toLocaleDateString('ko-KR')} · {q.kind}{q.order_no ? ` · ${q.order_no}` : ''}{q.product_name ? ` · ${q.product_name}` : ''}{q.photos ? ` · 사진 ${q.photos}장` : ''}
              <span className={'inquiry-status s-' + q.status}>{q.status}</span>
            </p>
            <p className="inquiry-body">{q.body}</p>
            {q.answer && (
              <div className="inquiry-answer">
                <p className="inquiry-answer-head">팜데이 답변{q.answered_at ? ` · ${new Date(q.answered_at).toLocaleDateString('ko-KR')}` : ''}</p>
                <p>{q.answer}</p>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  )
}
