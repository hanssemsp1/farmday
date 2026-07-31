import { MouseEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Product } from '../../types/product'
import Icon from '../ui/Icon'
import { useFavorites } from '../../context/FavoritesContext'
import { useCart } from '../../context/CartContext'
import './ProductCard.css'

const BADGE_LABEL: Record<NonNullable<Product['badges']>[number], string> = {
  best: 'BEST',
  new: 'NEW',
  sale: 'SALE',
}

export default function ProductCard({ product }: { product: Product }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addToCart } = useCart()
  const favorited = isFavorite(product.id)
  const [added, setAdded] = useState(false)

  function handleToggleFavorite(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggleFavorite(product.id)
  }

  function handleAddToCart(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    addToCart(product.id)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <Link
      to={`/product/${product.id}`}
      className={`product-card ${product.soldOut ? 'is-sold-out' : ''}`}
    >
      <div className="product-thumb" style={{ background: product.thumbnail }}>
        {product.soldOut && <div className="sold-out-overlay">SOLD OUT</div>}
        <button
          className={`wish-btn ${favorited ? 'active' : ''}`}
          aria-label={favorited ? '찜 해제' : '찜하기'}
          aria-pressed={favorited}
          onClick={handleToggleFavorite}
        >
          <Icon name="heart" className="icon-sm" />
        </button>
        {product.badges && product.badges.length > 0 && (
          <div className="product-badges">
            {product.badges.map((b) => (
              <span key={b} className={`badge badge-${b === 'sale' ? 'yellow' : b === 'new' ? 'accent' : 'green'}`}>
                {BADGE_LABEL[b]}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="product-info">
        <p className="product-brand">{product.brand}</p>
        <h3 className="product-name">{product.name}</h3>

        <div className="product-price-row">
          {product.discountRate && <span className="discount-rate">{product.discountRate}%</span>}
          <span className="product-price">{product.price.toLocaleString()}원</span>
        </div>
        {product.originalPrice && (
          <span className="product-original-price">{product.originalPrice.toLocaleString()}원</span>
        )}

        <div className="product-rating">
          <Icon name="star" className="icon-sm star-icon" />
          <span>{product.rating}</span>
          <span className="review-count">({product.reviewCount.toLocaleString()})</span>
        </div>

        <button
          className={`add-to-cart-btn ${added ? 'added' : ''}`}
          onClick={handleAddToCart}
          disabled={product.soldOut}
        >
          <Icon name="cart" className="icon-sm" />
          {product.soldOut ? '품절된 상품이에요' : added ? '담았어요!' : '장바구니 담기'}
        </button>
      </div>
    </Link>
  )
}
