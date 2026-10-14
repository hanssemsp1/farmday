import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchOrders } from '../lib/orders'
import { cancelOrder, cancelView, CANCEL_REASONS } from '../lib/orderCancel'
import { trackingUrl } from '../lib/tracking'
import { DbOrder } from '../types/order'
import Button from '../components/ui/Button'
import './OrderHistoryPage.css'

export default function OrderHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null) // 취소 사유를 고르는 중인 주문
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null)

  function load() {
    if (!user) return
    fetchOrders(user.id).then(({ data }) => {
      setOrders(data)
      setLoading(false)
    })
  }
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    load()
  }, [user])

  async function submitCancel(o: DbOrder) {
    setBusy(true)
    const r = await cancelOrder(o.id, 'cancel', reason)
    setBusy(false)
    setOpen(null)
    setMsg({ id: o.id, text: r.message ?? (r.ok ? '처리했어요.' : '취소하지 못했어요.') })
    load()
  }

  if (authLoading || loading) return null

  if (!user) {
    return (
      <div className="container order-history">
        <p className="order-history-empty">로그인 후 주문내역을 확인할 수 있어요.</p>
        <Link to="/login">
          <Button variant="accent">로그인하러 가기</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container order-history">
      <h1>주문내역 ({orders.length})</h1>

      {orders.length === 0 ? (
        <div className="order-history-empty">
          <p>아직 주문 내역이 없어요.</p>
          <Link to="/best">
            <Button variant="accent">쇼핑하러 가기</Button>
          </Link>
        </div>
      ) : (
        <div className="order-history-list">
          {orders.map((order) => {
            const v = cancelView(order)
            return (
              <div key={order.id} className="order-history-item">
                <div className="order-history-row">
                  <div className="order-history-thumb" style={{ background: order.items[0]?.thumbnail }} />
                  <div className="order-history-info">
                    <p className="order-history-meta">
                      {new Date(order.created_at).toLocaleDateString('ko-KR')} · {order.id.slice(0, 8)}
                    </p>
                    <p className="order-history-name">
                      {order.items[0]?.name}
                      {order.items[0]?.optionName && ` (${order.items[0].optionName})`}
                      {order.items.length > 1 && <span className="order-history-qty"> 외 {order.items.length - 1}건</span>}
                    </p>
                    <p className="order-history-price">{order.total_amount.toLocaleString()}원</p>
                  </div>
                  <div className="order-history-side">
                    <span className={`order-status ${v.tone === 'off' ? 'canceled' : 'pending'}`}>{v.label}</span>
                    {v.canCancel && open !== order.id && (
                      <button className="order-cancel-link" onClick={() => { setOpen(order.id); setReason(CANCEL_REASONS[0]); setMsg(null) }}>
                        {v.isRequest ? '취소 요청' : '주문 취소'}
                      </button>
                    )}
                  </div>
                </div>

                {open === order.id && (
                  <div className="order-cancel-box">
                    <p>
                      {v.isRequest
                        ? '이미 산지에 주문이 넘어갔어요. 취소를 요청하면 산지에 확인한 뒤 알려 드려요. 상품이 이미 출발했으면 취소가 어려울 수 있어요.'
                        : '아직 산지로 넘어가기 전이라 바로 취소되고, 결제가 전액 취소돼요.'}
                      {order.coupon_amount ? ' 첫 구매 할인 쿠폰은 다시 쓸 수 없어요.' : ''}
                    </p>
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                      {CANCEL_REASONS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                    <div className="order-cancel-actions">
                      <button className="order-cancel-btn danger" disabled={busy} onClick={() => submitCancel(order)}>
                        {busy ? '처리 중…' : v.isRequest ? '취소 요청하기' : '주문 취소하기'}
                      </button>
                      <button className="order-cancel-btn" disabled={busy} onClick={() => setOpen(null)}>그만두기</button>
                    </div>
                  </div>
                )}
                {(order.shipments ?? []).length > 0 && (
                  <div className="order-tracking">
                    {(order.shipments ?? []).map((s) => (
                      <a key={s.number} href={trackingUrl(s.courier, s.number)} target="_blank" rel="noreferrer">
                        {s.courier} {s.number} · 배송 조회 →
                      </a>
                    ))}
                  </div>
                )}
                {order.cancel_status === '거절' && order.cancel_note && (
                  <p className="order-cancel-note">취소 요청 답변: {order.cancel_note}</p>
                )}
                {msg?.id === order.id && <p className="order-cancel-note">{msg.text}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
