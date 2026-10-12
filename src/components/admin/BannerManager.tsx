import { useEffect, useRef, useState } from 'react'
import { fetchAllBanners, saveBanner, deleteBanner, emptyBanner, type SiteBanner } from '../../lib/siteBanners'
import { uploadPlanImage, deletePlanImage } from '../../lib/planImages'
import './BannerManager.css'

// 메인 배너 관리 — 사진을 올리고 글씨를 고친다.
// 사진이 없으면 지금 쓰던 색 배경이 그대로 나온다.
export default function BannerManager() {
  const [rows, setRows] = useState<SiteBanner[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    fetchAllBanners().then(setRows).catch((e) => setMsg('불러오지 못했습니다: ' + e.message))
  }, [])

  const patch = (id: string, p: Partial<SiteBanner>) =>
    setRows((prev) => prev.map((b) => (b.id === id ? { ...b, ...p } : b)))

  async function save(b: SiteBanner) {
    setBusy(true); setMsg('')
    try { await saveBanner(b); setMsg('저장했습니다.') }
    catch (e) { setMsg('저장 실패: ' + (e as Error).message) }
    finally { setBusy(false); setTimeout(() => setMsg(''), 3000) }
  }

  async function pickImage(b: SiteBanner, file: File) {
    setBusy(true); setMsg('')
    const r = await uploadPlanImage('banner', file)
    setBusy(false)
    if (r.error) { setMsg(r.error); return }
    if (!r.url) return
    const next = { ...b, image: r.url }
    patch(b.id, { image: r.url })
    await save(next)
  }

  async function clearImage(b: SiteBanner) {
    const old = b.image
    patch(b.id, { image: '' })
    await save({ ...b, image: '' })
    if (old) await deletePlanImage(old)
  }

  async function addRow() {
    const b = emptyBanner(rows.length + 1)
    setRows((p) => [...p, b])
    await save(b)
  }

  async function removeRow(b: SiteBanner) {
    if (!window.confirm('이 배너를 지울까요?')) return
    await deleteBanner(b.id)
    setRows((p) => p.filter((x) => x.id !== b.id))
    if (b.image) await deletePlanImage(b.image)
  }

  return (
    <section className="bm">
      <div className="bm-head">
        <div>
          <h2>메인 배너</h2>
          <p>사진을 올리면 메인 화면 맨 위가 바뀝니다. 사진이 없으면 지금 색 배경이 그대로 나와요.</p>
        </div>
        <button className="bm-add" onClick={addRow} disabled={busy}>＋ 배너 추가</button>
      </div>

      {msg && <p className="bm-msg">{msg}</p>}

      <div className="bm-list">
        {rows.map((b) => (
          <div className={`bm-card ${b.active ? '' : 'off'}`} key={b.id}>
            {/* 실제로 어떻게 보이는지 미리보기 */}
            <div className="bm-prev"
              style={b.image
                ? { backgroundImage: `linear-gradient(90deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.30) 55%,rgba(0,0,0,.10) 100%), url(${b.image})` }
                : { background: b.gradient }}>
              <span className="bm-eyebrow">{b.eyebrow}</span>
              <b>{b.title.split('\n')[0] || '(제목 없음)'}</b>
              <span className="bm-desc">{b.descr}</span>
            </div>

            <div className="bm-fields">
              <label>작은 윗글씨<input value={b.eyebrow} onChange={(e) => patch(b.id, { eyebrow: e.target.value })} /></label>
              <label className="wide">제목 <em>줄바꿈하려면 엔터</em>
                <textarea rows={2} value={b.title} onChange={(e) => patch(b.id, { title: e.target.value })} /></label>
              <label className="wide">설명<input value={b.descr} onChange={(e) => patch(b.id, { descr: e.target.value })} /></label>
              <label>버튼 글씨<input value={b.cta} onChange={(e) => patch(b.id, { cta: e.target.value })} /></label>
              <label>누르면 갈 곳<input value={b.link} placeholder="/best" onChange={(e) => patch(b.id, { link: e.target.value })} /></label>
              <label className="num">차례<input type="number" value={b.sort} onChange={(e) => patch(b.id, { sort: Number(e.target.value) })} /></label>
            </div>

            <div className="bm-act">
              <button className="bm-btn" onClick={() => fileRefs.current[b.id]?.click()} disabled={busy}>
                {b.image ? '📷 사진 바꾸기' : '📷 사진 올리기'}
              </button>
              {b.image && <button className="bm-btn ghost" onClick={() => clearImage(b)} disabled={busy}>사진 빼기</button>}
              <input ref={(el) => { fileRefs.current[b.id] = el }} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickImage(b, f); e.target.value = '' }} />

              <label className="bm-onoff">
                <input type="checkbox" checked={b.active} onChange={(e) => { patch(b.id, { active: e.target.checked }); save({ ...b, active: e.target.checked }) }} />
                켜기
              </label>

              <span className="bm-sp" />
              <button className="bm-btn danger" onClick={() => removeRow(b)} disabled={busy}>삭제</button>
              <button className="bm-save" onClick={() => save(b)} disabled={busy}>저장</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
