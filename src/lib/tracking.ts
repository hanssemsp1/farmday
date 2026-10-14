// 송장 — 공급처 주문 목록 엑셀(파밍 orderlist · 최고집 주문내역)에서 택배사·운송장번호를 읽어 우리 주문에 붙인다.
import * as XLSX from 'xlsx'
import { supabase } from './supabaseClient'
import type { DbOrder } from '../types/order'

export interface Shipment { lines: number[]; courier: string; number: string; at: string }

/** 택배 조회 주소 — CJ·롯데는 송장번호가 바로 들어가는 공식 조회(26.10.14 확인), 나머지는 네이버 택배 조회 */
export function trackingUrl(courier: string, number: string): string {
  const c = courier.replace(/\s+/g, '')
  const n = number.replace(/\D/g, '')
  if (/CJ|대한통운/i.test(c)) return `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${n}`
  if (/롯데/.test(c)) return `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${n}`
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(`${courier} ${n}`)}`
}

/** 우리 주문번호 — 최고집 발주서 「거래처주문번호」에 넣었다가 송장 파일에서 돌아오면 정확히 짝짓는다 */
export const refOf = (orderId: string, lineIndex: number) => `FD-${orderId.slice(0, 8)}-${lineIndex + 1}`

interface TrackRow { ref: string; recipient: string; phone: string; zipcode: string; product: string; courier: string; number: string }

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, '').toLowerCase()
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/** 공급처 주문 목록 엑셀 → 송장 줄 (송장번호가 있는 줄만) */
export function parseTrackingFile(buf: ArrayBuffer): TrackRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const out: TrackRow[] = []
  for (const sn of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: '' })
    const hi = grid.findIndex((r) => r.some((c) => /운송장|송장번호/.test(String(c))) && r.some((c) => /수령인|받는분/.test(String(c))))
    if (hi === -1) continue
    const head = grid[hi].map((c) => norm(c))
    const col = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h === norm(k))) // 정확히 같은 칸 먼저
    const colLike = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(norm(k))))
    const cRef = col('거래처주문번호')
    const cName = col('수령인', '받는분성명') !== -1 ? col('수령인', '받는분성명') : colLike('수령인', '받는분')
    const cPhone = col('수령인연락처1', '받는분전화번호', '수령인 연락처') !== -1 ? col('수령인연락처1', '받는분전화번호', '수령인 연락처') : colLike('수령인연락처', '받는분전화')
    const cZip = colLike('우편번호')
    const cProd = col('상품명', '품목명') !== -1 ? col('상품명', '품목명') : colLike('상품명', '품목')
    const cCourier = col('택배사')
    const cNum = col('운송장번호', '송장번호') !== -1 ? col('운송장번호', '송장번호') : colLike('운송장', '송장')
    for (const r of grid.slice(hi + 1)) {
      const number = digits(r[cNum])
      if (number.length < 8) continue
      out.push({
        ref: cRef === -1 ? '' : String(r[cRef] ?? '').trim(),
        recipient: String(r[cName] ?? '').trim(),
        phone: digits(r[cPhone]),
        zipcode: digits(r[cZip]),
        product: String(r[cProd] ?? ''),
        courier: String(r[cCourier] ?? '').trim() || '택배',
        number,
      })
    }
  }
  return out
}

export interface MatchResult { matched: { order: DbOrder; lines: number[]; courier: string; number: string }[]; unmatched: TrackRow[]; already: number }

/** 송장 줄 → 우리 주문 줄. 1) 거래처주문번호 2) 받는 분 이름 + 연락처(또는 우편번호)가 같은 발주한 주문 */
export function matchTracking(rows: TrackRow[], orders: DbOrder[]): MatchResult {
  const live = orders.filter((o) => o.status === '결제완료' && (o.supply_lines?.length ?? 0) > 0)
  const matched: MatchResult['matched'] = []
  const unmatched: TrackRow[] = []
  let already = 0
  const has = (o: DbOrder, n: string) => (o.shipments ?? []).some((s) => s.number === n) || matched.some((m) => m.order.id === o.id && m.number === n)
  for (const r of rows) {
    let order: DbOrder | undefined
    let lines: number[] = []
    const refHit = /^FD-([0-9a-f]{8})-(\d+)$/i.exec(r.ref)
    if (refHit) {
      order = live.find((o) => o.id.startsWith(refHit[1]))
      lines = [Number(refHit[2]) - 1]
    } else {
      const cands = live.filter((o) =>
        norm(o.recipient_name) === norm(r.recipient) &&
        ((r.phone && digits(o.recipient_phone) === r.phone) ||
         (r.zipcode && digits(o.zipcode) === r.zipcode)))
      // 같은 사람 주문이 여럿이면 송장이 아직 없는 주문부터
      order = cands.find((o) => !(o.shipments ?? []).length) ?? cands[0]
      lines = order ? [...(order.supply_lines ?? [])] : []
    }
    if (!order) { unmatched.push(r); continue }
    if (has(order, r.number)) { already++; continue }
    matched.push({ order, lines, courier: r.courier, number: r.number })
  }
  return { matched, unmatched, already }
}

/** 짝지은 송장을 주문에 적는다 → 배송중 */
export async function saveShipments(matches: MatchResult['matched']) {
  const now = new Date().toISOString()
  const byOrder = new Map<string, { order: DbOrder; add: Shipment[] }>()
  for (const m of matches) {
    const cur = byOrder.get(m.order.id) ?? { order: m.order, add: [] }
    cur.add.push({ lines: m.lines, courier: m.courier, number: m.number, at: now })
    byOrder.set(m.order.id, cur)
  }
  for (const { order, add } of byOrder.values()) {
    const shipments = [...(order.shipments ?? []), ...add]
    const { error } = await supabase.from('orders').update({
      shipments, delivery_status: order.delivery_status === '배송완료' ? '배송완료' : '배송중', shipped_at: order.shipped_at ?? now,
    }).eq('id', order.id)
    if (error) return { error: error.message, saved: 0 }
  }
  return { error: null, saved: byOrder.size }
}

/** 송장 하나를 손으로 넣기 */
export async function addShipmentManually(order: DbOrder, courier: string, number: string) {
  return saveShipments([{ order, lines: [...(order.supply_lines ?? [])], courier, number: number.replace(/\D/g, '') }])
}

export async function markDelivered(order: DbOrder) {
  const { error } = await supabase.from('orders').update({ delivery_status: '배송완료', delivered_at: new Date().toISOString() }).eq('id', order.id)
  return { error: error?.message ?? null }
}
