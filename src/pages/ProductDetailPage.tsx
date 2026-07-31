import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { useFavorites } from '../context/FavoritesContext'
import { useCart } from '../context/CartContext'
import { fetchProductById } from '../lib/products'
import { Product } from '../types/product'
import './ProductDetailPage.css'

export default function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addToCart } = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchProductById(id).then(({ data }) => {
      setProduct(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return null

  if (!product) {
    return (
      <div className="container product-detail">
        <p className="pd-empty">존재하지 않는 상품이에요.</p>
        <Link to="/best">
          <Button variant="outline">목록으로</Button>
        </Link>
      </div>
    )
  }

  const favorited = isFavorite(product.id)

  function handleAddToCart() {
    addToCart(product!.id, quantity)
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="container product-detail">
      <div className="pd-layout">
        <div className="pd-thumb" style={{ background: product.thumbnail }}>
          {product.soldOut && <div className="sold-out-overlay">SOLD OUT</div>}
          {product.badges && product.badges.length > 0 && (
            <div className="product-badges">
              {product.badges.map((b) => (
                <span key={b} className={`badge badge-${b === 'sale' ? 'yellow' : b === 'new' ? 'accent' : 'green'}`}>
                  {b === 'best' ? 'BEST' : b === 'new' ? 'NEW' : 'SALE'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="pd-info">
          <p className="pd-brand">{product.brand}</p>
          <h1 className="pd-name">{product.name}</h1>

          <div className="pd-rating">
            <Icon name="star" className="icon-sm star-icon" />
            <span>{product.rating}</span>
            <span className="review-count">({product.reviewCount.toLocaleString()})</span>
          </div>

          <div className="pd-price-block">
            {product.discountRate && <span className="discount-rate">{product.discountRate}%</span>}
            <span className="pd-price">{product.price.toLocaleString()}원</span>
            {product.originalPrice && (
              <span className="product-original-price">{product.originalPrice.toLocaleString()}원</span>
            )}
          </div>

          <div className="pd-divider" />

          <div className="pd-qty-row">
            <span>수량</span>
            <div className="cart-item-qty">
              <button
                className="qty-btn"
                aria-label="수량 감소"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Icon name="minus" className="icon-sm" />
              </button>
              <span className="qty-value">{quantity}</span>
              <button className="qty-btn" aria-label="수량 증가" onClick={() => setQuantity((q) => Math.min(99, q + 1))}>
                <Icon name="plus" className="icon-sm" />
              </button>
            </div>
          </div>

          <div className="pd-total-row">
            <span>총 상품금액</span>
            <strong>{(product.price * quantity).toLocaleString()}원</strong>
          </div>

          <div className="pd-actions">
            <button
              className={`wish-btn pd-wish-btn ${favorited ? 'active' : ''}`}
              aria-label={favorited ? '찜 해제' : '찜하기'}
              onClick={() => toggleFavorite(product.id)}
            >
              <Icon name="heart" />
            </button>
            {!product.soldOut ? (
              <Button variant="primary" size="lg" className="pd-add-btn" onClick={handleAddToCart}>
                {added ? '장바구니에 담았어요!' : '장바구니 담기'}
              </Button>
            ) : (
              <Button variant="outline" size="lg" className="pd-add-btn" disabled>
                품절된 상품이에요
              </Button>
            )}
          </div>
          <Button variant="outline" className="pd-cart-link-btn" onClick={() => navigate('/cart')}>
            바로 장바구니 보기
          </Button>
        </div>
      </div>

      <div className="pd-description">
        <h2>상품 설명</h2>
        {product.description ? (
          product.description.split('\n').map((line, i) => <p key={i}>{line || ' '}</p>)
        ) : (
          <p className="pd-no-description">등록된 상세 설명이 없어요.</p>
        )}
      </div>

      {product.detailImages && product.detailImages.length > 0 && (
        <div className="pd-gallery">
          {product.detailImages.map((url, i) => (
            <img key={url} src={url} alt={`${product.name} 상세 이미지 ${i + 1}`} className="pd-gallery-img" />
          ))}
        </div>
      )}
    </div>
  )
}
