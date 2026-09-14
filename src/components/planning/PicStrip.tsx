import { useRef, useState } from 'react'
import { uploadPlanImage, deletePlanImage } from '../../lib/planImages'

// 글 칸 아래에 붙는 사진 줄.
// 끌어다 놓기 / 골라서 올리기 / 붙여넣기(Ctrl+V) 다 된다.
export default function PicStrip({
  planId, pics, onChange,
}: {
  planId: string
  pics: string[]
  onChange: (next: string[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    setBusy(true); setErr('')
    const added: string[] = []
    for (const f of imgs) {
      const r = await uploadPlanImage(planId, f)
      if (r.error) { setErr(r.error); break }
      if (r.url) added.push(r.url)
    }
    setBusy(false)
    if (added.length) onChange([...pics, ...added])
  }

  async function removeAt(i: number) {
    const url = pics[i]
    // 화면에서 먼저 빼고(빠르게), 보관함에서도 지운다
    onChange(pics.filter((_, k) => k !== i))
    await deletePlanImage(url)
  }

  return (
    <div className={`picstrip ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); addFiles([...e.dataTransfer.files]) }}
      onPaste={(e) => {
        const fs = [...e.clipboardData.files]
        if (fs.length) { e.preventDefault(); addFiles(fs) }
      }}
    >
      {pics.map((url, i) => (
        <span className="pic" key={url + i}>
          <a href={url} target="_blank" rel="noreferrer" title="크게 보기">
            <img src={url} alt="" loading="lazy" />
          </a>
          <button className="picx" title="이 사진 빼기" onClick={() => removeAt(i)}>×</button>
        </span>
      ))}

      <button className="picadd" onClick={() => fileRef.current?.click()} disabled={busy}>
        {busy ? '올리는 중…' : '📎'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = '' }} />

      {err && <span className="picerr">{err}</span>}
    </div>
  )
}
