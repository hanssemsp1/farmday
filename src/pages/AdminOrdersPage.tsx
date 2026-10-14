import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isAdmin } from '../lib/adminConfig'
import { supabase } from '../lib/supabaseClient'
import type { DbOrder } from '../types/order'
import {
  SUPPLIERS, type Supplier, type SupplyLine, type SupplyMapRow,
  fetchSupplierMap, saveSupplierMap, mapKey, linesOf, downloadSupplyExcel, markSupplied, fetchPlanHints, suggestMap, type PlanHint,
  lockSupplying, unlockSupplying,
} from '../lib/supply'
import { cancelOrder } from '../lib/orderCancel'
import { parseTrackingFile, matchTracking, saveShipments, addShipmentManually, markDelivered, trackingUrl } from '../lib/tracking'
import './AdminOrdersPage.css'

// 주문 발주 — 결제가 끝난 주문을 파밍·최고집 주문서 엑셀로 내려받는다.
// 1) 상품·옵션마다 「공급처 + 그 공급처 주문서에 적는 상품명」을 한 번 적어 두면(발주 이름표) 다음부터 자동
// 2) 공급처 단추를 누르면 그 공급처 줄만 엑셀로 → 「발주함」 표시

// 주문 상태 — 최고집 주문내역의 「배송준비중·배송중·배송완료」처럼
const STATUS_ORDER = ['결제완료', '배송준비중', '배송중', '배송완료', '취소요청', '취소완료'] as const
function statusOf(o: DbOrder): string {
  if (o.status === '취소완료') return '취소완료'
  if (o.cancel_status === '요청') return '취소요청'
  if (o.delivery_status === '배송완료') return '배송완료'
  if (o.delivery_status === '배송중' || (o.shipments ?? []).length) return '배송중'
  if ((o.supply_status ?? '미발주') !== '미발주') return '배송준비중'
  return '결제완료'
}
const daysAgo = (n: number) => { const d = new Date(Date.now() - n * 864e5); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10) }

