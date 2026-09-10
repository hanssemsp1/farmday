import { useRef, useState } from 'react'
import { uploadPlanImage, deletePlanImage } from '../../lib/planImages'
import { fixLogo } from '../../lib/logoImage'
import type { SiteSettings } from '../../types/settings'
import './BannerManager.css'

type Key = 'logoHeader' | 'logoFooter'

// 로고 — 위쪽(흰 바탕)과 아래쪽(남색 바탕)을 따로 둔다.
// 안 올리면 지금처럼 글자(Farmday.)가 그대로 나온다.
//
// 아래쪽은 바탕이 어두워서, 흰 바탕에 짙은 글자로 만든 로고를 그냥 올리면
// 흰 네모가 얹히거나 글자가 안 보인다. 그래서 올릴 때 손질해 준다.
export default function LogoManager({
  form, setForm,
}: {
  form: SiteSettings
  setForm: (next: SiteSettings) => void
}) {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [cutWhite, setCutWhite] = useState<Record<Key, boolean>>({ logoHeader: false, logoFooter: true })
  const [toWhite, setToWhite] = useState(true)
  const refs = useRef<Record<string, HTMLInputElement | null>>({})

  async function pick(key: Key, file: File) {
    setBusy(key); setMsg('')
    const fixed = await fixLogo(file, {
      cutWhite: cutWhite[key],
      toWhite: key === 'logoFooter' && toWhite,
    })
    const r = await uploadPlanImage('logo', fixed)
    setBusy('')
    if (r.error) { setMsg(r.error); return }
    if (r.url) {
      setForm({ ...form, [key]: r.url })
      setMsg('올렸어요. 미리보기를 확인하고 아래 「저장」을 눌러야 사이트에 반영됩니다.')
    }
  }

  async function clear(key: Key) {
    const old = form[key]
    setForm({ ...form, [key]: '' })
    setMsg('뺐어요. 아래 「저장」을 눌러야 반영됩니다.')
    if (old) await deletePlanImage(old)
  }

  const slots = [
    { key: 'logoHeader' as const, name: '위쪽 로고', hint: '흰 바탕 — 동그란 로고', dark: false },
    { key: 'logoFooter' as const, name: '아래쪽 로고', hint: '남색 바탕 — 가로로 긴 로고', dark: true },
  ]

  return (
    <section className="bm">
      <div className="bm-head">
        <div>
          <h2>로고</h2>
          <p>안 올리면 지금처럼 글자(Farmday.)가 나옵니다. 높이 <b>120px 이상</b>이면 선명해요.
            아래쪽은 바탕이 남색이라 <b>흰 바탕 빼기·흰색으로 바꾸기</b>를 켜 둔 채로 올리시면 됩니다.</p>
        </div>
      </div>

      {msg && <p className="bm-msg">{msg}</p>}

      <div className="logo-slots">
        {slots.map((s) => (
          <div className="logo-slot" key={s.key}>
            <div className="logo-slot-h">{s.name} <em>{s.hint}</em></div>
            <div className={`logo-prev ${s.dark ? 'dark' : ''}`}>
              {form[s.key]
                ? <img src={form[s.key]} alt={s.name} />
                : <span className="logo-text">Farmday<span className="dot">.</span></span>}
            </div>

            <div className="logo-opts">
              <label>
                <input type="checkbox" checked={cutWhite[s.key]}
                  onChange={(e) => setCutWhite({ ...cutWhite, [s.key]: e.target.checked })} />
                흰 바탕 빼기
              </label>
              {s.dark && (
                <label>
                  <input type="checkbox" checked={toWhite} onChange={(e) => setToWhite(e.target.checked)} />
                  흰색으로 바꾸기
                </label>
              )}
            </div>

            <div className="logo-act">
              <button type="button" className="bm-btn" onClick={() => refs.current[s.key]?.click()} disabled={busy === s.key}>
                {busy === s.key ? '올리는 중…' : (form[s.key] ? '바꾸기' : '올리기')}
              </button>
              {form[s.key] && <button type="button" className="bm-btn ghost" onClick={() => clear(s.key)}>빼기</button>}
              <input ref={(el) => { refs.current[s.key] = el }} type="file" accept="image/png,image/svg+xml,image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(s.key, f); e.target.value = '' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="logo-tagline">
        <label>푸터 한 줄 소개
          <input value={form.tagline ?? ''} placeholder="매일이 수확하는 날, 산지직송 신선식품 마켓"
            onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </label>
      </div>
    </section>
  )
}
