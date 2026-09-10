import * as XLSX from 'xlsx'
import type { DiaryItem } from './sellerDiary'

// 쿠팡 주문/배송 엑셀(DeliveryList)을 읽어 날짜별 「판매된 상품」으로 나눈다.
//
// 칸 이름은 정산도(seller-tool)와 같은 후보 사전을 쓴다 — 셀러마다·시기마다
// 칸 이름이 조금씩 달라서 "포함되면 매칭" 방식으로 찾는다.
// 한 파일에 여러 날 주문이 섞여 있으므로 주문일로 갈라서 하루씩 돌려준다.

const ALIASES: Record<string, string[]> = {
  date: ['주문일', '결제일', '주문일시'],
  orderNo: ['주문번호'],
  productName: ['등록상품명', '노출상품명', '상품명', '제품명'],
  option: ['등록옵션명', '노출옵션명', '옵션명', '옵션'],
  qty: ['구매수', '구매수량', '판매수량', '수량'],
  amount: ['결제액', '결제금액', '상품판매금액', '판매금액'],
}
// '결제액' 을 '배송비' 같은 다른 돈 칸보다 먼저 잡는다
const PRIORITY: Record<string, string[]> = { amount: ['결제액', '결제금액'] }

function normalize(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, '').replace(/[()[\]{}<>·・.,/\\_=-]/g, '').toLowerCase()
}

function scoreRow(row: unknown[]): number {
  const cells = row.map(normalize)
  let n = 0
  for (const cands of Object.values(ALIASES)) {
    if (cells.some((c) => c && cands.some((a) => c.includes(normalize(a))))) n++
  }
  return n
}

function findHeaderRow(rows: unknown[][]): { at: number; score: number } {
  let at = 0, score = -1
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const s = scoreRow(rows[i] ?? [])
    if (s > score) { score = s; at = i }
  }
  return { at, score }
}

function mapColumns(header: unknown[]): Record<string, number> {
  const nh = header.map(normalize)
  const index: Record<string, number> = {}
  const taken = (i: number) => Object.values(index).includes(i)
  const findFor = (cands: string[]) => {
    for (const c of cands) {                       // 1순위: 정확히 같은 이름
      const i = nh.findIndex((h) => h && h === normalize(c))
      if (i !== -1 && !taken(i)) return i
    }
    for (const c of [...cands].sort((a, b) => b.length - a.length)) {   // 2순위: 포함
      const i = nh.findIndex((h) => h && h.includes(normalize(c)))
      if (i !== -1 && !taken(i)) return i
    }
    return -1
  }
  for (const [f, cands] of Object.entries(PRIORITY)) { const i = findFor(cands); if (i !== -1) index[f] = i }
  for (const [f, cands] of Object.entries(ALIASES)) { if (index[f] == null) { const i = findFor(cands); if (i !== -1) index[f] = i } }
  return index
}

const toNum = (v: unknown): number => {
  if (typeof v === 'number') return v
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const toStr = (v: unknown) => (v == null ? '' : String(v).trim())
function toDate(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'number') {
    const d = XLSX.SSF?.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const m = String(v).match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/)
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''
}

export interface ImportedDay {
  day: string
  items: DiaryItem[]
  revenue: number     // 그날 결제액 합
  orders: number      // 그날 주문 건수(주문번호 기준)
}

export interface ImportResult {
  days: ImportedDay[]
  total: number       // 읽은 줄 수
  noDate: number      // 주문일이 없어 못 넣은 줄
  missing: string[]   // 못 찾은 필수 칸
}

/** 쿠팡 주문 엑셀을 읽어 날짜별로 나눈다 */
export async function importSalesExcel(file: File, channel = '쿠팡'): Promise<ImportResult> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false })
  const byDay = new Map<string, ImportedDay>()
  const orderSets = new Map<string, Set<string>>()
  let total = 0, noDate = 0
  let bestMissing: string[] | null = null

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: '' })
    if (!rows.length) continue
    const { at, score } = findHeaderRow(rows)
    if (score < 3) continue                          // 주문 시트가 아니다
    const index = mapColumns(rows[at] ?? [])
    if (index.productName == null) continue
    const get = (row: unknown[], f: string) => (index[f] != null ? row[index[f]] : undefined)

    const missing = ['productName', 'qty', 'amount', 'date'].filter((f) => index[f] == null)
    if (bestMissing == null || missing.length < bestMissing.length) bestMissing = missing

    for (let i = at + 1; i < rows.length; i++) {
      const row = rows[i] ?? []
      const productName = toStr(get(row, 'productName'))
      if (!productName) continue
      total++
      const day = toDate(get(row, 'date'))
      if (!day) { noDate++; continue }

      const orderNo = toStr(get(row, 'orderNo'))
      const option = toStr(get(row, 'option'))
      const qty = toNum(get(row, 'qty')) || 1
      const amount = toNum(get(row, 'amount'))

      const d = byDay.get(day) ?? { day, items: [], revenue: 0, orders: 0 }
      d.items.push({ name: productName, option, channel, qty, amount, orderNo })
      d.revenue += amount
      const set = orderSets.get(day) ?? new Set<string>()
      set.add(orderNo || `${i}`)
      orderSets.set(day, set)
      d.orders = set.size
      byDay.set(day, d)
    }
  }

  const label: Record<string, string> = { productName: '상품명', qty: '수량', amount: '결제액', date: '주문일' }
  return {
    days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    total, noDate,
    missing: (bestMissing ?? Object.keys(label)).map((f) => label[f]),
  }
}

/** 이미 들어 있는 줄과 같은 주문이면 건너뛴다 — 같은 파일을 두 번 올려도 두 배가 되지 않게 */
export function mergeItems(existing: DiaryItem[], incoming: DiaryItem[]): { merged: DiaryItem[]; added: number } {
  const key = (it: DiaryItem) => `${it.orderNo || ''}|${it.name}|${it.option || ''}`
  const seen = new Set(existing.filter((it) => it.orderNo).map(key))
  const fresh = incoming.filter((it) => !seen.has(key(it)))
  return { merged: [...existing, ...fresh], added: fresh.length }
}
