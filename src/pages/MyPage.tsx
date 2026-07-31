import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import { useFavorites } from '../context/FavoritesContext'
import { useAuth } from '../context/AuthContext'
import { fetchOrders } from '../lib/orders'
import { fetchNotifications } from '../lib/notifications'
import { DbOrder } from '../types/order'
import './MyPage.css'

export default function MyPage() {
  const { favoriteIds } = useFavorites()
  const { user, loading, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState<DbOrder[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!loading && !user) navigate('/login')
  }, [loading, user, navigate])

  useEffect(() => {
    if (user) fetchOrders().then(({ data }) => setOrders(data))
  }, [user])

  useEffect(() => {
    if (user) fetchNotifications().then(({ data }) => setUnreadCount(data.filter((n) => !n.read).length))
  }, [user])

  function startEditing() {
    setNameInput((user?.user_metadata?.name as string | undefined) ?? '')
    setEditing(true)
  }

  async function handleSaveName() {
    setSaving(true)
    await updateProfile(nameInput.trim())
    setSaving(false)
    setEditing(false)
  }

  const MENU_ITEMS = [
    { label: '주문내역', icon: 'tag' as const, value: `${orders.length}건`, to: '/mypage/orders' },
    { label: '찜한 상품', icon: 'heart' as const, value: `${favoriteIds.length}개`, to: '/wishlist' },
    { label: '쿠폰함', icon: 'gift' as const, value: '2장', to: '/mypage/coupons' },
    { label: '적립금', icon: 'sparkles' as const, value: '3,000P', to: '/mypage/points' },
    { label: '알림', icon: 'bell' as const, value: `${unreadCount}개`, to: '/mypage/notifications' },
  ]

  if (loading || !user) return null

  const displayName = (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || '회원'
  const recentOrders = orders.slice(0, 3)

  return (
    <div className="container mypage">
      <h1 className="mypage-title">마이페이지</h1>

      <section className="profile-card">
        <div className="profile-avatar">
          <Icon name="user" className="icon-lg" />
        </div>
        <div className="profile-info">
          {editing ? (
            <input
              className="profile-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="이름"
              autoFocus
            />
          ) : (
            <p className="profile-name">{displayName}님</p>
          )}
          <p className="profile-email">{user.email}</p>
          <span className="badge badge-accent">일반 회원</span>
        </div>
        {editing ? (
          <button className="profile-edit" onClick={handleSaveName} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        ) : (
          <button className="profile-edit" onClick={startEditing}>회원정보 수정</button>
        )}
      </section>

      <section className="menu-grid">
        {MENU_ITEMS.map((item) => (
          <Link key={item.label} to={item.to} className="menu-tile">
            <Icon name={item.icon} className="menu-tile-icon" />
            <p className="menu-tile-value">{item.value}</p>
            <p className="menu-tile-label">{item.label}</p>
          </Link>
        ))}
      </section>

      <section className="mypage-section">
        <div className="mypage-section-head">
          <h2>최근 주문</h2>
          <Link to="/mypage/orders" className="more-link">
            전체보기
            <Icon name="chevron-right" className="icon-sm" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="order-empty-hint">아직 주문 내역이 없어요.</p>
        ) : (
          <div className="order-list">
            {recentOrders.map((order) => (
              <div key={order.id} className="order-row">
                <div className="order-thumb" style={{ background: order.items[0]?.thumbnail }} />
                <div className="order-info">
                  <p className="order-meta">{new Date(order.created_at).toLocaleDateString('ko-KR')}</p>
                  <p className="order-name">
                    {order.items[0]?.name}
                    {order.items[0]?.optionName && ` (${order.items[0].optionName})`}
                    {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                  </p>
                </div>
                <span className="order-status progress">{order.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mypage-section">
        <h2>고객 지원</h2>
        <div className="support-links">
          <Link to="/board" className="support-link">
            <span>게시판</span>
            <Icon name="chevron-right" className="icon-sm" />
          </Link>
          <a href="#" className="support-link">
            <span>1:1 문의</span>
            <Icon name="chevron-right" className="icon-sm" />
          </a>
          <Link to="/notice" className="support-link">
            <span>공지사항</span>
            <Icon name="chevron-right" className="icon-sm" />
          </Link>
        </div>
      </section>
    </div>
  )
}
