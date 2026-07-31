import { Link } from 'react-router-dom'
import ProductGrid from '../components/product/ProductGrid'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { useFavorites } from '../context/FavoritesContext'
import { dummyProducts } from '../data/dummyProducts'
import './WishlistPage.css'

export default function WishlistPage() {
  const { favoriteIds } = useFavorites()
  const products = dummyProducts.filter((p) => favoriteIds.includes(p.id))

  return (
    <div className="container wishlist-page">
      <h1 className="wishlist-title">찜한 상품 ({products.length})</h1>

      {products.length === 0 ? (
        <div className="wishlist-empty">
          <Icon name="heart" className="icon-lg wishlist-empty-icon" />
          <p>아직 찜한 상품이 없어요.</p>
          <Link to="/best">
            <Button variant="accent">상품 보러가기</Button>
          </Link>
        </div>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  )
}
