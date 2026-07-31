import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import './Header.css'

export default function Header() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { itemCount } = useCart()

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    navigate(`/best?q=${encodeURIComponent(query.trim())}`)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          Farmday<span className="logo-dot">.</span>
        </Link>

        <form className="search-bar" onSubmit={handleSearch}>
          <button type="submit" className="search-icon-btn" aria-label="검색 실행">
            <Icon name="search" className="icon-sm search-icon" />
          </button>
          <input
            type="text"
            placeholder="상품, 브랜드를 검색해보세요"
            aria-label="검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <nav className="header-actions">
          <Link to="/notice" className="icon-btn" aria-label="공지사항">
            <Icon name="bell" />
            <span className="icon-dot" />
          </Link>
          <Link to="/cart" className="icon-btn" aria-label="장바구니">
            <Icon name="cart" />
            {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
          </Link>
          <Link to="/mypage" className="icon-btn icon-btn-user" aria-label="마이페이지">
            <Icon name="user" />
          </Link>
          {user ? (
            <button className="btn btn-sm btn-outline" onClick={handleSignOut}>
              로그아웃
            </button>
          ) : (
            <Link to="/login">
              <Button size="sm" variant="accent">로그인</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
