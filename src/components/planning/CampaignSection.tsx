import * as XLSX from 'xlsx'
import { useLayoutEffect, useRef } from 'react'

// 글이 길어지면 칸이 저절로 늘어난다 — 리뷰 문구는 서너 줄이 보통이라 잘리면 안 된다
function Grow({ value, onChange, placeholder, min = 44 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(el.scrollHeight, min) + 'px'
  }, [value, min])
  return (
    <textarea ref={ref} value={value} placeholder={placeholder} style={{ minHeight: min }}
      onChange={(e) => onChange(e.target.value)} />
  )
}
import type { ProductPlan, CampaignReview } from '../../types/productPlan'

// 체험단 — 두고애드에서 모집하고, 명단은 나중에 받는다.
// 여기서는 "무엇을 써달라고 할지"(문구·별점·사진)를 만들어 두고,
// 대표님이 쓰시던 리뷰양식.xlsx 모양 그대로 내려받는다.
export default function CampaignSection({
  plan, edit,
}: {
  plan: ProductPlan
  edit: (fn: (d: ProductPlan) => void) => void
}) {
  const c = plan.campaign || { option: '', count: 30, requestDate: '', note: '', reviews: [] }
  const rows = c.reviews || []

  const setC = (patch: Partial<typeof c>) =>
    edit((d) => { d.campaign = { ...d.campaign, ...patch } })

  const setRow = (i: number, patch: Partial<CampaignReview>) =>
    edit((d) => { d.campaign.reviews[i] = { ...d.campaign.reviews[i], ...patch } })

  // 체험단은 늘 가장 싼 옵션으로 돌린다 — 비워 두면 이 값이 들어간다
  const cheapest = (() => {
    const priced = (plan.options || []).filter((o) => o.price)
    if (!priced.length) return ''
    const o = priced.reduce((a, b) => ((b.price ?? 0) < (a.price ?? 0) ? b : a))
    return o.label || o.weight || ''
  })()
  const baseOption = c.option || cheapest

  // 작성요청날짜를 줄마다 나눠 넣는다 — 한날에 리뷰가 몰리면 티가 난다.
  // 시작 날짜부터 하루 perDay 건씩 순서대로.
  const spreadDates = () => {
    const start = c.requestDate
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { window.alert('시작 날짜를 먼저 고르세요.'); return }
    const per = Math.max(1, Number(c.perDay) || 3)
    edit((d) => {
      d.campaign.reviews = (d.campaign.reviews || []).map((r, i) => {
        const dt = new Date(start + 'T00:00:00')
        dt.setDate(dt.getDate() + Math.floor(i / per))
        const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), day = String(dt.getDate()).padStart(2, '0')
        return { ...r, date: `${y}-${m}-${day}` }
      })
    })
  }

  // 옵션을 하나 적으면 아래로 쭉 들어간다.
  // 따로 바꿔 둔 줄(이전 기본값과 다른 값)은 건드리지 않는다.
  const applyOption = (value: string, from: string) => edit((d) => {
    d.campaign.option = value
    d.campaign.reviews = (d.campaign.reviews || []).map((r) =>
      (!r.option || r.option === from || r.option === cheapest) ? { ...r, option: value } : r)
  })

  // 사진은 리뷰1 … 리뷰N 으로 저장해서 건네준다. 인원수만큼 고를 수 있게 준비해 둔다.
  const photoNames = Array.from(
    { length: Math.max(rows.length, Number(c.count) || 30) },
    (_, i) => `리뷰${i + 1}`,
  )
  // 예전에 만든 줄에는 같은 사진이 겹쳐 있을 수 있다 — 고르는 칸은 잠그고, 이미 겹친 건 알려준다
  const photoDupes = (() => {
    const seen = new Map<string, number>()
    rows.forEach((r) => { if (r.photo) seen.set(r.photo, (seen.get(r.photo) || 0) + 1) })
    return [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p)
  })()

  // 인원수만큼 빈 줄을 만든다. 별점은 5점만 몰리지 않게 4~5점을 섞는다.
  function makeRows() {
    const n = Math.max(1, Math.min(500, Number(c.count) || 30))
    edit((d) => {
      const keep = d.campaign.reviews || []
      const next: CampaignReview[] = []
      for (let i = 0; i < n; i++) {
        next.push(keep[i] ?? {
          stars: i % 4 === 3 ? 4 : 5,      // 넷 중 하나는 4점
          text: '',
          // 사진은 비워 둔다 — 있는 줄만 대표님이 고른다 (미리 채워 두면 헷갈린다)
          photo: '',
          option: baseOption,
        })
      }
      d.campaign.reviews = next
      if (!d.campaign.option && cheapest) d.campaign.option = cheapest
    })
  }

  const addRow = () => edit((d) => {
    const n = (d.campaign.reviews || []).length
    void n
    d.campaign.reviews = [...(d.campaign.reviews || []), { stars: 5, text: '', photo: '', option: baseOption }]
  })
  const delRow = (i: number) => edit((d) => { d.campaign.reviews.splice(i, 1) })

  // 같은 문구가 여러 개면 마켓이 어뷰징으로 잡는다 — 미리 알려준다
  const written = rows.filter((r) => r.text.trim())
  const dupes = (() => {
    const seen = new Map<string, number>()
    for (const r of written) {
      const k = r.text.trim().replace(/\s+/g, '')
      seen.set(k, (seen.get(k) || 0) + 1)
    }
    return [...seen.values()].filter((v) => v > 1).length
  })()

  // 대표님 리뷰양식 그대로 내려받기
  function download() {
    const head = ['NO', '작성요청날짜', '옵션', '제품명', '파일명', '이미지', '별점', '리뷰내용']
    const body = rows.map((r, i) => [
      i + 1,
      r.date || c.requestDate || '',
      r.option || baseOption,
      plan.coupang?.name || plan.id,
      r.photo || '',
      r.photo ? 'O' : 'X',
      `${r.stars}점`,
      r.text || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([head, ...body])
    ws['!cols'] = [{ wch: 5 }, { wch: 13 }, { wch: 16 }, { wch: 30 }, { wch: 10 }, { wch: 7 }, { wch: 7 }, { wch: 70 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '제품명')
    XLSX.writeFile(wb, `리뷰양식_${plan.id}.xlsx`)
  }

  return (
    <>
      <div className="xl-head"><span>🎁</span>체험단 <span className="cnt">{written.length}/{rows.length} 작성</span>
        {/* 예전에 만든 줄은 사진이 리뷰1…N 으로 미리 채워져 있다 — 한 번에 비운다 */}
        {rows.some((r) => r.photo) && (
          <button className="campmake" style={{ marginLeft: 'auto' }}
            onClick={() => edit((d) => { d.campaign.reviews = d.campaign.reviews.map((r) => ({ ...r, photo: '' })) })}>
            사진 선택 전부 비우기
          </button>
        )}
      </div>

      <table className="xl">
        <tbody>
          <tr>
            <th className="rowhead">모집 인원</th>
            <td className="fill campset">
              <input type="number" min={1} max={500} value={c.count ?? 30}
                onChange={(e) => setC({ count: Number(e.target.value) })} />
              <button className="campmake" onClick={makeRows}>이 인원수만큼 줄 만들기</button>
              <span className="hintx">두고애드 모집 인원에 맞춰 넣으세요</span>
            </td>
          </tr>
          <tr>
            <th className="rowhead">작성요청날짜</th>
            <td className="fill campset">
              <input type="date" className="date" value={c.requestDate}
                onChange={(e) => setC({ requestDate: e.target.value })} />
              <span className="hintx">부터 하루</span>
              <input type="number" min={1} max={50} value={c.perDay ?? 3} style={{ width: 56 }}
                onChange={(e) => setC({ perDay: Number(e.target.value) })} />
              <span className="hintx">건씩</span>
              <button className="campmake" onClick={spreadDates} disabled={!rows.length}>날짜 나눠 넣기</button>
              <span className="hintx">줄마다 날짜가 들어갑니다 — 한날에 몰리지 않게</span>
            </td>
          </tr>
          <tr>
            <th className="rowhead">기본 옵션</th>
            <td className="fill">
              <input value={c.option} list="camp-options"
                placeholder={cheapest ? `비우면 가장 싼 옵션 · ${cheapest}` : '예: 1kg 특대과'}
                onChange={(e) => applyOption(e.target.value, c.option || cheapest)} />
              <span className="hintx">여기 적으면 아래 줄에 다 들어갑니다</span>
              <datalist id="camp-options">
                {(plan.options || []).map((o, i) => (
                  <option key={i} value={o.label || o.weight} />
                ))}
              </datalist>
            </td>
          </tr>
          <tr>
            <th className="rowhead">전달 안내</th>
            <td className="fill">
              <Grow value={c.note} min={52}
                placeholder="예: 네이버리뷰는 10자 이상 / 이미지는 10MB 미만 jpg·png"
                onChange={(v) => setC({ note: v })} />
            </td>
          </tr>
        </tbody>
      </table>

      {(dupes > 0 || photoDupes.length > 0) && (
        <div className="xl-warn">
          {dupes > 0 && <div><b>같은 문구가 있어요</b> — {dupes}가지가 겹칩니다. 마켓이 어뷰징으로 잡을 수 있으니 다르게 고쳐주세요.</div>}
          {photoDupes.length > 0 && <div><b>같은 사진이 두 줄 이상에 있어요</b> — {photoDupes.join(', ')}. 한 줄만 남기고 바꿔주세요.</div>}
        </div>
      )}

      {rows.length > 0 && (
        <div className="xl-scroll">
          <table className="xl grid camp">
            <thead><tr>
              <th className="w1">NO</th><th className="wdate">요청날짜</th><th className="w2">별점</th><th className="wopt">옵션</th>
              <th className="wfile">사진 파일명</th><th className="l">리뷰내용</th><th className="w1" />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="w1 no">{i + 1}</td>
                  <td className="wdate"><input type="date" className="date" value={r.date || ''}
                    onChange={(e) => setRow(i, { date: e.target.value })} /></td>
                  <td className="w2">
                    <select value={r.stars} onChange={(e) => setRow(i, { stars: Number(e.target.value) })}>
                      <option value={5}>5점</option>
                      <option value={4}>4점</option>
                    </select>
                  </td>
                  {/* 첫 줄에 적으면 아래로 쭉 들어간다. 둘째 줄부터는 그 줄만 바뀐다 */}
                  <td className="wopt"><input value={r.option} placeholder={baseOption || '옵션'}
                    title={i === 0 ? '여기 적으면 아래 줄에 다 들어갑니다' : undefined}
                    onChange={(e) => i === 0
                      ? applyOption(e.target.value, r.option || baseOption)
                      : setRow(i, { option: e.target.value })} /></td>
                  {/* 사진은 리뷰1~리뷰N 으로 저장해 전달하므로 고르기만 하면 된다.
                      사진 없는 리뷰도 있으니 '없음'을 고를 수 있게 둔다. */}
                  <td className="wfile">
                    <select value={r.photo} onChange={(e) => setRow(i, { photo: e.target.value })}>
                      <option value="">— 없음 —</option>
                      {/* 다른 줄이 이미 고른 사진은 못 고르게 잠근다 — 같은 사진이 두 번 나가면 안 된다 */}
                      {photoNames.map((n) => {
                        const taken = rows.some((o, k) => k !== i && o.photo === n)
                        return <option key={n} value={n} disabled={taken}>{taken ? `${n} (다른 줄)` : n}</option>
                      })}
                      {r.photo && !photoNames.includes(r.photo) && <option value={r.photo}>{r.photo}</option>}
                    </select>
                  </td>
                  <td className="l"><Grow value={r.text} placeholder="이 사람이 쓸 리뷰 문구"
                    onChange={(v) => setRow(i, { text: v })} /></td>
                  <td className="w1"><button className="x" title="이 줄 지우기" onClick={() => delRow(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="camp-actions">
        <button className="xl-add" onClick={addRow}>＋ 한 줄 추가</button>
        {rows.length > 0 && (
          <button className="camp-dl" onClick={download}>⬇ 리뷰양식 내려받기 (.xlsx)</button>
        )}
      </div>
    </>
  )
}
