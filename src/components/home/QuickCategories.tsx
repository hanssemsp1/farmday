import { Link } from 'react-router-dom'
import Icon from '../ui/Icon'
import './QuickCategories.css'

const ITEMS = [
  { label: '과일', icon: 'apple', color: '#E01E5A' },
  { label: '야채', icon: 'leaf', color: '#2EB67D' },
  { label: '수산', icon: 'fish', color: '#1264A3' },
  { label: '축산', icon: 'meat', color: '#4A154B' },
  { label: '선물세트', icon: 'gift', color: '#ECB22E' },
  { label: '식품', icon: 'can', color: '#1264A3' },
] as const

export default function QuickCategories() {
  return (
    <section className="container quick-categories">
      {ITEMS.map((item) => (
        <Link key={item.label} to={`/best?category=${encodeURIComponent(item.label)}`} className="quick-item">
          <span className="quick-icon" style={{ background: `${item.color}1A`, color: item.color }}>
            <Icon name={item.icon} />
          </span>
          <span className="quick-label">{item.label}</span>
        </Link>
      ))}
    </section>
  )
}