export default function AdminOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [map, setMap] = useState<Map<string, SupplyMapRow>>(new Map())
  const [drafts, setDrafts] = useState<Map<string, { supplier: Supplier | ''; supply_name: string }>>(new Map())
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [hints, setHints] = useState<Map<string, PlanHint>>(new Map())
  const [unsure, setUnsure] = useState<DbOrder[]>([])

  useEffect(() => {
    if (!authLoading && !isAdmin(user)) navigate('/')
  }, [authLoading, user, navigate])

  async function load() {
    setLoading(true)
    fetchPlanHints().then(setHints) // 기획서의 공급처 이름으로 이름표를 미리 채운다
    const [{ data: os, error: oe }, { data: ms, error: me }, { data: us }] = await Promise.all([
      supabase.from('orders').select('*').not('paid_at', 'is', null).order('paid_at', { ascending: false }),
      fetchSupplierMap(),
      // 결제 승인 중(payment_key 있음)인데 결제완료 기록이 없는 주문 — 5분 넘게 그대로면 확인이 필요하다
      supabase.from('orders').select('*').is('paid_at', null).not('payment_key', 'is', null)
        .lt('created_at', new Date(Date.now() - 5 * 60_000).toISOString()).order('created_at', { ascending: false }),
    ])
    setUnsure((us as DbOrder[]) ?? [])
    setLoading(false)
    if (oe || me) {
      setNotice('불러오지 못했어요: ' + (oe?.message ?? me) + ' — supabase/orders_shipping.sql 을 실행했는지 확인해 주세요.')
      return
    }
    setOrders((os as DbOrder[]) ?? [])
    setMap(new Map(ms.map((m) => [mapKey(m.product_id, m.option_name), m])))
  }
  useEffect(() => {
    if (isAdmin(user)) load()
  }, [user])

  const lines = useMemo(() => linesOf(orders), [orders])

  // 발주 이름표가 없는 상품·옵션 (같은 것은 한 번만)
  const unmapped = useMemo(() => {
    const seen = new Map<string, SupplyLine>()
    for (const l of lines) if (!l.done && !map.has(mapKey(l.productId, l.optionName))) seen.set(mapKey(l.productId, l.optionName), l)
    return [...seen.entries()]
  }, [lines, map])

  const names = useMemo(() => new Map([...map.entries()].map(([k, v]) => [k, v.supply_name])), [map])
  const pendingBy = (s: Supplier) => lines.filter((l) => !l.done && map.get(mapKey(l.productId, l.optionName))?.supplier === s)
  // 엑셀로 낼 수 있는 줄 = 배송지가 있는 줄 (단추 숫자)
  const readyBy = (s: Supplier) => pendingBy(s).filter((l) => l.recipientName && l.address)

  async function saveDraft(key: string, l: SupplyLine) {
    const d = drafts.get(key) ?? suggestMap(l.optionName, l.productName, hints)
    if (!d?.supplier || !d.supply_name.trim()) { setNotice('공급처와 주문서 상품명을 둘 다 적어 주세요.'); return }
    const row: SupplyMapRow = { product_id: l.productId, option_name: l.optionName, supplier: d.supplier, supply_name: d.supply_name.trim() }
    const { error } = await saveSupplierMap(row)
    if (error) { setNotice('저장하지 못했어요: ' + error); return }
    setMap((m) => new Map(m).set(key, row))
    setNotice(`「${l.productName}${l.optionName ? ' · ' + l.optionName : ''}」 발주 이름표를 저장했어요.`)
  }

  async function exportFor(s: Supplier) {
    const all = pendingBy(s)
    // 배송지가 빠진 줄(배송지 칸이 생기기 전 주문 등)은 빼고 나머지만 낸다
    const target = all.filter((l) => l.recipientName && l.address)
    const skipped = all.length - target.length
    if (!target.length) { setNotice(`배송지가 있는 ${s} 주문이 없어요.` + (skipped ? ` (배송지 없는 ${skipped}줄은 뺐어요)` : '')); return }
    // 내려받는 동안 「발주중」으로 잠가, 그 사이 손님이 바로 취소하지 못하게(취소 요청으로 바뀜)
    const orderIds = [...new Set(target.map((l) => l.orderId))]
    const { error: lockErr } = await lockSupplying(orderIds)
    if (lockErr) { setNotice('발주 준비 중 오류: ' + lockErr); return }
    // 잠그기 직전에 손님이 취소했을 수 있으니 한 번 더 읽어 취소된 주문은 뺀다
    // (손님이 바로 취소하는 중이면 「취소중」이라 잠기지 않는다 — 그 주문도 뺀다)
    const { data: fresh } = await supabase.from('orders').select('id,status,supply_status').in('id', orderIds)
    const canceledIds = new Set((fresh ?? []).filter((o) => o.status === '취소완료' || o.supply_status === '취소중').map((o) => o.id))
    const finalLines = target.filter((l) => !canceledIds.has(l.orderId))
    if (!finalLines.length) { setNotice('그 사이 주문이 모두 취소됐어요.'); load(); return }
    const file = downloadSupplyExcel(s, finalLines, names)
    const skipNote = skipped ? `\n배송지가 없는 ${skipped}줄은 빼고 만들었어요.` : ''
    const cancelNote = canceledIds.size ? `\n그 사이 취소된 주문 ${canceledIds.size}건은 뺐어요.` : ''
    if (!window.confirm(`「${file}」을 내려받았어요 (${finalLines.length}줄).${skipNote}${cancelNote}\n${s}에 올리셨으면 「확인」을 눌러 발주함으로 표시할게요.\n아직 안 올리셨으면 「취소」 — 다음에 다시 내려받을 수 있어요.`)) {
      await unlockSupplying(orderIds)
      setNotice(`${file} 내려받음 — 아직 발주함 표시는 안 했어요.` + (skipped ? ` 배송지 없는 ${skipped}줄은 뺐어요.` : ''))
      load()
      return
    }
    const { error } = await markSupplied(orders, finalLines)
    if (error) { setNotice('발주함 표시 중 오류: ' + error); return }
    setNotice(`${s} ${finalLines.length}줄을 발주함으로 표시했어요.` + (skipped ? ` 배송지 없는 ${skipped}줄은 남아 있어요.` : ''))
    load()
  }

  // 손님의 취소 요청 — 공급처에 확인한 뒤 승인(자동 환불) 또는 거절
  const requests = orders.filter((o) => o.cancel_status === '요청' && o.status !== '취소완료')
  async function decide(o: DbOrder, action: 'approve' | 'reject') {
    let note = ''
    if (action === 'approve') {
      if (!window.confirm(`${o.recipient_name ?? ''}님 주문 ${o.total_amount.toLocaleString()}원을 취소하고 환불할까요?\n공급처(파밍·최고집)에 취소가 된 것을 먼저 확인해 주세요.`)) return
    } else {
      const v = window.prompt('손님에게 보여 줄 거절 사유', '이미 산지에서 상품이 출발해 취소할 수 없어요.')
      if (v === null) return
      note = v
    }
    const r = await cancelOrder(o.id, action, '', note)
    setNotice(r.message ?? (r.ok ? '처리했어요.' : '처리하지 못했어요.'))
    load()
  }
  // 품절 등 판매자 사정으로 취소 — 결제된 주문 아무거나 (발주 전후 상관없이 즉시 환불)
  async function sellerCancel(orderId: string) {
    const o = orders.find((x) => x.id === orderId)
    if (!o) return
    if (!window.confirm(`판매자 사정(품절 등)으로 이 주문을 취소하고 ${o.total_amount.toLocaleString()}원을 환불할까요?\n이미 발주했다면 공급처에도 취소 연락을 해 주세요.`)) return
    const r = await cancelOrder(o.id, 'approve', '판매자 사정(품절 등)')
    setNotice(r.message ?? (r.ok ? '취소했어요.' : '취소하지 못했어요.'))
    load()
  }

  // ── 주문 목록 (최고집 주문내역처럼) ──
  const [fStatus, setFStatus] = useState('전체')
  const [fFrom, setFFrom] = useState(daysAgo(30))
  const [fTo, setFTo] = useState(daysAgo(0))
  const [fText, setFText] = useState('')
  const listedAll = useMemo(() => orders.filter((o) => {
    const d = (o.paid_at ?? o.created_at).slice(0, 10)
    return d >= fFrom && d <= fTo
  }), [orders, fFrom, fTo])
  const listed = useMemo(() => {
    const q = fText.replace(/\s+/g, '').toLowerCase()
    return listedAll.filter((o) => {
      if (fStatus !== '전체' && statusOf(o) !== fStatus) return false
      if (!q) return true
      const hay = [o.id, o.buyer_name, o.recipient_name, o.recipient_phone, o.buyer_phone, ...o.items.map((i) => i.name + (i.optionName ?? ''))].join('|').replace(/\s+/g, '').toLowerCase()
      return hay.includes(q) || hay.replace(/-/g, '').includes(q.replace(/-/g, ''))
    })
  }, [listedAll, fStatus, fText])

  // 송장 엑셀 올리기 — 공급처 주문 목록에서 송장번호를 읽어 주문에 붙인다
  async function uploadTracking(file: File) {
    try {
      const rows = parseTrackingFile(await file.arrayBuffer())
      if (!rows.length) { setNotice(`「${file.name}」에서 송장번호가 있는 줄을 찾지 못했어요. 파밍 orderlist·최고집 주문내역 파일인지 확인해 주세요.`); return }
      const m = matchTracking(rows, orders)
      if (!m.matched.length) {
        setNotice(`송장 ${rows.length}줄 중 우리 사이트 주문과 맞는 줄이 없어요.` + (m.already ? ` (이미 붙인 송장 ${m.already}줄)` : '') + ' 쿠팡 주문도 같은 파일에 섞여 있으면 그 줄은 건너뛰어요.')
        return
      }
      const list = m.matched.slice(0, 8).map((x) => `· ${x.order.recipient_name} — ${x.courier} ${x.number}`).join('\n')
      if (!window.confirm(`송장 ${m.matched.length}건을 붙일게요.\n${list}${m.matched.length > 8 ? '\n…' : ''}\n\n(맞는 주문이 없는 줄 ${m.unmatched.length}개는 건너뜀 — 쿠팡 주문일 수 있어요)`)) return
      const r = await saveShipments(m.matched)
      if (r.error) { setNotice('송장 저장 중 오류: ' + r.error); return }
      setNotice(`송장 ${m.matched.length}건을 붙였어요 → 「배송중」. 손님 주문내역에 송장 조회 링크가 보여요.` + (m.already ? ` 이미 있던 송장 ${m.already}줄은 건너뛰었어요.` : ''))
      load()
    } catch (e) {
      setNotice('파일을 읽지 못했어요: ' + (e instanceof Error ? e.message : String(e)))
    }
  }
  async function manualTracking(o: DbOrder) {
    const courier = window.prompt('택배사', (o.shipments ?? [])[0]?.courier ?? 'CJ대한통운')
    if (!courier) return
    const number = window.prompt(`${courier} 송장번호`)
    if (!number || number.replace(/\D/g, '').length < 8) { if (number) setNotice('송장번호를 확인해 주세요.'); return }
    const r = await addShipmentManually(o, courier.trim(), number)
    setNotice(r.error ? '저장 중 오류: ' + r.error : '송장을 붙였어요 → 「배송중」.')
    load()
  }
  async function delivered(o: DbOrder) {
    const r = await markDelivered(o)
    setNotice(r.error ? '저장 중 오류: ' + r.error : `${o.recipient_name}님 주문을 배송완료로 표시했어요.`)
    load()
  }

  if (authLoading || !isAdmin(user)) return null

  return (
    <div className="container admin-orders">
      <h1>주문 발주</h1>
      <p className="ao-hint">결제가 끝난 주문을 공급처 주문서 엑셀로 내려받습니다. 칸 순서는 쓰시던 파밍 주문서·최고집 발주서와 같습니다.</p>

      {unsure.length > 0 && (
        <section className="ao-box ao-cancel">
          <h2>결제 확인 필요 {unsure.length}건</h2>
          <p className="ao-hint">
            결제 승인 중에 연결이 끊겼거나 기록에 실패한 주문이에요. 손님 카드에서 돈이 나갔을 수 있어요.
            토스페이먼츠 상점관리자 → 결제내역에서 주문번호로 찾아 승인됐으면 손님께 연락하고, 아니면 그냥 두셔도 돼요(10분 지나면 토스가 승인 대기를 끝냅니다).
          </p>
          {unsure.map((o) => (
            <div className="ao-map-row" key={o.id}>
              <span className="ao-prod">
                {o.items[0]?.name}{o.items.length > 1 && <em> 외 {o.items.length - 1}건</em>}
                <em> · {o.buyer_name} {o.buyer_phone} · {(o.subtotal ?? o.total_amount).toLocaleString()}원 · 주문번호 {o.id} · {new Date(o.created_at).toLocaleString('ko-KR')}</em>
              </span>
            </div>
          ))}
        </section>
      )}

      {requests.length > 0 && (
        <section className="ao-box ao-cancel">
          <h2>취소 요청 {requests.length}건</h2>
          <p className="ao-hint">이미 발주한 주문이에요. 공급처에 취소가 되는지 먼저 확인한 뒤 눌러 주세요. 승인하면 결제가 자동으로 전액 취소돼요.</p>
          {requests.map((o) => (
            <div className="ao-map-row" key={o.id}>
              <span className="ao-prod">
                {o.items[0]?.name}{o.items[0]?.optionName && <em> · {o.items[0].optionName}</em>}{o.items.length > 1 && <em> 외 {o.items.length - 1}건</em>}
                <em> · {o.recipient_name} · {o.total_amount.toLocaleString()}원 · 사유: {o.cancel_reason}</em>
              </span>
              <span />
              <button onClick={() => decide(o, 'approve')}>승인·환불</button>
              <button onClick={() => decide(o, 'reject')}>거절</button>
            </div>
          ))}
        </section>
      )}

      {unmapped.length > 0 && (
        <section className="ao-box ao-warn">
          <h2>발주 이름표가 필요한 상품 {unmapped.length}개</h2>
          <p className="ao-hint">기획서의 공급처 이름으로 미리 채워 두었어요. 공급처 주문서 글자와 다르면 고친 뒤 저장해 주세요 — 한 번만 하면 됩니다. 예: <code>(홍) 햇알밤 (특품),1kg 1박스</code> · <code>최고집 극조생감귤(로얄과),1박스 10kg</code></p>
          {unmapped.map(([key, l]) => {
            const d = drafts.get(key) ?? suggestMap(l.optionName, l.productName, hints)
            const setD = (p: Partial<typeof d>) => setDrafts((m) => new Map(m).set(key, { ...d, ...p }))
            return (
              <div className="ao-map-row" key={key}>
                <span className="ao-prod">{l.productName}{l.optionName && <em> · {l.optionName}</em>}</span>
                <select value={d.supplier} onChange={(e) => setD({ supplier: e.target.value as Supplier })}>
                  <option value="">공급처</option>
                  {SUPPLIERS.map((s) => <option key={s}>{s}</option>)}
                </select>
                <input value={d.supply_name} onChange={(e) => setD({ supply_name: e.target.value })} placeholder="공급처 주문서 상품명" />
                <button onClick={() => saveDraft(key, l)}>저장</button>
              </div>
            )
          })}
        </section>
      )}

      <section className="ao-actions">
        {SUPPLIERS.map((s) => (
          <button key={s} className="ao-export" disabled={!readyBy(s).length} onClick={() => exportFor(s)}>
            {s} 발주 엑셀 ({readyBy(s).length}줄)
          </button>
        ))}
        <label className="ao-export ao-upload">
          송장 엑셀 올리기
          <input type="file" accept=".xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTracking(f); e.target.value = '' }} />
        </label>
      </section>
      <p className="ao-hint">송장 엑셀 = 파밍 「orderlist」·최고집 「주문내역」을 내려받은 그대로 올리면, 받는 분·연락처(최고집은 거래처주문번호)로 주문을 찾아 송장번호를 붙여요. 손님 주문내역에 송장과 배송 조회 링크가 보여요.</p>

      {/* 최고집 주문 목록처럼 — 상태·기간·검색 */}
      <section className="ao-filter">
        <label>상태
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            {['전체', ...STATUS_ORDER].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>주문일 (시작)<input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} /></label>
        <label>주문일 (종료)<input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} /></label>
        <label className="ao-search">검색<input value={fText} onChange={(e) => setFText(e.target.value)} placeholder="주문번호·주문자·받는 분·연락처·상품" /></label>
        <button className="ao-tab" onClick={() => { setFStatus('전체'); setFText(''); setFFrom(daysAgo(30)); setFTo(daysAgo(0)) }}>초기화</button>
      </section>

      {notice && <p className="ao-notice">{notice}</p>}
      <p className="ao-hint">총 <b>{listed.length}</b>건 {STATUS_ORDER.map((s) => { const n = listedAll.filter((o) => statusOf(o) === s).length; return n ? <span key={s} className="ao-count">{s} {n}</span> : null })}</p>
      {loading ? <p className="ao-hint">불러오는 중…</p> : listed.length === 0 ? (
        <p className="ao-hint">조건에 맞는 주문이 없어요.</p>
      ) : (
        <div className="ao-table-wrap">
          <table className="ao-table">
            <thead><tr><th>주문번호</th><th>주문일</th><th>상태</th><th>대표 품목</th><th>수량</th><th>받는 분</th><th className="num">금액</th><th>택배사 / 송장번호</th><th></th></tr></thead>
            <tbody>
              {listed.map((o) => {
                const st = statusOf(o)
                const first = o.items[0]
                const qty = o.items.reduce((s, it) => s + it.quantity, 0)
                const sup = first ? map.get(mapKey(first.productId, first.optionName)) : undefined
                return (
                  <tr key={o.id} className={st === '취소완료' ? 'done' : ''}>
                    <td className="mono">{o.id.slice(0, 8)}</td>
                    <td>{new Date(o.paid_at ?? o.created_at).toLocaleDateString('ko-KR')}</td>
                    <td><span className={'ao-badge s-' + (STATUS_ORDER as readonly string[]).indexOf(st)}>{st}</span>{sup && <div className="ao-sub">{sup.supplier}</div>}</td>
                    <td>{first?.name}{first?.optionName && <div className="ao-sub">{first.optionName}</div>}{o.items.length > 1 && <div className="ao-sub">외 {o.items.length - 1}건</div>}</td>
                    <td className="num">{qty}</td>
                    <td>{o.recipient_name || <b className="ao-miss">배송지 없음</b>}{o.guest && <span className="ao-guest">비회원</span>}<div className="ao-sub">{o.recipient_phone}</div><div className="ao-sub">{[o.address1, o.address2].filter(Boolean).join(' ')}</div></td>
                    <td className="num">{o.total_amount.toLocaleString()}원</td>
                    <td>
                      {(o.shipments ?? []).map((s) => (
                        <div key={s.number}>{s.courier} <a href={trackingUrl(s.courier, s.number)} target="_blank" rel="noreferrer" className="ao-track">{s.number}</a></div>
                      ))}
                      {st !== '취소완료' && st !== '결제완료' && <button className="ao-link plain" onClick={() => manualTracking(o)}>+ 송장 입력</button>}
                    </td>
                    <td className="ao-row-actions">
                      {st === '배송중' && <button className="ao-link plain" onClick={() => delivered(o)}>배송완료</button>}
                      {st !== '취소완료' && st !== '배송완료' && <button className="ao-link" onClick={() => sellerCancel(o.id)}>취소·환불</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
