// 공급처 발주 — 사이트 주문을 파밍·최고집 주문서 엑셀로 바꾼다.
// 칸 순서는 대표님이 실제로 올리던 파일과 똑같이: 「10월14일 파밍주문서.xlsx」「최고집 10월13일발주.xlsx」
import * as XLSX from 'xlsx'
import { supabase } from './supabaseClient'
import type { DbOrder } from '../types/order'
import { refOf } from './tracking'

export const SUPPLIERS = ['파밍', '최고집'] as const
export type Supplier = (typeof SUPPLIERS)[number]

export interface SupplyMapRow { product_id: string; option_name: string; supplier: Supplier; supply_name: string }

export async function fetchSupplierMap(): Promise<{ data: SupplyMapRow[]; error: string | null }> {
  const { data, error } = await supabase.from('supplier_map').select('product_id,option_name,supplier,supply_name')
  return { data: (data as SupplyMapRow[]) ?? [], error: error?.message ?? null }
}

export async function saveSupplierMap(row: SupplyMapRow) {
  const { error } = await supabase.from('supplier_map').upsert({ ...row, updated_at: new Date().toISOString() })
  return { error: error?.message ?? null }
}

export const mapKey = (productId: string, optionName?: string) => `${productId}::${optionName ?? ''}`

/** 주문 한 줄 = 공급처 주문서 한 줄 */
export interface SupplyLine {
  orderId: string
  lineIndex: number
  createdAt: string
  productId: string
  productName: string
  optionName: string
  quantity: number
  buyerName: string
  buyerPhone: string
  recipientName: string
  recipientPhone: string
  zipcode: string
  address: string
  memo: string
  done: boolean
}

export function linesOf(orders: DbOrder[]): SupplyLine[] {
  const out: SupplyLine[] = []
  for (const o of orders) {
    if (o.status === '취소완료') continue // 취소된 주문은 발주하지 않는다
    const done = new Set(o.supply_lines ?? [])
    ;(o.items ?? []).forEach((it, i) => {
      out.push({
        orderId: o.id,
        lineIndex: i,
        createdAt: o.paid_at ?? o.created_at,
        productId: it.productId,
        productName: it.name,
        optionName: it.optionName ?? '',
        quantity: it.quantity,
        buyerName: o.buyer_name ?? '',
        buyerPhone: o.buyer_phone ?? '',
        recipientName: o.recipient_name ?? '',
        recipientPhone: o.recipient_phone ?? '',
        zipcode: o.zipcode ?? '',
        address: [o.address1, o.address2].filter(Boolean).join(' '),
        memo: o.delivery_memo ?? '',
        done: done.has(i),
      })
    })
  }
  return out
}

const today = () => {
  const d = new Date()
  return `${d.getMonth() + 1}월${d.getDate()}일`
}

/** 파밍 주문서 — 13칸, 앞 4칸(주문번호·택배사·운송장·배송비)은 비움 */
function farmingSheet(lines: SupplyLine[], names: Map<string, string>) {
  const head = ['주문번호', '택배사', '운송장번호', '배송비', '상품명', '수량', '주문자', '주문자 연락처', '수령인', '수령인 연락처', '수령인 우편번호', '수령인 주소', '배송메모']
  const rows = lines.map((l) => ['', '', '', '', names.get(mapKey(l.productId, l.optionName)) ?? '', String(l.quantity), l.buyerName, l.buyerPhone, l.recipientName, l.recipientPhone, l.zipcode, l.address, l.memo])
  return { name: 'Sheet 1', aoa: [head, ...rows] }
}

/** 최고집 발주서 — 18칸(뒤 4칸은 제목 없음), 수량은 숫자 */
function choigoSheet(lines: SupplyLine[], names: Map<string, string>) {
  const head = ['거래처주문번호', '상품코드', '품목명', '수량', '주문자성명', '주문자전화번호', '받는분성명', '받는분전화번호', '받는분우편번호', '받는분주소(전체)', '배송메세지', '공급가', '택배사', '송장번호', '', '', '', '']
  // 거래처주문번호에 우리 주문번호를 넣어 두면, 최고집 주문내역(송장 포함)을 다시 올릴 때 정확히 짝지어진다
  const rows = lines.map((l) => [refOf(l.orderId, l.lineIndex), '', names.get(mapKey(l.productId, l.optionName)) ?? '', l.quantity, l.buyerName, l.buyerPhone, l.recipientName, l.recipientPhone, l.zipcode, l.address, l.memo, '', '', '', '', '', '', ''])
  return { name: 'sheet1', aoa: [head, ...rows] }
}

