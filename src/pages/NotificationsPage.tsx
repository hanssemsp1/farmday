import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchNotifications, markAllAsRead, markAsRead } from '../lib/notifications'
import { DbNotification } from '../types/notification'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<DbNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !user) navigate('/login')
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (!user) return
    fetchNotifications().then(({ data }) => {
      setItems(data)
      setLoading(false)
    })
  }, [user])

  async function handleClick(n: DbNotification) {
    if (!n.read) {
      await markAsRead(n.id)
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, read: true } : i)))
    }
    if (n.link) navigate(n.link)
  }

  async function handleMarkAllRead() {
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id)
    if (unreadIds.length === 0) return
    await markAllAsRead(unreadIds)
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
  }

  if (authLoading || loading) return null

  const unreadCount = items.filter((i) => !i.read).length

  return (
    <div className="container notifications-page">
      <div className="notifications-head">
        <h1>알림 ({items.length})</h1>
        {unreadCount > 0 && (
          <button className="mark-all-read" onClick={handleMarkAllRead}>
            모두 읽음 처리
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="notifications-empty">
          <Icon name="bell" className="icon-lg" />
          <p>아직 알림이 없어요.</p>
          <Link to="/best">
            <Button variant="accent">쇼핑하러 가기</Button>
          </Link>
        </div>
      ) : (
        <ul className="notifications-list">
          {items.map((n) => (
            <li key={n.id}>
              <button className={`notification-row ${n.read ? '' : 'unread'}`} onClick={() => handleClick(n)}>
                {!n.read && <span className="unread-dot" />}
                <div className="notification-body">
                  <p className="notification-title">{n.title}</p>
                  <p className="notification-text">{n.body}</p>
                  <p className="notification-date">{new Date(n.created_at).toLocaleString('ko-KR')}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
