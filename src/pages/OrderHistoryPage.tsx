import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchOrders } from '../lib/orders'
import { DbOrder } from '../types/order'
import Button from '../components/ui/Button'
import './OrderHistoryPage.css'

export default function OrderHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    fetchOrders().then(({ data }) => {
      setOrders(data)
      setLoading(false)
    })
  }, [user])

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
          {orders.map((order) => (
            <div key={order.id} className="order-history-row">
              <div className="order-history-thumb" style={{ background: order.items[0]?.thumbnail }} />
              <div className="order-history-info">
                <p className="order-history-meta">
                  {new Date(order.created_at).toLocaleDateString('ko-KR')} · {order.id.slice(0, 8)}
                </p>
                <p className="order-history-name">
                  {order.items[0]?.name}
                  {order.items.length > 1 && (
                    <span className="order-history-qty"> 외 {order.items.length - 1}건</span>
                  )}
                </p>
                <p className="order-history-price">{order.total_amount.toLocaleString()}원</p>
              </div>
              <span className="order-status pending">{order.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
