import { Link, useLocation } from 'react-router-dom'
import Icon from '../ui/Icon'
import './CategoryNav.css'

interface CategoryItem {
  label: string
  icon?: 'apple' | 'leaf' | 'fish' | 'meat' | 'gift' | 'can'
  category?: string
}

const CATEGORIES: CategoryItem[] = [
  { label: '전체보기' },
  { label: '과일', icon: 'apple', category: '과일' },
  { label: '야채', icon: 'leaf', category: '야채' },
  { label: '수산', icon: 'fish', category: '수산' },
  { label: '축산', icon: 'meat', category: '축산' },
  { label: '선물세트', icon: 'gift', category: '선물세트' },
  { label: '식품', icon: 'can', category: '식품' },
]

export default function CategoryNav() {
  const { pathname, search } = useLocation()
  const activeCategory = new URLSearchParams(search).get('category') ?? ''

  return (
    <nav className="category-nav">
      <div className="container category-nav-inner">
        {CATEGORIES.map((c) => {
          const to = c.category ? `/best?category=${encodeURIComponent(c.category)}` : '/best'
          const isActive = pathname === '/best' && (c.category ?? '') === activeCategory
          return (
            <Link key={c.label} to={to} className={`category-link ${isActive ? 'active' : ''}`}>
              {c.icon && <Icon name={c.icon} className="icon-sm category-icon" />}
              {c.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
