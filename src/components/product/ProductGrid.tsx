import { Product } from '../../types/product'
import ProductCard from './ProductCard'
import './ProductGrid.css'

export default function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}
