import { CHANNELS, type DiaryItem } from '../../lib/sellerDiary'

// 하루에 등록한 / 판매된 상품 목록.
// 상품마다 "어디에" 가 붙는다 — 쿠팡·네이버·당근·테무 중 어디가 잘 되는지 나중에 비교하려고.
//
// 상품 이름 칸은 한눈에 읽히게 넓게 둔다. 판매된 상품은 옵션·수량·금액이 더 붙는다.
export default function ItemList({
  label, items, onChange, mode, placeholder,
}: {
  label: string
  items: DiaryItem[]
  onChange: (next: DiaryItem[]) => void
  mode: 'registered' | 'sold'
  placeholder: string
}) {
  const sold = mode === 'sold'
  const set = (i: number, patch: Partial<DiaryItem>) =>
    onChange(items.map((it, k) => (k === i ? { ...it, ...patch } : it)))

  // 새 줄의 판매처는 바로 앞줄과 같게 — 같은 곳에 여러 개 올리는 날이 많다
  const lastChannel = items.length ? items[items.length - 1].channel : ''
  const add = () => onChange([...items, {
    name: '', channel: lastChannel || '쿠팡',
    ...(sold ? { option: '', qty: 1, amount: null } : {}),
  }])
  const del = (i: number) => onChange(items.filter((_, k) => k !== i))
  const num = (s: string) => (s === '' ? null : Number(s.replace(/[^\d.-]/g, '')))

  // 예전에 적어둔 판매처가 넷 밖의 것이면 그 값도 목록에 보여준다 — 지워지면 안 되니까
  const options = (cur: string) =>
    cur && !(CHANNELS as readonly string[]).includes(cur) ? [cur, ...CHANNELS] : [...CHANNELS]

  return (
    <div className={`dy-items ${sold ? 'sold' : ''}`}>
      {items.length > 0 && (
        <div className="dy-item dy-item-head">
          <span>상품명</span>
          {sold && <span>옵션</span>}
          <span>판매처</span>
          {sold && <span className="r">수량</span>}
          {sold && <span className="r">금액</span>}
          <span />
        </div>
      )}

      {items.map((it, i) => (
        <div className="dy-item" key={i}>
          <input className="dy-item-name" value={it.name} placeholder={placeholder}
            onChange={(e) => set(i, { name: e.target.value })} />
          {sold && (
            <input className="dy-item-opt" value={it.option ?? ''} placeholder="옵션"
              onChange={(e) => set(i, { option: e.target.value })} />
          )}
          <select className="dy-item-ch" value={it.channel} onChange={(e) => set(i, { channel: e.target.value })}>
            {options(it.channel).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {sold && (
            <input className="dy-item-qty" inputMode="numeric" value={it.qty ?? ''} placeholder="0"
              onChange={(e) => set(i, { qty: num(e.target.value) })} />
          )}
          {sold && (
            <input className="dy-item-amt" inputMode="numeric"
              value={it.amount == null ? '' : it.amount.toLocaleString()} placeholder="0"
              onChange={(e) => set(i, { amount: num(e.target.value) })} />
          )}
          <button className="dy-item-x" title="이 줄 지우기" onClick={() => del(i)}>×</button>
        </div>
      ))}

      {/* 합계는 이름이 적힌 줄만 — 빈 줄에 남은 수량이 합계를 부풀리지 않게 */}
      {sold && items.length > 1 && (() => {
        const named = items.filter((it) => it.name.trim())
        return (
          <div className="dy-item dy-item-sum">
            <span>합계 {named.length}줄{named.length < items.length && <em> (빈 줄 {items.length - named.length}개 제외)</em>}</span>
            <span />
            <span />
            <span className="r">{named.reduce((a, it) => a + (it.qty || 0), 0)}</span>
            <span className="r">{named.reduce((a, it) => a + (it.amount || 0), 0).toLocaleString()}</span>
            <span />
          </div>
        )
      })()}

      <button className="dy-item-add" onClick={add}>＋ {label} 추가</button>
    </div>
  )
}
