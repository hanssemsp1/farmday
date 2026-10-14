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
  const { addToCart, toggleAll, toggleLine } = useCart()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setSlide(0)
    fetchProductById(id).then(({ data }) => {
      setProduct(data)
      setLoading(false)
      if (data?.options && data.options.length > 0) {
        const firstAvailable = data.options.find((o) => !o.soldOut) ?? data.options[0]
        setSelectedOptionId(firstAvailable.id)
      }
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
  // 추가 썸네일은 이미지 주소만 들어 있으므로 대표 썸네일과 같은 배경 형식으로 맞춘다
  const slides = [product.thumbnail, ...(product.thumbnails ?? []).map((u) => `url("${u}") center/cover no-repeat`)]
  const hasOptions = !!product.options && product.options.length > 0
  const selectedOption = hasOptions ? product.options!.find((o) => o.id === selectedOptionId) : undefined
  const effectivePrice = selectedOption ? selectedOption.price : product.price
  const effectiveSoldOut = hasOptions ? (selectedOption?.soldOut ?? true) : !!product.soldOut

  function handleAddToCart() {
    addToCart(
      product!.id,
      quantity,
      selectedOption ? { id: selectedOption.id, name: selectedOption.name, price: selectedOption.price } : undefined,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  // 바로 구매: 장바구니의 다른 상품은 선택을 풀고, 이 상품(고른 옵션)만 선택해 장바구니 주문 화면으로 간다
  function handleBuyNow() {
    const option = selectedOption ? { id: selectedOption.id, name: selectedOption.name, price: selectedOption.price } : undefined
    toggleAll(false)
    addToCart(product!.id, quantity, option)
    toggleLine(product!.id, option?.id, true)
    navigate('/cart')
  }

  return (
    <div className="container product-detail">
      <div className="pd-layout">
        <div className="pd-media">
          {/* 대표 썸네일 + 추가 썸네일을 옆으로 넘겨 본다. 썸네일 위에는 배지를 얹지 않는다(로고·제목을 가리지 않게) */}
          <div className="pd-thumb" style={{ background: slides[slide] }}>
            {effectiveSoldOut && <div className="sold-out-overlay">SOLD OUT</div>}
            {slides.length > 1 && (
              <>
                <button className="pd-nav prev" aria-label="이전 사진" onClick={() => setSlide((slide - 1 + slides.length) % slides.length)}>
                  <Icon name="chevron-right" className="icon-sm" />
                </button>
                <button className="pd-nav next" aria-label="다음 사진" onClick={() => setSlide((slide + 1) % slides.length)}>
                  <Icon name="chevron-right" className="icon-sm" />
                </button>
                <span className="pd-count">{slide + 1} / {slides.length}</span>
              </>
            )}
          </div>
          {slides.length > 1 && (
            <div className="pd-strip">
              {slides.map((bg, i) => (
                <button
                  key={i}
                  className={`pd-strip-item ${i === slide ? 'active' : ''}`}
                  style={{ background: bg }}
                  aria-label={`${i + 1}번째 사진 보기`}
                  onClick={() => setSlide(i)}
                />
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
            {!hasOptions && product.discountRate && <span className="discount-rate">{product.discountRate}%</span>}
            <span className="pd-price">{effectivePrice.toLocaleString()}원</span>
            {!hasOptions && product.originalPrice && (
              <span className="product-original-price">{product.originalPrice.toLocaleString()}원</span>
            )}
          </div>

          <div className="pd-divider" />

          {hasOptions && (
            <div className="pd-qty-row">
              <span>옵션</span>
              <select
                className="pd-option-select"
                value={selectedOptionId ?? ''}
                onChange={(e) => setSelectedOptionId(e.target.value)}
              >
                {product.options!.map((o) => (
                  <option key={o.id} value={o.id} disabled={o.soldOut}>
                    {o.name} — {o.price.toLocaleString()}원{o.soldOut ? ' (품절)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

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
            <strong>{(effectivePrice * quantity).toLocaleString()}원</strong>
          </div>

          <div className="pd-actions">
            <button
              className={`wish-btn pd-wish-btn ${favorited ? 'active' : ''}`}
              aria-label={favorited ? '찜 해제' : '찜하기'}
              onClick={() => toggleFavorite(product.id)}
            >
              <Icon name="heart" />
            </button>
            {!effectiveSoldOut ? (
              <>
                <Button variant="outline" size="lg" className="pd-add-btn" onClick={handleAddToCart}>
                  {added ? '장바구니에 담았어요!' : '장바구니 담기'}
                </Button>
                <Button variant="primary" size="lg" className="pd-add-btn" onClick={handleBuyNow}>
                  바로 구매
                </Button>
              </>
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
