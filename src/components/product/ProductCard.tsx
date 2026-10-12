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

// 카테고리마다 팜데이 앞치마 색 — 카드 위 작은 표식에 쓴다
const CATEGORY_KEY: Record<string, string> = {
  과일: 'fruit',
  야채: 'veg',
  수산: 'sea',
  축산: 'meat',
  식품: 'food',
  선물세트: 'gift',
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

  // 설명은 「한 줄 훅 — 품질 근거」 형태 — 카드에는 품질 근거 쪽을 보여 준다
  const [hook, proof] = (product.description ?? '').split(/\s+—\s+/)
  const quality = proof || hook

  return (
    <Link
      to={`/product/${product.id}`}
      className={`product-card ${product.soldOut ? 'is-sold-out' : ''}`}
    >
      {/* 썸네일 위에는 아무것도 얹지 않는다 — 대표 썸네일의 로고·제목을 가리지 않게 */}
      <div className="product-thumb" style={{ background: product.thumbnail }}>
        {product.soldOut && <div className="sold-out-overlay">SOLD OUT</div>}
      </div>

      <div className="product-info">
        <p className="product-meta">
          <span className={`product-cat cat-${CATEGORY_KEY[product.category] ?? 'food'}`}>{product.category}</span>
          {product.badges?.map((b) => (
            <span key={b} className={`product-flag flag-${b}`}>
              {BADGE_LABEL[b]}
            </span>
          ))}
        </p>
        <h3 className="product-name">{product.name}</h3>
        {quality && <p className="product-quality">{quality}</p>}

        <div className="product-price-row">
          {product.discountRate && <span className="discount-rate">{product.discountRate}%</span>}
          <span className="product-price">{product.price.toLocaleString()}</span>
          <span className="product-won">원</span>
        </div>
        {product.originalPrice && (
          <span className="product-original-price">{product.originalPrice.toLocaleString()}원</span>
        )}

        {product.reviewCount > 0 && (
          <div className="product-rating">
            <Icon name="star" className="icon-sm star-icon" />
            <span>{product.rating}</span>
            <span className="review-count">({product.reviewCount.toLocaleString()})</span>
          </div>
        )}

        <div className="product-actions">
          <button
            className={`wish-btn ${favorited ? 'active' : ''}`}
            aria-label={favorited ? '찜 해제' : '찜하기'}
            aria-pressed={favorited}
            onClick={handleToggleFavorite}
          >
            <Icon name="heart" className="icon-sm" />
          </button>
          <button
            className={`add-to-cart-btn ${added ? 'added' : ''}`}
            onClick={handleAddToCart}
            disabled={product.soldOut}
          >
            <Icon name="cart" className="icon-sm" />
            {product.soldOut ? '품절된 상품이에요' : added ? '담았어요!' : '장바구니 담기'}
          </button>
        </div>
      </div>
    </Link>
  )
}
