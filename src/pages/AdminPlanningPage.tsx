import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/adminConfig'
import { fetchPlans, savePlan, deletePlan } from '../lib/productPlans'
import {
  ProductPlan, PlanOption, PlanExtraDetail, PlanExtraThumb, PLAN_CATEGORIES, THUMB_SLOTS, DETAIL_SLOTS,
  DISCOUNTS, emptyPlan, netOf, listPriceOf, marginPriceOf, doneCount,
  TEMU_DEFAULT_MARGIN, temuPriceOf, temuShownOf, temuNetOf,
} from '../types/productPlan'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import PicStrip from '../components/planning/PicStrip'
import CampaignSection from '../components/planning/CampaignSection'
import ShippingSection from '../components/planning/ShippingSection'
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
const CAT_ICON: Record<string, 'leaf' | 'apple' | 'fish' | 'meat' | 'can' | 'gift'> = {
  야채: 'leaf', 과일: 'apple', 수산: 'fish', 축산: 'meat', 선물세트: 'gift', 식품: 'can',
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

  // 이 화면은 좌우 분할창이라 페이지 자체는 움직이면 안 된다.
  // (그냥 두면 맨 아래 푸터 때문에 페이지가 스크롤돼서, 칸이 아니라 페이지가 움직인다)
  // 좁은 화면에서는 위아래로 쌓이므로 CSS에서 다시 풀어준다.
  // 좌·우 칸을 마우스 휠로 굴린다.
  // CSS(overscroll-behavior)로 "페이지 대신 이 칸을 굴려달라"고 부탁하는 방식은
  // 대표님 환경에서 통하지 않았다(휠이 바깥 페이지로 새어나감).
  // 그래서 휠을 직접 받아 칸의 scrollTop 을 손으로 움직인다 — 브라우저 판단에 맡기지 않는다.
  // 콜백 ref 로 붙인다 — 칸이 화면에 나타나는 그 순간에 확실히 붙는다.
  // (useEffect + 의존성으로 붙이면 타이밍이 어긋나 안 붙는 경우가 있었다)
  const bindPane = useCallback((el: HTMLElement | null) => {
    if (!el || el.dataset.wheelBound === '1') return
    el.dataset.wheelBound = '1'
    el.addEventListener('wheel', (e: WheelEvent) => {
      const room = el.scrollHeight - el.clientHeight
      if (room <= 0) return // 굴릴 게 없으면 페이지에 맡긴다
      const before = el.scrollTop
      el.scrollTop = Math.max(0, Math.min(room, before + e.deltaY))
      if (el.scrollTop !== before) e.preventDefault() // 페이지가 따라 움직이지 않게
    }, { passive: false }) // passive:false 여야 preventDefault 가 먹는다
  }, [])

  // 이 화면에서만 쇼핑몰 카테고리줄·푸터를 감춘다 (바깥 스크롤을 없애려고)
  useEffect(() => {
    document.body.classList.add('plan-page')
    return () => document.body.classList.remove('plan-page')
  }, [])

  useEffect(() => {
    if (!isAdmin(user)) return
    fetchPlans()
      .then(setPlans)
      .catch((e) => setNotice('불러오지 못했습니다: ' + e.message))
      .finally(() => setLoading(false))
  }, [user])

  // ── 내가 정한 목록 차례 ──────────────────────────
  // 철이 아닌 상품이 위에 있으면 불편하다. 끌어서 옮긴 차례를 이 컴퓨터에 기억해 둔다.
  // (상품 자료는 건드리지 않는다 — 보는 차례만 바뀐다)
  const ORDER_KEY = 'farmday-plan-order'
  const [myOrder, setMyOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') } catch { return [] }
  })
  const saveOrder = (next: string[]) => {
    setMyOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch { /* 저장 못 해도 화면은 돌아간다 */ }
  }

  const list = useMemo(() => {
    const key = q.trim().toLowerCase()
    const order = (c: string) => { const i = PLAN_CATEGORIES.indexOf(c as never); return i < 0 ? 99 : i }
    const mine = new Map(myOrder.map((id, i) => [id, i]))
    return plans
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !key || (p.id + p.vendor.name + p.coupang.name).toLowerCase().includes(key))
      .sort((a, b) => {
        // 내가 옮겨둔 것이 먼저, 그 다음은 원래대로 카테고리 → 이름 차례
        const ia = mine.has(a.id) ? mine.get(a.id)! : Number.MAX_SAFE_INTEGER
        const ib = mine.has(b.id) ? mine.get(b.id)! : Number.MAX_SAFE_INTEGER
        if (ia !== ib) return ia - ib
        return order(a.category) - order(b.category) || a.id.localeCompare(b.id)
      })
  }, [plans, cat, q, myOrder])

  // 끌어놓기로 차례 바꾸기 — 걸러 보는 중이어도 전체 차례에서 옮긴다
  const [dragId, setDragId] = useState<string | null>(null)
  function moveBefore(fromId: string, toId: string) {
    if (fromId === toId) return
    const all = myOrder.length ? [...myOrder] : []
    // 아직 차례에 없는 상품은 지금 보이는 차례대로 채워 넣는다
    for (const p of list) if (!all.includes(p.id)) all.push(p.id)
    for (const p of plans) if (!all.includes(p.id)) all.push(p.id)
    const from = all.indexOf(fromId)
    if (from < 0) return
    all.splice(from, 1)
    const to = all.indexOf(toId)
    if (to < 0) return
    all.splice(to, 0, fromId)
    saveOrder(all)
  }

  // 맨 위로 — 철 맞는 상품을 한 번에 올린다. 상품이 몇백 개가 돼도 한 번이면 된다.
  function moveTop(id: string) {
    const first = list[0]?.id
    if (!first || first === id) return
    moveBefore(id, first)
  }

  // 끌어서 옮기기 — 브라우저 기본 끌기(HTML5 draggable)에 맡기면
  // 손잡이가 버튼이라 잡히지 않는다. 그래서 마우스 움직임을 직접 받아 처리한다.
  const dragFrom = useRef<string | null>(null)
  const dragOver = useRef<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  function startDrag(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    dragFrom.current = id
    dragOver.current = null
    setDragId(id)
    const move = (ev: MouseEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const wrap = el?.closest('[data-pid]') as HTMLElement | null
      const pid = wrap?.dataset.pid ?? null
      dragOver.current = pid
      setOverId(pid)
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const from = dragFrom.current, to = dragOver.current
      if (from && to && from !== to) moveBefore(from, to)
      dragFrom.current = null; dragOver.current = null
      setDragId(null); setOverId(null)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // ── 자동 저장 ──────────────────────────────────
  // 저장 버튼을 눌러야만 저장되던 때, 페이지가 죽으면서 적어둔 게 날아간 적이 있다.
  // 타이핑이 잠깐 멈추면 알아서 저장한다.
  // ⚠️ 아래 `return null` 보다 위에 있어야 한다 — React는 훅을 건너뛰면 안 된다.
  const timer = useRef<number | undefined>(undefined)
  const inFlight = useRef(false)

  // ── 되돌리기 ────────────────────────────────────
  // 자동 저장이라 잘못 지우면 그대로 저장돼 버린다. 그래서 고치기 직전 모습을 쌓아둔다.
  // 타이핑처럼 잇따른 고침은 하나로 묶는다 — 한 번 눌렀을 때 한 글자가 아니라
  // "방금 쓰던 덩어리"가 통째로 돌아와야 쓸모가 있다.
  const undoStack = useRef<ProductPlan[]>([])
  const redoStack = useRef<ProductPlan[]>([])
  const lastPush = useRef(0)
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  const rememberBefore = useCallback((before: ProductPlan) => {
    const now = Date.now()
    // 0.8초 안에 이어진 고침은 이미 쌓아둔 것으로 충분하다
    if (now - lastPush.current < 800 && undoStack.current.length) return
    lastPush.current = now
    undoStack.current.push(before)
    if (undoStack.current.length > 200) undoStack.current.shift()
    redoStack.current = []
    setUndoCount(undoStack.current.length)
    setRedoCount(0)
  }, [])

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

  // Ctrl+Z 되돌리기 / Ctrl+Shift+Z 다시실행.
  // 글자칸 안에서도 우리 되돌리기가 동작해야 한다 — 브라우저 기본 되돌리기는
  // 이미 저장된 뒤라 지워진 내용을 되살리지 못한다.
  const undoRef = useRef<() => void>(() => {})
  const redoRef = useRef<() => void>(() => {})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redoRef.current()
      else undoRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (authLoading || !isAdmin(user)) return null

  function edit(fn: (draft: ProductPlan) => void) {
    if (!cur) return
    rememberBefore(cur) // 고치기 직전 모습을 보관해 둔다
    const next = structuredClone(cur)
    fn(next)
    setCur(next)
    setDirty(true); setNotice('')
  }

  // 방금 한 고침을 되돌린다 (Ctrl+Z)
  function undo() {
    const before = undoStack.current.pop()
    if (!before || !cur) return
    redoStack.current.push(cur)
    lastPush.current = 0 // 다음 고침은 새 덩어리로 쌓이게
    setCur(before)
    setDirty(true)
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    setNotice('되돌렸습니다')
  }

  // 되돌린 것을 다시 실행한다 (Ctrl+Shift+Z)
  function redo() {
    const next = redoStack.current.pop()
    if (!next || !cur) return
    undoStack.current.push(cur)
    lastPush.current = 0
    setCur(next)
    setDirty(true)
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    setNotice('다시 실행했습니다')
  }

  // 단축키가 늘 최신 함수를 부르도록 연결해 둔다
  undoRef.current = undo
  redoRef.current = redo

  function openPlan(p: ProductPlan) {
    // 넘어가기 전에 적던 것을 마저 저장한다
    window.clearTimeout(timer.current)
    if (dirty && cur) persist(cur)
    // 다른 상품으로 넘어가면 되돌리기 기록도 새로 시작한다
    undoStack.current = []; redoStack.current = []; lastPush.current = 0
    setUndoCount(0); setRedoCount(0)
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

  // 제목(=상품 이름)은 저장소의 열쇠라서, 바꾸려면 새 이름으로 옮겨 담고 옛 이름을 지운다.
  // 순서가 중요하다 — 먼저 새 이름으로 저장해 두고, 성공한 뒤에만 옛 것을 지운다.
  // 기획서 통째로 복사 — 품종만 다르고 내용은 거의 같은 상품이 많다.
  // (햇알밤 → 옥광밤처럼) 썸네일·상세를 다시 쓰지 않고, 이름만 바꿔 옵션·가격만 고치면 된다.
  async function duplicatePlan(src: ProductPlan) {
    // 지금 열어둔 것을 복사하는 경우엔 화면의 최신 내용을 쓴다
    const base = cur && cur.id === src.id ? cur : src
    const next = window.prompt(`「${base.id}」를 복사합니다.\n새 상품 이름을 지어주세요.`, base.id + ' 복사')?.trim()
    if (!next) return
    if (plans.some((p) => p.id === next)) {
      window.alert(`「${next}」는 이미 있는 이름이에요. 다른 이름으로 해주세요.`)
      return
    }
    // 적던 것이 있으면 먼저 저장하고 넘어간다
    window.clearTimeout(timer.current)
    if (dirty && cur) await persist(cur)

    setSaving(true)
    try {
      const copy: ProductPlan = { ...structuredClone(base), id: next }
      const saved = await savePlan(copy)
      setPlans((prev) => [...prev.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.id.localeCompare(b.id)))
      // 복사본을 바로 열어준다 (되돌리기 기록은 새로 시작)
      undoStack.current = []; redoStack.current = []; lastPush.current = 0
      setUndoCount(0); setRedoCount(0)
      setCur(saved); setDirty(false)
      setNotice(`「${next}」로 복사했어요. 옵션·가격만 고치시면 됩니다.`)
    } catch (e) {
      setNotice('복사 실패: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function renamePlan() {
    if (!cur) return
    const next = window.prompt('상품 이름 바꾸기', cur.id)?.trim()
    if (!next || next === cur.id) return
    if (plans.some((p) => p.id === next)) {
      window.alert(`「${next}」는 이미 있는 이름이에요. 다른 이름으로 해주세요.`)
      return
    }
    window.clearTimeout(timer.current) // 자동 저장이 옛 이름으로 되살리지 않게
    const oldId = cur.id
    setSaving(true)

    // ① 새 이름으로 저장 — 여기서 실패하면 아무것도 건드리지 않은 상태 그대로다
    let saved: ProductPlan
    try {
      saved = await savePlan({ ...cur, id: next })
    } catch (e) {
      setNotice('이름 바꾸기 실패(저장 단계): ' + (e as Error).message)
      setSaving(false)
      return
    }

    // ② 저장됐으니 옛 이름 삭제. 이게 실패해도 자료는 새 이름에 안전하게 남아 있다
    let oldRemoved = true
    try {
      await deletePlan(oldId)
    } catch {
      oldRemoved = false
    }

    setPlans((prev) => {
      const rest = prev.filter((p) => p.id !== next && (oldRemoved ? p.id !== oldId : true))
      return [...rest, saved].sort((a, b) => a.id.localeCompare(b.id))
    })
    setCur(saved)
    setDirty(false)
    setNotice(
      oldRemoved
        ? `이름을 「${next}」로 바꿨습니다.`
        : `「${next}」로 저장했어요. 다만 옛 이름 「${oldId}」이 남아 있으니 목록에서 ×로 지워주세요.`,
    )
    setSaving(false)
  }

  // 목록에서도, 아래 바에서도 쓴다 — 열지 않은 상품도 바로 지울 수 있게
  async function removePlan(target: ProductPlan) {
    if (!window.confirm(`「${target.id}」를 지울까요? 되돌릴 수 없습니다.`)) return
    // 지금 열어둔 것을 지울 때만 자동 저장을 멈춘다 (다른 상품 편집분은 지켜야 하므로)
    if (cur?.id === target.id) window.clearTimeout(timer.current)
    try {
      await deletePlan(target.id)
      setPlans((prev) => prev.filter((p) => p.id !== target.id))
      if (cur?.id === target.id) { setCur(null); setDirty(false) }
      setNotice('지웠습니다.')
    } catch (e) { setNotice('삭제 실패: ' + (e as Error).message) }
  }

  async function handleDelete() {
    if (cur) await removePlan(cur)
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
        <aside className="plan-side" ref={bindPane}>
          <input className="plan-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="상품·업체 검색" />
          <div className="plan-cats">
            <button className={cat === '' ? 'on' : ''} onClick={() => setCat('')}>전체 {plans.length}</button>
            {PLAN_CATEGORIES.map((c) => (
              <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                <Icon name={CAT_ICON[c]} /> {c} {plans.filter((p) => p.category === c).length}
              </button>
            ))}
          </div>
          {myOrder.length > 0 && (
            <button className="order-reset" onClick={() => saveOrder([])}
              title="끌어서 바꾼 차례를 지우고 원래대로 되돌립니다">
              차례 원래대로
            </button>
          )}
          <div className="plan-list">
            {loading && <p className="plan-empty">불러오는 중…</p>}
            {!loading && !list.length && <p className="plan-empty">아직 등록한 상품이 없습니다.</p>}
            {list.map((p) => {
              const d = doneCount(p)
              return (
                <div key={p.id} data-pid={p.id}
                  className={`plan-row-wrap ${dragId === p.id ? 'dragging' : ''} ${overId === p.id && dragId !== p.id ? 'over' : ''}`}>
                  {/* 차례 바꾸기 — 맨 위로 한 번에, 또는 손잡이를 잡고 끌어서 */}
                  <span className="plan-row-move">
                    <button className="mv" title="맨 위로 올리기" aria-label="맨 위로 올리기"
                      onClick={() => moveTop(p.id)}>⤒</button>
                    <button className="mv grip" title="잡고 끌어서 옮기기" aria-label="끌어서 옮기기"
                      onMouseDown={(e) => startDrag(e, p.id)}>⠿</button>
                  </span>
                  <button className={`plan-row ${cur?.id === p.id ? 'on' : ''}`}
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
                  {/* 목록에서 바로 지우기 — 상품을 열지 않아도 된다 */}
                  <button className="plan-row-del" title={`${p.id} 지우기`} aria-label="이 상품 지우기"
                    onClick={() => removePlan(p)}>×</button>
                </div>
              )
            })}
          </div>
        </aside>

        <section className="plan-main" ref={bindPane}>
          {!cur && (
            <div className="plan-blank">
              <b>상품 하나를 고르거나, 새로 등록하세요</b>
              <p>양식은 엑셀에 쓰시던 그대로입니다.</p>
              <Button onClick={startNew}>＋ 상품 등록</Button>
            </div>
          )}
          {cur && <PlanSheet plan={cur} edit={edit} onRename={renamePlan} onDuplicate={() => duplicatePlan(cur)} />}
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
          <button className="plan-ghost undo" onClick={undo} disabled={undoCount === 0}
            title="방금 고친 것을 되돌립니다 (Ctrl+Z)">
            ↶ 되돌리기{undoCount > 0 && <em>{undoCount}</em>}
          </button>
          <button className="plan-ghost undo" onClick={redo} disabled={redoCount === 0}
            title="되돌린 것을 다시 실행합니다 (Ctrl+Shift+Z)">
            ↷ 다시
          </button>
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
function PlanSheet({ plan, edit, onRename, onDuplicate }: { plan: ProductPlan; edit: (fn: (d: ProductPlan) => void) => void; onRename: () => void; onDuplicate: () => void }) {
  const done = doneCount(plan)

  const avg = (w: string) => {
    const v = plan.competitors.rows.map((r) => r.prices?.[w]).filter((x): x is number => Number(x) > 0)
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
  }
  // 상세페이지 차례 — 정해진 11장 사이사이에 더 넣은 장을 끼워 넣는다.
  // (예: 구매 전 안내 뒤, 반품·교환 안내 앞에 포장·배송 안내)
  type DetailRow =
    | { kind: 'fixed'; slot: typeof DETAIL_SLOTS[number] }
    | { kind: 'extra'; extra: PlanExtraDetail; idx: number }
  const extras = plan.content.extras || []
  const detailRows: DetailRow[] = []
  DETAIL_SLOTS.forEach((slot) => {
    detailRows.push({ kind: 'fixed', slot })
    extras.forEach((extra, idx) => {
      if (extra.after === slot.no) detailRows.push({ kind: 'extra', extra, idx })
    })
  })
  // 자리를 안 정한 것은 맨 뒤에
  extras.forEach((extra, idx) => {
    if (!DETAIL_SLOTS.some((s) => s.no === extra.after)) detailRows.push({ kind: 'extra', extra, idx })
  })

  // 썸네일 차례 — 정해진 5장 사이사이에 더 넣은 컷을 끼워 넣는다 (상세페이지와 같은 방식)
  type ThumbRow =
    | { kind: 'fixed'; slot: typeof THUMB_SLOTS[number] }
    | { kind: 'extra'; extra: PlanExtraThumb; idx: number }
  const thumbExtras = plan.content.thumbExtras || []
  const thumbRows: ThumbRow[] = []
  THUMB_SLOTS.forEach((slot) => {
    thumbRows.push({ kind: 'fixed', slot })
    thumbExtras.forEach((extra, idx) => {
      if (extra.after === slot.key) thumbRows.push({ kind: 'extra', extra, idx })
    })
  })
  // 자리를 안 정한 것은 맨 뒤에
  thumbExtras.forEach((extra, idx) => {
    if (!THUMB_SLOTS.some((s) => s.key === extra.after)) thumbRows.push({ kind: 'extra', extra, idx })
  })

  // ── 써 놓은 내용을 위/아래로 옮기기 ────────────────
  // 칸 자체를 옮기는 게 아니라 "칸에 든 글"을 맞바꾼다.
  // 그래야 정해진 자리(배송안내 1번 등)는 그대로 두고 내용만 자리를 바꿀 수 있다.
  const thumbTextOf = (r: ThumbRow) =>
    r.kind === 'fixed' ? (plan.content.thumbs[r.slot.key]?.hook || '') : r.extra.hook
  const setThumbText = (d: ProductPlan, r: ThumbRow, v: string) => {
    if (r.kind === 'fixed') d.content.thumbs[r.slot.key] = { ...d.content.thumbs[r.slot.key], hook: v }
    else d.content.thumbExtras[r.idx].hook = v
  }
  function moveThumb(order: number, dir: -1 | 1) {
    const j = order + dir
    if (j < 0 || j >= thumbRows.length) return
    const a = thumbRows[order], b = thumbRows[j]
    const va = thumbTextOf(a), vb = thumbTextOf(b)
    edit((d) => { setThumbText(d, a, vb); setThumbText(d, b, va) })
  }

  const detailTextOf = (r: DetailRow) =>
    r.kind === 'fixed' ? (plan.content.details[r.slot.no] || '') : r.extra.text
  const setDetailText = (d: ProductPlan, r: DetailRow, v: string) => {
    if (r.kind === 'fixed') d.content.details[r.slot.no] = v
    else d.content.extras[r.idx].text = v
  }
  function moveDetail(order: number, dir: -1 | 1) {
    const j = order + dir
    if (j < 0 || j >= detailRows.length) return
    const a = detailRows[order], b = detailRows[j]
    // 기본 템플릿 자리(배송·반품·카카오)는 글을 넣는 칸이 아니라 건너뛴다
    if ((a.kind === 'fixed' && a.slot.base) || (b.kind === 'fixed' && b.slot.base)) return
    const va = detailTextOf(a), vb = detailTextOf(b)
    edit((d) => { setDetailText(d, a, vb); setDetailText(d, b, va) })
  }

  const bad = plan.options.filter((o) => { const n = netOf(o); return n !== null && n < 0 })
  const thin = plan.options.filter((o) => { const n = netOf(o); const b = marginPriceOf(o); return n !== null && n >= 0 && b && n < b * 0.05 })

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
        <button className="sheet-rename" onClick={onRename} title="상품 이름 바꾸기">제목 수정</button>
        <button className="sheet-rename" onClick={onDuplicate} title="이 기획서를 통째로 복사합니다 (썸네일·상세 그대로)">⧉ 복사해서 새 상품</button>
        <span className="sheet-done">{done}<em>/6</em></span>
      </div>

      {/* ── 상품명 · 카테고리 · 태그 · 옵션ID ─────────── */}
      <table className="xl">
        <tbody>
          {thumbRows.map((r, order) => (
            <tr key={r.kind === 'fixed' ? `f${r.slot.key}` : `x${r.idx}`}
              className={r.kind === 'extra' ? 'added' : ''}>
              {order === 0 && (
                <th className="rowhead" rowSpan={thumbRows.length}><Icon name="image" />상품명</th>
              )}
              {r.kind === 'fixed' ? (
                <>
                  {/* 이름 대신 번호만 — 자리에 다른 내용을 넣어도 헷갈리지 않게.
                      원래 역할은 빈칸일 때만 회색 안내로 보인다. */}
                  <td className="sub">
                    <Icon name="image" />썸네일{order + 1}
                    <span className="movebtns">
                      <button className="mvv" title="쓴 내용을 위 칸과 바꾸기" disabled={order === 0}
                        onClick={() => moveThumb(order, -1)}>▲</button>
                      <button className="mvv" title="쓴 내용을 아래 칸과 바꾸기" disabled={order === thumbRows.length - 1}
                        onClick={() => moveThumb(order, 1)}>▼</button>
                    </span>
                    <button className="addhere" title="이 아래에 컷 하나 넣기"
                      onClick={() => edit((d) => {
                        d.content.thumbExtras = d.content.thumbExtras || []
                        d.content.thumbExtras.push({ role: '', hook: '', after: r.slot.key })
                      })}>＋</button>
                  </td>
                  <td className="fill">
                    <Auto className="strong" value={plan.content.thumbs[r.slot.key]?.hook || ''}
                      placeholder={r.slot.key === 'main' ? '1~5등을 보고 우리 문구를 정합니다' : r.slot.guide}
                      onChange={(v) => edit((d) => { d.content.thumbs[r.slot.key] = { ...d.content.thumbs[r.slot.key], hook: v } })} />
                    <PicStrip planId={plan.id} pics={plan.content.pics?.[r.slot.key] || []}
                      onChange={(next) => edit((d) => { d.content.pics = d.content.pics || {}; d.content.pics[r.slot.key] = next })} />
                  </td>
                </>
              ) : (
                <>
                  <td className="sub">
                    <Icon name="image" />썸네일{order + 1}
                    <span className="movebtns">
                      <button className="mvv" title="쓴 내용을 위 칸과 바꾸기" disabled={order === 0}
                        onClick={() => moveThumb(order, -1)}>▲</button>
                      <button className="mvv" title="쓴 내용을 아래 칸과 바꾸기" disabled={order === thumbRows.length - 1}
                        onClick={() => moveThumb(order, 1)}>▼</button>
                    </span>
                    <button className="rmx" title="이 컷 지우기"
                      onClick={() => edit((d) => { d.content.thumbExtras.splice(r.idx, 1) })}>×</button>
                  </td>
                  <td className="fill">
                    <Auto className="strong" value={r.extra.hook} placeholder="이 컷에 넣을 문구"
                      onChange={(v) => edit((d) => { d.content.thumbExtras[r.idx].hook = v })} />
                    <PicStrip planId={plan.id} pics={plan.content.pics?.['tx' + r.idx] || []}
                      onChange={(next) => edit((d) => { d.content.pics = d.content.pics || {}; d.content.pics['tx' + r.idx] = next })} />
                  </td>
                </>
              )}
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
              <select className="catsel" value={plan.category} onChange={(e) => edit((d) => { d.category = e.target.value })}>
                <option value="">—</option>
                {PLAN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input value={plan.season.join(', ')} placeholder="제철 (예: 6월, 7월)"
                onChange={(e) => edit((d) => { d.season = e.target.value.split(/[,·]/).map((s) => s.trim()).filter(Boolean) })} />
              <input className="vendorcell" value={plan.vendor.name} placeholder="업체명"
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
            <th className="l">상품옵션명</th><th>중량</th><th>공급가</th>
            <th title="쿠폰적용값 — 정상가 계산에 씁니다">판매가</th>
            <th title="실제 팔리는 값 — 마진율·마진액 계산에 씁니다">실제판매가</th>
            <th>쿠팡수수료</th><th>택배비</th><th className="auto-th">마진율</th><th className="auto-th">마진액</th>
            <th>할인율</th><th className="auto-th">정상가</th><th className="w1" />
          </tr></thead>
          <tbody>
            {plan.options.map((o, i) => {
              const n = netOf(o)
              const mBase = marginPriceOf(o)
              const pct = n !== null && n >= 0 && mBase ? (n / mBase * 100).toFixed(1) + '%' : '—'
              const cls = n !== null && n < 0 ? 'bad' : (n !== null && mBase && n < mBase * 0.05 ? 'thin' : '')
              const set = (k: keyof PlanOption, v: unknown) => edit((d) => { (d.options[i] as never)[k] = v as never })
              return (
                <tr key={i} className={cls}>
                  <td className="l"><input value={o.label} onChange={(e) => set('label', e.target.value)} /></td>
                  <td><input value={o.weight} placeholder="600g" onChange={(e) => set('weight', e.target.value)} /></td>
                  <td><input value={won(o.cost)} onChange={(e) => set('cost', numOf(e.target.value))} /></td>
                  <td><input value={won(o.price)} onChange={(e) => set('price', numOf(e.target.value))} /></td>
                  <td><input className="real" value={won(o.realPrice)} placeholder={o.price ? won(o.price) : ''}
                    onChange={(e) => set('realPrice', numOf(e.target.value))} /></td>
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
                  <td className="w1"><button className="x" title="이 옵션 줄 지우기" aria-label="이 옵션 지우기" onClick={() => edit((d) => { d.options.splice(i, 1) })}>×</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button className="xl-add" onClick={() => edit((d) => {
        d.options.push({ label: '', weight: '', cost: null, price: null, realPrice: null, listPrice: null, discount: null, fee: 0.12, shipping: 0, note: '' })
      })}>＋ 옵션 추가</button>

      {(bad.length > 0 || thin.length > 0) && (
        <div className="xl-warn">
          {bad.map((o, i) => <div key={i}><b>팔수록 손해</b> {o.label || '이름 없는 옵션'} — {won(netOf(o))}원</div>)}
          {thin.map((o, i) => <div key={i} className="amber"><b>마진 5% 미만</b> {o.label || '이름 없는 옵션'} — {won(netOf(o))}원</div>)}
        </div>
      )}

      {/* ── 테무 단가표 ────────────────────────────────
          옵션·공급가는 위 표에서 가져온다. 여기서는 배송비·수익률만 정하면
          판매단가(내가 올릴 값)와 테무 노출가(손님이 보는 값, +7.5%)가 나온다. */}
      {plan.options.length > 0 && (
        <>
          <div className="xl-head"><Icon name="won" />테무 단가표
            <span className="xl-head-sub">공급가+배송비에서 수익률만큼 남게 판매단가를 정하고, 테무가 7.5%를 얹어 보여줍니다</span>
          </div>
          <div className="xl-scroll">
            <table className="xl grid temu">
              <thead><tr>
                <th className="l">상품옵션명</th><th>공급가</th>
                <th title="비우면 위 택배비를 씁니다">배송비</th>
                <th title="판매단가에서 남는 비율 — 쿠팡 마진율과 같은 셈법">수익률</th>
                <th className="auto-th" title="테무에 올릴 값. 직접 정하려면 적으세요">판매단가</th>
                <th className="auto-th">남는 돈</th>
                <th className="auto-th" title="손님에게 보이는 값 = 판매단가 × 1.075">테무 노출가</th>
                <th className="auto-th" title="위 표의 실제판매가(없으면 판매가)">쿠팡 판매가</th>
              </tr></thead>
              <tbody>
                {plan.options.map((o, i) => {
                  const price = temuPriceOf(o)
                  const shown = temuShownOf(o)
                  const net = temuNetOf(o)
                  const coupang = marginPriceOf(o)
                  const diff = shown != null && coupang ? shown - coupang : null
                  const setT = (k: 'shipping' | 'margin' | 'price', v: number | null) =>
                    edit((d) => { d.options[i].temu = { ...(d.options[i].temu || {}), [k]: v } })
                  return (
                    <tr key={i} className={net != null && net < 0 ? 'bad' : ''}>
                      <td className="l auto">{o.label || <i className="dim">이름 없는 옵션</i>}{o.weight && <span className="dim"> · {o.weight}</span>}</td>
                      <td className="auto">{won(o.cost) || '—'}</td>
                      <td><input value={o.temu?.shipping != null ? won(o.temu.shipping) : ''} placeholder={won(o.shipping) || '0'}
                        onChange={(e) => setT('shipping', numOf(e.target.value))} /></td>
                      <td><input value={pctText(o.temu?.margin ?? TEMU_DEFAULT_MARGIN)} placeholder="15%"
                        onChange={(e) => { const v = numOf(e.target.value); setT('margin', v === null ? null : (v > 1 ? v / 100 : v)) }} /></td>
                      <td><input className={o.temu?.price ? 'real' : ''} value={o.temu?.price ? won(o.temu.price) : ''}
                        placeholder={price != null ? won(price) : '—'} title="비우면 수익률로 계산한 값을 씁니다"
                        onChange={(e) => setT('price', numOf(e.target.value))} /></td>
                      <td className={`auto net ${net != null && net < 0 ? 'bad' : ''}`}>{net == null ? '—' : won(net)}</td>
                      <td className="auto strong">{shown == null ? '—' : won(shown)}</td>
                      <td className="auto">{coupang ? won(coupang) : '—'}
                        {diff != null && diff !== 0 && <span className={`diff ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '+' : ''}{won(diff)}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="xl-hint">
            공급가·택배비를 바꾸면 여기도 같이 바뀝니다. 테무는 지금 수수료 0%라 남는 돈 = 판매단가 − 공급가 − 배송비입니다.
            쿠팡과 값을 맞추려면 <b>테무 노출가</b>가 쿠팡 판매가와 같아지도록 판매단가를 적으세요.
          </p>
        </>
      )}

      {/* ── 상세페이지 ────────────────────────────── */}
      <div className="xl-head"><Icon name="doc" />상세페이지</div>
      <table className="xl detail">
        <tbody>
          {detailRows.map((r, order) => r.kind === 'fixed' ? (
            <tr key={`f${r.slot.no}`} className={r.slot.base ? 'base' : ''}>
              <th className="rowhead">
                <Icon name={DETAIL_ICON[r.slot.no]} />상세페이지{order + 1}
                {/* 기본 템플릿 자리는 글을 넣는 칸이 아니라 옮기기 버튼을 두지 않는다 */}
                {!r.slot.base && (
                  <span className="movebtns">
                    <button className="mvv" title="쓴 내용을 위 칸과 바꾸기"
                      disabled={order === 0 || (detailRows[order - 1].kind === 'fixed' && (detailRows[order - 1] as { kind: 'fixed'; slot: typeof DETAIL_SLOTS[number] }).slot.base)}
                      onClick={() => moveDetail(order, -1)}>▲</button>
                    <button className="mvv" title="쓴 내용을 아래 칸과 바꾸기"
                      disabled={order === detailRows.length - 1 || (detailRows[order + 1].kind === 'fixed' && (detailRows[order + 1] as { kind: 'fixed'; slot: typeof DETAIL_SLOTS[number] }).slot.base)}
                      onClick={() => moveDetail(order, 1)}>▼</button>
                  </span>
                )}
                <button className="addhere" title="이 아래에 한 장 넣기"
                  onClick={() => edit((d) => {
                    d.content.extras = d.content.extras || []
                    d.content.extras.push({ role: '', text: '', after: r.slot.no })
                  })}>＋</button>
              </th>
              {/* 정해진 역할 이름은 빼고 번호만 — 다른 내용을 넣어도 헷갈리지 않게.
                  역할·힌트는 빈칸일 때만 회색 안내로 보인다. */}
              <td className="fill" colSpan={2}>
                {r.slot.base
                  ? <span className="basemark">기본 템플릿 · {r.slot.role}</span>
                  : <>
                    <Auto value={plan.content.details[r.slot.no] || ''}
                      placeholder={`${r.slot.role}${r.slot.hint ? ` — ${r.slot.hint}` : ''}`}
                      onChange={(v) => edit((dr) => { dr.content.details[r.slot.no] = v })} />
                    <PicStrip planId={plan.id} pics={plan.content.pics?.['d' + r.slot.no] || []}
                      onChange={(next) => edit((d) => { d.content.pics = d.content.pics || {}; d.content.pics['d' + r.slot.no] = next })} />
                  </>}
              </td>
            </tr>
          ) : (
            <tr key={`x${r.idx}`} className="added">
              <th className="rowhead">
                <Icon name="doc" />상세페이지{order + 1}
                <span className="movebtns">
                  <button className="mvv" title="쓴 내용을 위 칸과 바꾸기"
                    disabled={order === 0 || (detailRows[order - 1].kind === 'fixed' && (detailRows[order - 1] as { kind: 'fixed'; slot: typeof DETAIL_SLOTS[number] }).slot.base)}
                    onClick={() => moveDetail(order, -1)}>▲</button>
                  <button className="mvv" title="쓴 내용을 아래 칸과 바꾸기"
                    disabled={order === detailRows.length - 1 || (detailRows[order + 1].kind === 'fixed' && (detailRows[order + 1] as { kind: 'fixed'; slot: typeof DETAIL_SLOTS[number] }).slot.base)}
                    onClick={() => moveDetail(order, 1)}>▼</button>
                </span>
                <button className="rmx" title="이 장 지우기"
                  onClick={() => edit((d) => { d.content.extras.splice(r.idx, 1) })}>×</button>
              </th>
              <td className="fill" colSpan={2}>
                <Auto value={r.extra.text} placeholder="이 장에 넣을 내용"
                  onChange={(v) => edit((d) => { d.content.extras[r.idx].text = v })} />
                <PicStrip planId={plan.id} pics={plan.content.pics?.['ex' + r.idx] || []}
                  onChange={(next) => edit((d) => { d.content.pics = d.content.pics || {}; d.content.pics['ex' + r.idx] = next })} />
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

      {/* ── 체험단 ────────────────────────────────── */}
      <CampaignSection plan={plan} edit={edit} />
      <ShippingSection plan={plan} edit={edit} />

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
