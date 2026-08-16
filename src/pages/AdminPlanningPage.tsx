import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/adminConfig'
import { fetchPlans, savePlan, deletePlan } from '../lib/productPlans'
import {
  ProductPlan, PlanOption, PLAN_CATEGORIES, THUMB_SLOTS, DETAIL_SLOTS,
  DISCOUNTS, emptyPlan, netOf, listPriceOf, doneCount,
} from '../types/productPlan'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import './AdminPlanningPage.css'

const won = (n: number | null | undefined) => (n === null || n === undefined ? '' : Number(n).toLocaleString())
// 0.42 → "42%" (42.5% 처럼 소수도 그대로 보여준다)
const pctText = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : `${Number((v * 100).toFixed(1))}%`
const numOf = (s: string): number | null => {
  const t = s.replace(/[^\d.-]/g, '')
  if (!t.trim()) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// 카테고리 아이콘
const CAT_ICON: Record<string, 'leaf' | 'apple' | 'fish' | 'meat' | 'can'> = {
  야채: 'leaf', 과일: 'apple', 수산: 'fish', 축산: 'meat', 식품: 'can',
}

// 글이 길어지면 칸이 저절로 늘어난다 — 스크롤 없이 한눈에 보이게
function Auto({ value, onChange, placeholder, className, min = 38 }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  min?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, min) + 'px'
  }, [value, min])
  return (
    <textarea ref={ref} className={className} value={value} placeholder={placeholder}
      style={{ minHeight: min }} onChange={(e) => onChange(e.target.value)} />
  )
}

