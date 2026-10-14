import { useEffect, useState } from 'react'
import type { ShippingInfo } from '../../types/order'
import './ShippingForm.css'

// 결제 전에 받는 배송지 — 산지(공급처)에서 바로 보내므로 공급처 주문서 칸과 같은 것을 받는다.
// 주소 찾기는 카카오(다음) 우편번호 서비스(무료, 키 없음).

const MEMO_PRESETS = ['문 앞에 놓아 주세요', '경비실에 맡겨 주세요', '배송 전에 연락 주세요', '직접 받을게요']
import { findAddress as openPostcode, preloadPostcode } from '../../lib/postcode'
import { remoteAreaOf, REMOTE_AREA_MESSAGE } from '../../../supabase/functions/_shared/remoteArea'

export const emptyShipping = (name = '', phone = ''): ShippingInfo => ({
  buyerName: name, buyerPhone: phone, recipientName: name, recipientPhone: phone,
  zipcode: '', address1: '', address2: '', memo: MEMO_PRESETS[0], consent: false,
})

const onlyPhone = (v: string) => v.replace(/[^0-9-]/g, '').slice(0, 13)
const phoneOk = (v: string) => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(v.trim())

/** 비어 있거나 틀린 칸 — 없으면 null */
export function shippingProblem(s: ShippingInfo): string | null {
  if (!s.buyerName.trim()) return '주문하시는 분 이름을 적어 주세요.'
  if (!phoneOk(s.buyerPhone)) return '주문하시는 분 연락처를 확인해 주세요. (예: 010-1234-5678)'
  if (!s.recipientName.trim()) return '받는 분 이름을 적어 주세요.'
  if (!phoneOk(s.recipientPhone)) return '받는 분 연락처를 확인해 주세요. (예: 010-1234-5678)'
  if (!s.zipcode || !s.address1) return '「주소 찾기」로 받는 주소를 골라 주세요.'
  if (remoteAreaOf(s.zipcode)) return REMOTE_AREA_MESSAGE
  if (!s.address2.trim()) return '동·호수 같은 상세 주소를 적어 주세요.'
  if (!s.consent) return '배송 정보를 산지 공급처에 전달하는 데 동의해 주세요.'
  return null
}

export default function ShippingForm({ value, onChange }: { value: ShippingInfo; onChange: (v: ShippingInfo) => void }) {
  const [same, setSame] = useState(value.recipientName === value.buyerName && value.recipientPhone === value.buyerPhone)
  const [customMemo, setCustomMemo] = useState(!MEMO_PRESETS.includes(value.memo))
  const [err, setErr] = useState('')
  useEffect(() => preloadPostcode(), [])
  const set = (patch: Partial<ShippingInfo>) => {
    const next = { ...value, ...patch }
    if (same) { next.recipientName = next.buyerName; next.recipientPhone = next.buyerPhone }
    onChange(next)
  }

  async function findAddress() {
    setErr('')
    try {
      await openPostcode((a) => set({ zipcode: a.zipcode, address1: a.address }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : '주소 찾기를 열지 못했어요')
    }
  }

  return (
    <section className="ship-form">
      <h2>배송지</h2>

      <div className="ship-grid">
        <label>주문하시는 분<input value={value.buyerName} onChange={(e) => set({ buyerName: e.target.value })} placeholder="이름" autoComplete="name" /></label>
        <label>연락처<input value={value.buyerPhone} onChange={(e) => set({ buyerPhone: onlyPhone(e.target.value) })} placeholder="010-1234-5678" inputMode="tel" autoComplete="tel" /></label>
      </div>

      <label className="ship-check">
        <input type="checkbox" checked={same} onChange={(e) => {
          setSame(e.target.checked)
          if (e.target.checked) onChange({ ...value, recipientName: value.buyerName, recipientPhone: value.buyerPhone })
        }} />
        받는 분이 주문하시는 분과 같아요
      </label>

      {!same && (
        <div className="ship-grid">
          <label>받는 분<input value={value.recipientName} onChange={(e) => set({ recipientName: e.target.value })} placeholder="이름" /></label>
          <label>받는 분 연락처<input value={value.recipientPhone} onChange={(e) => set({ recipientPhone: onlyPhone(e.target.value) })} placeholder="010-1234-5678" inputMode="tel" /></label>
        </div>
      )}

      <div className="ship-addr">
        <input value={value.zipcode} readOnly placeholder="우편번호" className="ship-zip" />
        <button type="button" className="ship-find" onClick={findAddress}>주소 찾기</button>
      </div>
      <input value={value.address1} readOnly placeholder="「주소 찾기」를 눌러 주소를 골라 주세요" className="ship-full" onClick={() => !value.address1 && findAddress()} />
      {remoteAreaOf(value.zipcode) && <p className="ship-err">{REMOTE_AREA_MESSAGE} ({remoteAreaOf(value.zipcode)})</p>}
      <input value={value.address2} onChange={(e) => set({ address2: e.target.value })} placeholder="상세 주소 (동·호수)" className="ship-full" autoComplete="address-line2" />

      <label className="ship-memo">배송 메모
        <select value={customMemo ? '__custom' : value.memo} onChange={(e) => {
          if (e.target.value === '__custom') { setCustomMemo(true); set({ memo: '' }) } else { setCustomMemo(false); set({ memo: e.target.value }) }
        }}>
          {MEMO_PRESETS.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__custom">직접 적을게요</option>
        </select>
      </label>
      {customMemo && <input value={value.memo} onChange={(e) => set({ memo: e.target.value.slice(0, 50) })} placeholder="배송 메모 (50자까지)" className="ship-full" />}

      <label className="ship-check ship-consent">
        <input type="checkbox" checked={value.consent} onChange={(e) => set({ consent: e.target.checked })} />
        <span>
          <b>[필수]</b> 주문 상품을 산지에서 바로 보내기 위해, 받는 분 이름·연락처·주소·배송 메모를 상품 공급처(산지)와 택배사에 전달하는 데 동의합니다.
        </span>
      </label>
      {err && <p className="ship-err">{err}</p>}
    </section>
  )
}
