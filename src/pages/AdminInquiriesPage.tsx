import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/adminConfig'
import { AdminInquiry, adminAnswer, adminInquiries, photoUrl } from '../lib/inquiry'
import './InquiryPage.css'

// 관리자 — 1:1 문의(교환 · 반품 · 배송 · 상품) 보고 답하기. 사진은 10분짜리 서명 주소로만 연다.
const FILTERS = ['새 문의', '답변함', '끝', '전체'] as const

export default function AdminInquiriesPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<AdminInquiry[]>([])
  const [filter, setFilter] = useState<typeof FILTERS[number]>('새 문의')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const [notice, setNotice] = useState('')

  useEffect(() => { if (!loading && !isAdmin(user)) navigate('/') }, [loading, user, navigate])
  async function load() {
    const { data, error } = await adminInquiries()
    if (error) { setNotice('불러오지 못했어요: ' + error.message); return }
    setRows(data)
    setDrafts(Object.fromEntries(data.map((r) => [r.id, r.answer ?? ''])))
  }
  useEffect(() => { if (isAdmin(user)) load() }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function showPhotos(r: AdminInquiry) {
    const urls = await Promise.all(r.photos.map((p) => photoUrl(p)))
    setPhotos((m) => ({ ...m, [r.id]: urls.filter(Boolean) }))
  }
  async function save(r: AdminInquiry, status: AdminInquiry['status']) {
    const { error } = await adminAnswer(r.id, drafts[r.id] ?? '', status)
    setNotice(error ? '저장하지 못했어요: ' + error.message : '저장했어요.')
    await load()
  }

  if (loading || !isAdmin(user)) return null
  const shown = rows.filter((r) => filter === '전체' || r.status === filter)
  const count = (f: string) => rows.filter((r) => f === '전체' || r.status === f).length

  return (
    <div className="container inquiry">
      <h1>1:1 문의 관리</h1>
      <p className="inquiry-lead">손님 화면에는 답변과 상태만 보입니다. 사진은 「사진 보기」를 누르면 10분 동안 열립니다.</p>
      <div className="adm-inq-filters">
        {FILTERS.map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f} {count(f)}</button>)}
      </div>
      {notice && <p className="inquiry-ok">{notice}</p>}
      {shown.length === 0 && <p className="inquiry-empty">문의가 없어요.</p>}
      {shown.map((r) => (
        <article key={r.id} className="adm-inq">
          <p className="inquiry-meta">
            {new Date(r.created_at).toLocaleString('ko-KR')} · {r.kind}{r.order_no ? ` · ${r.order_no}` : ''}{r.order_id ? ' (주문 확인됨)' : ''} · {r.user_id ? '회원' : '비회원'}
            <span className={'inquiry-status s-' + r.status}>{r.status}</span>
          </p>
          <p className="adm-inq-who"><b>{r.buyer_name}</b> · {r.phone}{r.product_name ? ` · ${r.product_name}` : ''}</p>
          <p className="inquiry-body">{r.body}</p>
          {r.photos.length > 0 && !photos[r.id] && <button className="linkish" onClick={() => showPhotos(r)}>사진 {r.photos.length}장 보기</button>}
          {photos[r.id] && <div className="adm-inq-photos">{photos[r.id].map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="손님이 올린 사진" /></a>)}</div>}
          <textarea rows={3} value={drafts[r.id] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))} placeholder="손님에게 보일 답변" />
          <div className="adm-inq-actions">
            <button onClick={() => save(r, '답변함')}>답변 저장</button>
            <button onClick={() => save(r, '끝')}>끝으로</button>
            {r.status !== '새 문의' && <button onClick={() => save(r, '새 문의')}>새 문의로 되돌리기</button>}
          </div>
        </article>
      ))}
    </div>
  )
}