export default function AdminPlanningPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<ProductPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [cur, setCur] = useState<ProductPlan | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => { if (!authLoading && !isAdmin(user)) navigate('/') }, [authLoading, user, navigate])

  useEffect(() => {
    if (!isAdmin(user)) return
    fetchPlans()
      .then(setPlans)
      .catch((e) => setNotice('불러오지 못했습니다: ' + e.message))
      .finally(() => setLoading(false))
  }, [user])

  const list = useMemo(() => {
    const key = q.trim().toLowerCase()
    const order = (c: string) => { const i = PLAN_CATEGORIES.indexOf(c as never); return i < 0 ? 99 : i }
    return plans
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !key || (p.id + p.vendor.name + p.coupang.name).toLowerCase().includes(key))
      .sort((a, b) => order(a.category) - order(b.category) || a.id.localeCompare(b.id))
  }, [plans, cat, q])

  // ── 자동 저장 ──────────────────────────────────
  // 저장 버튼을 눌러야만 저장되던 때, 페이지가 죽으면서 적어둔 게 날아간 적이 있다.
  // 타이핑이 잠깐 멈추면 알아서 저장한다.
  // ⚠️ 아래 `return null` 보다 위에 있어야 한다 — React는 훅을 건너뛰면 안 된다.
  const timer = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)

  const persist = useCallback(async (plan: ProductPlan) => {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    try {
      const saved = await savePlan(plan)
      setPlans((prev) => [...prev.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.id.localeCompare(b.id)))
      setCur((c) => (c && c.id === saved.id ? { ...c, updatedAt: saved.updatedAt } : c))
      setDirty(false)
      setNotice('')
    } catch (e) {
      setNotice('저장 실패: ' + (e as Error).message)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    if (!dirty || !cur) return
    window.clearTimeout(timer.current)
    const snapshot = cur
    timer.current = window.setTimeout(() => persist(snapshot), 1200)
    return () => window.clearTimeout(timer.current)
  }, [cur, dirty, persist])

  if (authLoading || !isAdmin(user)) return null

  function edit(fn: (draft: ProductPlan) => void) {
    setCur((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      return next
    })
    setDirty(true); setNotice('')
  }

  function openPlan(p: ProductPlan) {
    // 넘어가기 전에 적던 것을 마저 저장한다
    window.clearTimeout(timer.current)
    if (dirty && cur) persist(cur)
    setCur(structuredClone(p)); setDirty(false); setNotice('')
  }

  function startNew() {
    const id = window.prompt('새 상품 이름 (예: 성주참외)')?.trim()
    if (!id) return
    if (plans.some((p) => p.id === id)) { window.alert('같은 이름의 상품이 이미 있습니다.'); return }
    setCur(emptyPlan(id, cat || PLAN_CATEGORIES[0])); setDirty(true); setNotice('')
  }

  async function handleSave() {
    if (!cur) return
    window.clearTimeout(timer.current)
    await persist(cur)
    setNotice('저장했습니다.')
  }

  async function handleDelete() {
    if (!cur) return
    if (!window.confirm(`「${cur.id}」를 지울까요? 되돌릴 수 없습니다.`)) return
    window.clearTimeout(timer.current)   // 지운 것을 자동 저장이 되살리지 않게
    try {
      await deletePlan(cur.id)
      setPlans((prev) => prev.filter((p) => p.id !== cur.id))
      setCur(null); setDirty(false); setNotice('지웠습니다.')
    } catch (e) { setNotice('삭제 실패: ' + (e as Error).message) }
  }

  function download() {
    if (!cur) return
    const blob = new Blob([JSON.stringify(cur, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${cur.id}_제작요청서.json`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="container plan">
      <div className="plan-head">
        <div>
          <h1>상품 기획</h1>
          <p>양식에 채워 넣으면 카테고리별로 저장됩니다. 다시 올릴 때가 되면 불러와서 단가만 고치면 됩니다.</p>
        </div>
        <Button onClick={startNew}>＋ 상품 등록</Button>
      </div>

      <div className="plan-body">
        <aside className="plan-side">
          <input className="plan-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품·업체 검색" />
          <div className="plan-cats">
            <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>전체 {plans.length}</button>
            {PLAN_CATEGORIES.map((c) => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                <Icon name={CAT_ICON[c]} /> {c} {plans.filter((p) => p.category === c).length}
              </button>
            ))}
          </div>
          <div className="plan-list">
            {loading && <p className="plan-empty">불러오는 중…</p>}
            {!loading && !list.length && <p className="plan-empty">아직 등록한 상품이 없습니다.</p>}
            {list.map((p) => {
              const d = doneCount(p)
              return (
                <button key={p.id} className={`plan-row ${cur?.id === p.id ? 'on' : ''}`}
                  data-cat={p.category} onClick={() => openPlan(p)}>
                  <span className="plan-row-t">
                    {p.category && <Icon name={CAT_ICON[p.category]} />}
                    <b>{p.id}</b>
                    <em>{'●'.repeat(d)}{'○'.repeat(6 - d)}</em>
                  </span>
                  <span className="plan-row-s">
                    {[p.vendor.name, p.season.join('·'), p.status].filter(Boolean).join(' · ') || '아직 비어 있음'}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="plan-main">
          {!cur && (
            <div className="plan-blank">
              <b>상품 하나를 고르거나, 새로 등록하세요</b>
              <p>양식은 엑셀에 쓰시던 그대로입니다.</p>
              <Button onClick={startNew}>＋ 상품 등록</Button>
            </div>
          )}
          {cur && <PlanSheet plan={cur} edit={edit} />}
        </section>
      </div>

      {cur && (
        <div className="plan-bar">
          <span className={saving ? 'saving' : dirty ? 'dirty' : 'saved'}>
            {saving ? '저장 중…'
              : dirty ? '곧 저장됩니다'
                : cur.updatedAt ? `✓ 저장됨 · ${new Date(cur.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          {notice && <span className="plan-notice">{notice}</span>}
          <span className="sp" />
          <button className="plan-ghost danger" onClick={handleDelete}>삭제</button>
          <button className="plan-ghost" onClick={download}>제작 요청서 내려받기</button>
          <Button onClick={handleSave} disabled={saving}>지금 저장</Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// 양식 — 대표님 엑셀 표 그대로. 왼쪽 항목 / 오른쪽 입력칸.
// ─────────────────────────────────────────────────────
function PlanSheet({ plan, edit }: { plan: ProductPlan; edit: (fn: (d: ProductPlan) => void) => void }) {
  const done = doneCount(plan)

  const avg = (w: string) => {
    const v = plan.competitors.rows.map((r) => r.prices?.[w]).filter((x): x is number => Number(x) > 0)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  const bad = plan.options.filter((o) => { const n = netOf(o); return n !== null && n < 0 })
  const thin = plan.options.filter((o) => { const n = netOf(o); return n !== null && n >= 0 && o.price && n < o.price * 0.05 })

  const addWeight = () => {
    const w = window.prompt('중량 칸 이름 (예: 600g, 1.2kg, 10kg)')?.trim()
    if (!w) return
    if (plan.competitors.weights.includes(w)) { window.alert('이미 있는 중량입니다.'); return }
    edit((d) => { d.competitors.weights.push(w) })
  }

  return (
    <div className="sheet" data-cat={plan.category}>
      {/* 자주 쓰는 할인율 — 칸을 누르면 목록이 뜨지만, 직접 쳐 넣어도 된다 */}
      <datalist id="discount-list">
        {DISCOUNTS.map((d) => <option key={d} value={`${d * 100}%`} />)}
      </datalist>

      <div className="sheet-title">
        {plan.category && <Icon name={CAT_ICON[plan.category]} />}
        <h2>{plan.id}</h2>
        <span className="sheet-done">{done}<em>/6</em></span>
      </div>

      {/* ── 상품명 · 카테고리 · 태그 · 옵션ID ─────────── */}
      <table className="xl">
        <tbody>
          <tr>
            <th className="rowhead" rowSpan={THUMB_SLOTS.length}><Icon name="image" />상품명</th>
            <td className="sub">메인썸네일</td>
            <td className="fill">
              <input className="strong" value={plan.content.thumbs.main?.hook || ''}
                placeholder="1~5등을 보고 우리 문구를 정합니다"
                onChange={(e) => edit((d) => { d.content.thumbs.main = { ...d.content.thumbs.main, hook: e.target.value } })} />
            </td>
          </tr>
          {THUMB_SLOTS.slice(1).map((s) => (
            <tr key={s.key}>
              <td className="sub"><Icon name={s.key === 'sub1' ? 'zoom' : s.key === 'sub2' ? 'pin' : s.key === 'sub3' ? 'pot' : 'box'} />{s.name.replace('서브 썸네일 ', '서브썸네일')}</td>
              <td className="fill">
                <input className="strong" value={plan.content.thumbs[s.key]?.hook || ''} placeholder={s.guide}
                  onChange={(e) => edit((d) => { d.content.thumbs[s.key] = { ...d.content.thumbs[s.key], hook: e.target.value } })} />
              </td>
            </tr>
          ))}

          <tr>
            <th className="rowhead"><Icon name="tag" />카테고리</th>
            <td className="sub">쿠팡</td>
            <td className="fill"><input value={plan.coupang.category}
              onChange={(e) => edit((d) => { d.coupang.category = e.target.value })} /></td>
          </tr>
          <tr>
            <th className="rowhead"><Icon name="leaf" />우리 분류</th>
            <td className="sub">저장 위치</td>
            <td className="fill catrow">
              <select value={plan.category} onChange={(e) => edit((d) => { d.category = e.target.value })}>
                <option value="">—</option>
                {PLAN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={plan.season.join(', ')} placeholder="제철 (예: 6월, 7월)"
                onChange={(e) => edit((d) => { d.season = e.target.value.split(/[,·]/).map((s) => s.trim()).filter(Boolean) })} />
              <select value={plan.status} onChange={(e) => edit((d) => { d.status = e.target.value })}>
                {['기획', '제작중', '등록완료', '판매중', '종료'].map((s) => <option key={s}>{s}</option>)}
              </select>
              <input value={plan.vendor.name} placeholder="업체명"
                onChange={(e) => edit((d) => { d.vendor.name = e.target.value })} />
            </td>
          </tr>
          <tr>
            <th className="rowhead"><Icon name="sparkles" />상품명</th>
            <td className="sub">쿠팡 제목</td>
            <td className="fill"><Auto value={plan.coupang.name}
              onChange={(v) => edit((d) => { d.coupang.name = v })} /></td>
          </tr>
          <tr>
            <th className="rowhead"><Icon name="tag" />태그
              <b className={plan.coupang.tags.length >= 20 ? 'full' : ''}>{plan.coupang.tags.length}/20</b></th>
            <td className="sub">20개</td>
            <td className="fill"><Auto className="tags" min={72} value={plan.coupang.tags.join(', ')}
              onChange={(v) => edit((d) => { d.coupang.tags = v.split(/[,\n]/).map((s) => s.trim().replace(/^#/, '')).filter(Boolean) })} /></td>
          </tr>
          <tr>
            <th className="rowhead"><Icon name="info" />검색 필터</th>
            <td className="sub">체크한 것</td>
            <td className="fill"><input value={plan.coupang.searchFilter}
              onChange={(e) => edit((d) => { d.coupang.searchFilter = e.target.value })} /></td>
          </tr>
        </tbody>
      </table>

      {/* ── 옵션 ID ──────────────────────────────── */}
      <div className="xl-head"><Icon name="doc" />옵션 ID
        <span className="reg">등록상품ID
          <input value={plan.coupang.registerId} placeholder="제품당 하나"
            onChange={(e) => edit((d) => { d.coupang.registerId = e.target.value })} /></span>
      </div>
      <div className="xl-scroll">
        <table className="xl grid">
          <thead><tr>
            <th>옵션</th><th>옵션ID</th><th>노출상품ID</th><th>쿠폰ID</th>
            <th>쿠폰금액</th><th>등록일</th><th>종료일</th><th className="w1" />
          </tr></thead>
          <tbody>
            {plan.coupang.optionRows.map((r, i) => (
              <tr key={i}>
                <td><input value={r.option} placeholder="600g" onChange={(e) => edit((d) => { d.coupang.optionRows[i].option = e.target.value })} /></td>
                <td><input value={r.optionId} onChange={(e) => edit((d) => { d.coupang.optionRows[i].optionId = e.target.value })} /></td>
                <td><input value={r.exposeId} onChange={(e) => edit((d) => { d.coupang.optionRows[i].exposeId = e.target.value })} /></td>
                <td><input value={r.couponId} onChange={(e) => edit((d) => { d.coupang.optionRows[i].couponId = e.target.value })} /></td>
                <td><input value={won(r.couponAmount)} onChange={(e) => edit((d) => { d.coupang.optionRows[i].couponAmount = numOf(e.target.value) })} /></td>
                {/* 쿠폰 기간은 달력에서 고른다 — 매번 날짜를 치지 않게 */}
                <td><input className="date" type="date" value={r.start}
                  onChange={(e) => edit((d) => { d.coupang.optionRows[i].start = e.target.value })} /></td>
                <td><input className="date" type="date" value={r.end}
                  onChange={(e) => edit((d) => { d.coupang.optionRows[i].end = e.target.value })} /></td>
                <td className="w1"><button className="x" onClick={() => edit((d) => { d.coupang.optionRows.splice(i, 1) })}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="xl-add" onClick={() => edit((d) => {
        d.coupang.optionRows.push({ option: '', optionId: '', exposeId: '', couponId: '', couponAmount: null, start: '', end: '' })
      })}>＋ 줄 추가</button>

      {/* ── 경쟁판매가 ────────────────────────────── */}
      <div className="xl-head"><Icon name="chart" />경쟁판매가
        <button className="addw" onClick={addWeight}>＋ 중량</button></div>
      <div className="xl-scroll">
        <table className="xl grid comp">
          <thead><tr>
            <th className="w2" />
            {plan.competitors.weights.map((w, i) => (
              <th key={w} className="wcol">{w}
                <button className="x" onClick={() => {
                  if (!window.confirm(`「${w}」 칸을 지울까요?`)) return
                  edit((d) => {
                    d.competitors.weights.splice(i, 1)
                    d.competitors.rows.forEach((r) => { if (r.prices) delete r.prices[w] })
                  })
                }}>×</button></th>
            ))}
            <th className="l">썸네일</th>
          </tr></thead>
          <tbody>
            {plan.competitors.rows.map((r, i) => (
              <tr key={i}>
                <th className="w2">{r.rank}위</th>
                {plan.competitors.weights.map((w) => (
                  <td key={w}><input value={won(r.prices?.[w])}
                    onChange={(e) => edit((d) => {
                      d.competitors.rows[i].prices = d.competitors.rows[i].prices || {}
                      d.competitors.rows[i].prices[w] = numOf(e.target.value)
                    })} /></td>
                ))}
                <td className="l"><input value={r.title} placeholder={i === 0 ? '쿠팡에서 조사해서 작성' : ''}
                  onChange={(e) => edit((d) => { d.competitors.rows[i].title = e.target.value })} /></td>
              </tr>
            ))}
            <tr className="auto">
              <th className="w2">평균값</th>
              {plan.competitors.weights.map((w) => <td key={w}>{won(avg(w)) || '—'}</td>)}
              <td className="l note">자동</td>
            </tr>
          </tbody>
        </table>
      </div>
      {!plan.competitors.weights.length && (
        <p className="xl-hint">위 <b>＋ 중량</b>을 눌러 이 상품의 중량 칸부터 만드세요.</p>
      )}
      <button className="xl-add" onClick={() => edit((d) => {
        d.competitors.rows.push({ rank: d.competitors.rows.length + 1, prices: {}, title: '' })
      })}>＋ 순위 추가</button>

      {/* ── 상품옵션명 / 공급가 / 판매가 ───────────── */}
      <div className="xl-head"><Icon name="won" />공급가 · 판매가</div>
      <div className="xl-scroll">
        <table className="xl grid">
          <thead><tr>
            <th className="l">상품옵션명</th><th>중량</th><th>공급가</th><th>판매가</th>
            <th>쿠팡수수료</th><th>택배비</th><th className="auto-th">마진율</th><th className="auto-th">마진액</th>
            <th>할인율</th><th className="auto-th">정상가</th><th className="w1" />
          </tr></thead>
          <tbody>
            {plan.options.map((o, i) => {
              const n = netOf(o)
              const pct = n !== null && n >= 0 && o.price ? (n / o.price * 100).toFixed(1) + '%' : '—'
              const cls = n !== null && n < 0 ? 'bad' : (n !== null && o.price && n < o.price * 0.05 ? 'thin' : '')
              const set = (k: keyof PlanOption, v: unknown) => edit((d) => { (d.options[i] as never)[k] = v as never })
              return (
                <tr key={i} className={cls}>
                  <td className="l"><input value={o.label} onChange={(e) => set('label', e.target.value)} /></td>
                  <td><input value={o.weight} placeholder="600g" onChange={(e) => set('weight', e.target.value)} /></td>
                  <td><input value={won(o.cost)} onChange={(e) => set('cost', numOf(e.target.value))} /></td>
                  <td><input value={won(o.price)} onChange={(e) => set('price', numOf(e.target.value))} /></td>
                  <td><input value={o.fee != null ? `${(o.fee * 100).toFixed(0)}%` : ''}
                    onChange={(e) => { const v = numOf(e.target.value); set('fee', v === null ? 0.12 : (v > 1 ? v / 100 : v)) }} /></td>
                  <td><input value={won(o.shipping)} onChange={(e) => set('shipping', numOf(e.target.value) ?? 0)} /></td>
                  <td className="auto">{pct}</td>
                  <td className={`auto net ${cls}`}>{n === null ? '—' : won(n)}</td>
                  {/* 할인율은 그때그때 다르다 — 42%, 45% 처럼 직접 넣으신다 */}
                  <td>
                    <input value={pctText(o.discount)} placeholder="40%" list="discount-list"
                      onChange={(e) => {
                        const v = numOf(e.target.value)
                        set('discount', v === null ? null : (v > 1 ? v / 100 : v))
                      }} />
                  </td>
                  <td className="auto">{won(listPriceOf(o)) || '—'}</td>
                  <td className="w1"><button className="x" onClick={() => edit((d) => { d.options.splice(i, 1) })}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="xl-add" onClick={() => edit((d) => {
        d.options.push({ label: '', weight: '', cost: null, price: null, listPrice: null, discount: null, fee: 0.12, shipping: 0, note: '' })
      })}>＋ 옵션 추가</button>

      {(bad.length > 0 || thin.length > 0) && (
        <div className="xl-warn">
          {bad.map((o, i) => <div key={i}><b>팔수록 손해</b> {o.label || '이름 없는 옵션'} — {won(netOf(o))}원</div>)}
          {thin.map((o, i) => <div key={i} className="amber"><b>마진 5% 미만</b> {o.label || '이름 없는 옵션'} — {won(netOf(o))}원</div>)}
        </div>
      )}

      {/* ── 상세페이지 ────────────────────────────── */}
      <div className="xl-head"><Icon name="doc" />상세페이지</div>
      <table className="xl detail">
        <tbody>
          {DETAIL_SLOTS.map((d) => (
            <tr key={d.no} className={d.base ? 'base' : ''}>
              <th className="rowhead">
                <Icon name={DETAIL_ICON[d.no]} />상세페이지{d.no}
              </th>
              <td className="sub">{d.role}</td>
              <td className="fill">
                {d.base
                  ? <span className="basemark">기본 템플릿</span>
                  : <Auto value={plan.content.details[d.no] || ''}
                    onChange={(v) => edit((dr) => { dr.content.details[d.no] = v })} />}
              </td>
            </tr>
          ))}
          <tr>
            <th className="rowhead"><Icon name="folder" />사진 폴더</th>
            <td className="sub">저장 위치</td>
            <td className="fill"><input value={plan.assets.folder}
              placeholder="C:/Users/서현주/OneDrive/Desktop/팜데이자료/쿠팡/자료/…"
              onChange={(e) => edit((dr) => { dr.assets.folder = e.target.value })} /></td>
          </tr>
        </tbody>
      </table>

      {plan.content.notes.length > 0 && (
        <>
          <div className="xl-head"><Icon name="info" />엑셀에 적어두셨던 글</div>
          {plan.content.notes.map((n, i) => (
            <div key={i} className="xl-note">
              <Auto value={n} onChange={(v) => edit((d) => { d.content.notes[i] = v })} />
              <button className="x" onClick={() => edit((d) => { d.content.notes.splice(i, 1) })}>×</button>
            </div>
          ))}
        </>
      )}

      {plan.reviews.length > 0 && (
        <>
          <div className="xl-head"><Icon name="star" />리뷰 <span className="cnt">{plan.reviews.length}개</span></div>
          <div className="xl-reviews">
            {plan.reviews.map((r, i) => (
              <div key={i} className="xl-rv">
                <span className="st">{'★'.repeat(r.stars || 5)}</span>
                <span className="tx">{r.text}</span>
                {r.pick && <span className="pk">{r.pick}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const DETAIL_ICON: Record<number, 'truck' | 'sparkles' | 'star' | 'shield' | 'pin' | 'heart' | 'pot' | 'scale' | 'info' | 'refresh' | 'chat'> = {
  1: 'truck', 2: 'sparkles', 3: 'star', 4: 'shield', 5: 'pin', 6: 'heart',
  7: 'pot', 8: 'scale', 9: 'info', 10: 'refresh', 11: 'chat',
}
