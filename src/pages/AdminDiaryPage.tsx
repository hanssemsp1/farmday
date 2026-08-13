import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/adminConfig'
import { DiaryDay, emptyDay, fetchDiary, saveDay, deleteDay, todayKey, labelOf } from '../lib/sellerDiary'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import './AdminDiaryPage.css'

const won = (n: number | null) => (n === null || n === undefined ? '' : Number(n).toLocaleString())
const numOf = (s: string): number | null => {
  const t = s.replace(/[^\d.-]/g, '')
  if (!t.trim()) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const MOODS = ['😀 좋음', '🙂 그럭저럭', '😣 힘듦', '😤 답답', '🎉 뿌듯']

// 전자책에 값진 순서로 놓았다. 위에서부터 채우시면 된다.
const FIELDS: { key: keyof DiaryDay; icon: 'sparkles' | 'info' | 'shield' | 'chat' | 'star' | 'doc'
  label: string; hint: string; big?: boolean }[] = [
  { key: 'thoughts', icon: 'sparkles', label: '오늘의 생각', big: true,
    hint: '오늘 어땠는지 — 잘 안 풀린 것, 기뻤던 것, 그냥 든 생각' },
  { key: 'struggle', icon: 'info', label: '막혔던 것 · 실수',
    hint: '무엇을 몰라서 헤맸는지. 나중에 이게 제일 값진 내용이 됩니다' },
  { key: 'learned', icon: 'shield', label: '배운 것 · 해결법',
    hint: '어떻게 풀었는지. 다음에 같은 일이 생기면 볼 메모' },
  { key: 'feedback', icon: 'chat', label: '고객 반응',
    hint: '문의·리뷰·클레임. 손님이 실제로 뭘 궁금해했는지' },
  { key: 'tomorrow', icon: 'star', label: '내일 할 일', hint: '' },
  { key: 'etc', icon: 'doc', label: '기타', hint: '' },
]

export default function AdminDiaryPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [days, setDays] = useState<DiaryDay[]>([])
  const [loading, setLoading] = useState(true)
  const [cur, setCur] = useState<DiaryDay | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [onlyStar, setOnlyStar] = useState(false)

  useEffect(() => { if (!authLoading && !isAdmin(user)) navigate('/') }, [authLoading, user, navigate])

  useEffect(() => {
    if (!isAdmin(user)) return
    fetchDiary()
      .then((rows) => {
        setDays(rows)
        // 들어오면 바로 오늘 자리를 펴둔다 — 적는 데 걸림이 없어야 한다
        const t = todayKey()
        setCur(rows.find((r) => r.day === t) ?? emptyDay(t))
      })
      .catch((e) => setNotice('불러오지 못했습니다: ' + e.message))
      .finally(() => setLoading(false))
  }, [user])

  const list = useMemo(
    () => (onlyStar ? days.filter((d) => d.starred) : days),
    [days, onlyStar]
  )

  const total = useMemo(() => ({
    days: days.length,
    revenue: days.reduce((a, d) => a + (d.revenue || 0), 0),
    hours: days.reduce((a, d) => a + (d.hours || 0), 0),
    star: days.filter((d) => d.starred).length,
  }), [days])

  if (authLoading || !isAdmin(user)) return null

  function set<K extends keyof DiaryDay>(k: K, v: DiaryDay[K]) {
    setCur((p) => (p ? { ...p, [k]: v } : p))
    setDirty(true); setNotice('')
  }

  function openDay(d: DiaryDay) {
    if (dirty && !window.confirm('저장하지 않은 내용이 있습니다. 그냥 넘어갈까요?')) return
    setCur({ ...d }); setDirty(false); setNotice('')
  }

  function newDay() {
    const d = window.prompt('날짜 (예: 2026-08-12)', todayKey())?.trim()
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) { if (d) window.alert('2026-08-12 처럼 적어주세요.'); return }
    const found = days.find((x) => x.day === d)
    setCur(found ? { ...found } : emptyDay(d))
    setDirty(!found); setNotice('')
  }

  async function handleSave() {
    if (!cur) return
    setSaving(true)
    try {
      const saved = await saveDay(cur)
      setDays((prev) => [...prev.filter((d) => d.day !== saved.day), saved].sort((a, b) => b.day.localeCompare(a.day)))
      setCur(saved); setDirty(false); setNotice('저장했습니다.')
    } catch (e) { setNotice('저장 실패: ' + (e as Error).message) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!cur) return
    if (!window.confirm(`${labelOf(cur.day)} 기록을 지울까요?`)) return
    try {
      await deleteDay(cur.day)
      setDays((prev) => prev.filter((d) => d.day !== cur.day))
      setCur(emptyDay(todayKey())); setDirty(false); setNotice('지웠습니다.')
    } catch (e) { setNotice('삭제 실패: ' + (e as Error).message) }
  }

  // 전자책 쓸 때 쓰려고 통째로 내려받는다
  function download() {
    const lines = [...days].sort((a, b) => a.day.localeCompare(b.day)).map((d) => {
      const bits = [`## ${d.day} ${labelOf(d.day)}${d.starred ? ' ⭐' : ''}${d.mood ? ' · ' + d.mood : ''}`]
      const nums = [
        d.revenue !== null && `매출 ${won(d.revenue)}원`,
        d.orders !== null && `주문 ${d.orders}건`,
        d.adCost !== null && `광고비 ${won(d.adCost)}원`,
        d.spent !== null && `쓴 돈 ${won(d.spent)}원`,
        d.hours !== null && `${d.hours}시간`,
      ].filter(Boolean)
      if (nums.length) bits.push(nums.join(' · '))
      if (d.uploaded) bits.push(`**올린 상품** ${d.uploaded}`)
      if (d.sold) bits.push(`**팔린 상품** ${d.sold}`)
      FIELDS.forEach((f) => {
        const v = d[f.key] as string
        if (v?.trim()) bits.push(`**${f.label}**\n${v.trim()}`)
      })
      return bits.join('\n\n')
    })
    const md = `# 셀러 다이어리\n\n${total.days}일 기록 · 매출 합계 ${won(total.revenue)}원 · 일한 시간 ${total.hours}시간\n\n---\n\n${lines.join('\n\n---\n\n')}\n`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `셀러다이어리_${todayKey()}.md`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="container diary">
      <div className="dy-head">
        <div>
          <h1>셀러 다이어리</h1>
          <p>그날그날 적어두세요. 지금 겪는 것이 나중엔 기억나지 않습니다 — 이게 전자책의 재료가 됩니다.</p>
        </div>
        <Button onClick={newDay}>＋ 다른 날 적기</Button>
      </div>

      <div className="dy-stats">
        <div><b>{total.days}</b><span>일 기록</span></div>
        <div><b>{won(total.revenue)}</b><span>매출 합계</span></div>
        <div><b>{total.hours}</b><span>일한 시간</span></div>
        <div><b>{total.star}</b><span>⭐ 표시</span></div>
      </div>

      <div className="dy-body">
        <aside className="dy-side">
          <button className={`dy-filter ${onlyStar ? 'on' : ''}`} onClick={() => setOnlyStar((v) => !v)}>
            ⭐ 전자책에 넣을 날만
          </button>
          <div className="dy-list">
            {loading && <p className="dy-empty">불러오는 중…</p>}
            {!loading && !list.length && <p className="dy-empty">아직 적은 날이 없습니다.</p>}
            {list.map((d) => (
              <button key={d.day} className={`dy-row ${cur?.day === d.day ? 'on' : ''}`} onClick={() => openDay(d)}>
                <span className="dy-row-t">
                  {d.starred && <i className="star">⭐</i>}
                  <b>{labelOf(d.day)}</b>
                  {d.mood && <em>{d.mood.split(' ')[0]}</em>}
                </span>
                <span className="dy-row-s">
                  {[d.revenue !== null && `${won(d.revenue)}원`, d.uploaded, d.struggle && '막힌 것 있음']
                    .filter(Boolean).join(' · ') || '비어 있음'}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="dy-main">
          {cur && (
            <>
              <div className="dy-title">
                <Icon name="doc" />
                <h2>{labelOf(cur.day)}</h2>
                <span className="dy-date">{cur.day}</span>
                <button className={`dy-star ${cur.starred ? 'on' : ''}`} onClick={() => set('starred', !cur.starred)}
                  title="전자책에 꼭 넣을 날">⭐</button>
              </div>

              <div className="dy-mood">
                {MOODS.map((m) => (
                  <button key={m} className={cur.mood === m ? 'on' : ''}
                    onClick={() => set('mood', cur.mood === m ? '' : m)}>{m}</button>
                ))}
              </div>

              {/* 오늘의 숫자 */}
              <div className="dy-sec"><Icon name="chart" />오늘의 숫자</div>
              <div className="dy-nums">
                <label><span>매출</span>
                  <input value={won(cur.revenue)} placeholder="0" onChange={(e) => set('revenue', numOf(e.target.value))} />
                  <i>원</i></label>
                <label><span>주문</span>
                  <input value={cur.orders ?? ''} placeholder="0" onChange={(e) => set('orders', numOf(e.target.value))} />
                  <i>건</i></label>
                <label><span>광고비</span>
                  <input value={won(cur.adCost)} placeholder="0" onChange={(e) => set('adCost', numOf(e.target.value))} />
                  <i>원</i></label>
                <label><span>그 밖에 쓴 돈</span>
                  <input value={won(cur.spent)} placeholder="0" onChange={(e) => set('spent', numOf(e.target.value))} />
                  <i>원</i></label>
                <label><span>일한 시간</span>
                  <input value={cur.hours ?? ''} placeholder="0" onChange={(e) => set('hours', numOf(e.target.value))} />
                  <i>시간</i></label>
              </div>
              <p className="dy-why">
                시간과 돈은 초보가 제일 궁금해하는 것입니다 — <b>“이거 하는 데 얼마나 걸려요?”</b>
                겪은 사람만 답할 수 있어요.
              </p>

              {/* 무엇을 했나 */}
              <div className="dy-sec"><Icon name="box" />오늘 한 일</div>
              <div className="dy-grid">
                <label className="dy-f"><span>올린 상품</span>
                  <input value={cur.uploaded} placeholder="예: 돈마호크 (썸네일 5장 완성)"
                    onChange={(e) => set('uploaded', e.target.value)} /></label>
                <label className="dy-f"><span>팔린 상품</span>
                  <input value={cur.sold} placeholder="예: 성주참외 3kg 2건, 무화과 1건"
                    onChange={(e) => set('sold', e.target.value)} /></label>
              </div>

              {/* 적는 칸 */}
              <div className="dy-sec"><Icon name="sparkles" />오늘의 기록</div>
              {FIELDS.map((f) => (
                <div key={f.key} className={`dy-note ${f.big ? 'big' : ''}`}>
                  <div className="dy-note-h"><Icon name={f.icon} />{f.label}
                    {f.hint && <em>{f.hint}</em>}</div>
                  <Auto value={cur[f.key] as string} min={f.big ? 96 : 62}
                    onChange={(v) => set(f.key, v as never)} />
                </div>
              ))}
            </>
          )}
        </section>
      </div>

      <div className="dy-bar">
        <span className={dirty ? 'dirty' : ''}>
          {dirty ? '저장 안 됨'
            : cur?.updatedAt ? `마지막 저장 ${new Date(cur.updatedAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
        </span>
        {notice && <span className="dy-notice">{notice}</span>}
        <span className="sp" />
        <button className="dy-ghost danger" onClick={handleDelete}>삭제</button>
        <button className="dy-ghost" onClick={download}>전체 내려받기</button>
        <Button onClick={handleSave} disabled={!dirty || saving}>{saving ? '저장 중…' : '저장'}</Button>
      </div>
    </div>
  )
}

// 쓰는 만큼 칸이 늘어난다
function Auto({ value, onChange, min = 62 }: { value: string; onChange: (v: string) => void; min?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, min) + 'px'
  }, [value, min])
  return <textarea ref={ref} value={value} style={{ minHeight: min }} onChange={(e) => onChange(e.target.value)} />
}