/** 엑셀 파일을 만들어 내려받는다. 파일 이름도 대표님이 쓰던 그대로 */
export function downloadSupplyExcel(supplier: Supplier, lines: SupplyLine[], names: Map<string, string>) {
  const { name, aoa } = supplier === '파밍' ? farmingSheet(lines, names) : choigoSheet(lines, names)
  // 빈 칸은 실제 주문서처럼 아예 비운다 (빈 글자를 넣지 않음)
  const ws = XLSX.utils.aoa_to_sheet(aoa.map((row) => row.map((v) => (v === '' ? null : v))))
  // 우편번호·전화번호가 숫자로 바뀌어 앞 0이 빠지지 않게 글자로 고정
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let r = 1; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && typeof cell.v === 'string') cell.t = 's'
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, name)
  const file = supplier === '파밍' ? `${today()} 파밍주문서.xlsx` : `최고집 ${today()}발주.xlsx`
  XLSX.writeFile(wb, file)
  return file
}

/** 엑셀을 내려받는 순간 「발주중」으로 잠근다 — 그 사이 손님은 바로 취소 대신 「취소 요청」만 할 수 있다 */
export async function lockSupplying(orderIds: string[]) {
  if (!orderIds.length) return { error: null }
  const { error } = await supabase.from('orders').update({ supply_status: '발주중' }).in('id', orderIds).eq('supply_status', '미발주')
  return { error: error?.message ?? null }
}
/** 올리지 않기로 했으면 잠금을 푼다 */
export async function unlockSupplying(orderIds: string[]) {
  if (!orderIds.length) return { error: null }
  const { error } = await supabase.from('orders').update({ supply_status: '미발주' }).in('id', orderIds).eq('supply_status', '발주중')
  return { error: error?.message ?? null }
}

/** 엑셀로 낸 줄을 주문에 「발주함」으로 적는다 */
export async function markSupplied(orders: DbOrder[], lines: SupplyLine[]) {
  const byOrder = new Map<string, number[]>()
  for (const l of lines) byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), l.lineIndex])
  const now = new Date().toISOString()
  for (const [orderId, idx] of byOrder) {
    const o = orders.find((x) => x.id === orderId)
    if (!o) continue
    const done = [...new Set([...(o.supply_lines ?? []), ...idx])].sort((a, b) => a - b)
    const all = done.length >= (o.items?.length ?? 0)
    const { error } = await supabase.from('orders')
      .update({ supply_lines: done, supply_status: all ? '발주완료' : '일부 발주', supply_ordered_at: now })
      .eq('id', orderId)
    if (error) return { error: error.message }
  }
  return { error: null }
}

/** 기획서(product_plans)에서 옵션 이름 → 공급처 상품명. 사이트 옵션은 기획서 옵션 이름으로 만들어진다(publish-set) */
export interface PlanHint { supplier: Supplier | null; vendorName: string }
const cleanLabel = (s: string) => s.replace(/⭐\S*/g, '').replace(/\s+/g, ' ').trim()

export async function fetchPlanHints(): Promise<Map<string, PlanHint>> {
  const { data } = await supabase.from('product_plans').select('vendor,options')
  const out = new Map<string, PlanHint>()
  for (const p of (data ?? []) as { vendor?: { name?: string }; options?: { label?: string }[] }[]) {
    const raw = (p.vendor?.name ?? '').trim()
    if (!raw) continue
    const supplier = guessSupplier(raw)
    const vendorName = raw
      .replace(/^(파밍|최고집)\s+(?=\()/, '') // 파밍 주문서에는 「파밍」 글자 없이 (홍)… 로 시작
      .replace(/\s*\[제휴[A-Za-z]\]\s*/g, ' ') // 최고집 [제휴A]·[제휴B] 표시는 발주서에 안 쓴다 (대표님 26.10.14)
      .replace(/\s+/g, ' ')
      .trim()
    for (const o of p.options ?? []) if (o.label) out.set(cleanLabel(o.label), { supplier, vendorName })
  }
  return out
}

/** 이름표 첫 값 — 「공급처 상품명,옵션」 (실제 주문서 형식). 대표님이 보고 고쳐서 저장 */
export function suggestMap(optionName: string, productName: string, hints: Map<string, PlanHint>): { supplier: Supplier | ''; supply_name: string } {
  const h = hints.get(cleanLabel(optionName))
  if (!h) return { supplier: '', supply_name: '' }
  const opt = cleanLabel(optionName || productName)
  return { supplier: h.supplier ?? '', supply_name: opt ? `${h.vendorName},${opt}` : h.vendorName }
}

/** 기획서의 공급처 이름(예: 「파밍 (늘)여수 석화(각굴)」)으로 첫 칸을 미리 채울 때 쓰는 추측 — 대표님이 확인 후 저장 */
export function guessSupplier(text: string): Supplier | null {
  if (/최고집/.test(text)) return '최고집'
  if (/파밍|^\s*\([가-힣]\)/.test(text)) return '파밍' // 파밍 상품은 (홍)(늘)(민)… 처럼 한 글자 괄호로 시작
  return null
}
