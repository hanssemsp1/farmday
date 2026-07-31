import { Link } from 'react-router-dom'
import { Product } from '../../types/product'
import ProductGrid from '../product/ProductGrid'
import Icon from '../ui/Icon'
import './ProductSection.css'

interface ProductSectionProps {
  title: string
  subtitle?: string
  products: Product[]
  moreTo?: string
}

export default function ProductSection({ title, subtitle, products, moreTo }: ProductSectionProps) {
  return (
    <section className="container product-section">
      <div className="product-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="product-section-subtitle">{subtitle}</p>}
        </div>
        {moreTo && (
          <Link to={moreTo} className="more-link">
            더보기
            <Icon name="chevron-right" className="icon-sm" />
          </Link>
        )}
      </div>
      <ProductGrid products={products} />
    </section>
  )
}
