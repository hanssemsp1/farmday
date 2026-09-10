import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { useAuth } from '../../context/AuthContext'
import { useCart } from '../../context/CartContext'
import { useFavorites } from '../../context/FavoritesContext'
import { useSiteSettings } from '../../context/SiteSettingsContext'
import { isAdmin } from '../../lib/adminConfig'
import './Header.css'

export default function Header() {
  const [query, setQuery] = useState('')
  const [round, setRound] = useState(false)
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { itemCount } = useCart()
  const { favoriteIds } = useFavorites()
  const { settings } = useSiteSettings()

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
          {/* 로고를 올리면 그림으로, 안 올렸으면 지금처럼 글자로.
              동그란 로고는 가로로 긴 로고와 같은 높이로 두면 너무 작아진다 —
              모양을 재서 동그란 쪽은 키운다. */}
          {settings?.logoHeader
            ? <img src={settings.logoHeader} alt={settings.companyName || 'Farmday'}
              className={`logo-img ${round ? 'logo-round' : ''}`}
              onLoad={(e) => setRound(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight < 1.7)} />
            : <>Farmday<span className="logo-dot">.</span></>}
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
          <Link to="/wishlist" className="icon-btn" aria-label="찜한 상품">
            <Icon name="heart" />
            {favoriteIds.length > 0 && <span className="cart-count">{favoriteIds.length}</span>}
          </Link>
          <Link to="/cart" className="icon-btn" aria-label="장바구니">
            <Icon name="cart" />
            {itemCount > 0 && <span className="cart-count">{itemCount}</span>}
          </Link>
          <Link to="/mypage" className="icon-btn icon-btn-user" aria-label="마이페이지">
            <Icon name="user" />
          </Link>
          {isAdmin(user) && (
            <>
              <Link to="/admin/products" className="btn btn-sm btn-outline">
                상품 관리
              </Link>
              <Link to="/admin/planning" className="btn btn-sm btn-outline">
                상품 기획
              </Link>
              <Link to="/admin/diary" className="btn btn-sm btn-outline">
                다이어리
              </Link>
              <Link to="/admin/settings" className="btn btn-sm btn-outline">
                사이트 설정
              </Link>
            </>
          )}
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
