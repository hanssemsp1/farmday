import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'
import { useCart, CartLine } from '../context/CartContext'
import { createOrder } from '../lib/orders'
import { requestTossPayment } from '../lib/toss'
import './CartPage.css'

const FREE_SHIPPING_THRESHOLD = 30000
const SHIPPING_FEE = 3000

export default function CartPage() {
  const { lines, toggleAll, toggleLine, updateQuantity, removeLine, removeSelected, removeLines } = useCart()
  const { products, loading: productsLoading } = useProducts()
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  const items = useMemo(
    () =>
      lines
        .map((line) => ({ line, product: products.find((p) => p.id === line.productId) }))
        .filter((x): x is { line: CartLine; product: (typeof products)[number] } => !!x.product),
    [lines, products],
  )

  const allSelected = items.length > 0 && items.every((i) => i.line.selected)
  const selectedItems = items.filter((i) => i.line.selected)
  const subtotal = selectedItems.reduce(
    (sum, i) => sum + (i.line.optionPrice ?? i.product.price) * i.line.quantity,
    0,
  )
  const shipping = selectedItems.length === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE
  const total = subtotal + shipping

  async function handleCheckout() {
    if (!user) {
      navigate('/login')
      return
    }
    setSubmitting(true)
    setNotice('')
    const orderItems = selectedItems.map(({ product, line }) => ({
      productId: product.id,
      name: product.name,
      brand: product.brand,
      price: line.optionPrice ?? product.price,
      quantity: line.quantity,
      thumbnail: product.thumbnail,
      optionName: line.optionName,
    }))
    const { data: order, error } = await createOrder(orderItems, total)
    if (error || !order) {
      setSubmitting(false)
      setNotice(`주문 처리 중 오류가 발생했어요: ${error}`)
      return
    }
    removeLines(selectedItems.map(({ product, line }) => ({ productId: product.id, optionId: line.optionId })))

    try {
      await requestTossPayment({
        orderId: order.id,
        orderName:
          orderItems.length > 1 ? `${orderItems[0].name} 외 ${orderItems.length - 1}건` : orderItems[0].name,
        amount: total,
        customerName: (user.user_metadata?.name as string | undefined) || user.email!.split('@')[0],
        customerEmail: user.email!,
      })
    } catch (paymentError) {
      setSubmitting(false)
      setNotice(
        paymentError instanceof Error ? paymentError.message : '결제창을 여는 중 오류가 발생했어요.',
      )
    }
  }

  if (productsLoading) return null

  if (items.length === 0 && !submitting && !notice) {
    return (
      <div className="container cart-page">
        <h1 className="cart-title">장바구니</h1>
        <div className="cart-empty">
          <Icon name="cart" className="icon-lg cart-empty-icon" />
          <p>장바구니가 비어있어요.</p>
          <Link to="/best">
            <Button variant="accent">쇼핑하러 가기</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="container cart-page">
        <h1 className="cart-title">장바구니</h1>
        <div className="cart-empty">
          {submitting ? <p>결제창을 여는 중이에요...</p> : <p className="cart-demo-note">{notice}</p>}
          <Link to="/best">
            <Button variant="outline">쇼핑 계속하기</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container cart-page">
      <h1 className="cart-title">장바구니 ({items.length})</h1>

      <div className="cart-layout">
        <div className="cart-list">
          <div className="cart-list-head">
            <label className="cart-checkbox">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} />
              전체선택 ({selectedItems.length}/{items.length})
            </label>
            <button className="cart-remove-selected" onClick={removeSelected}>
              선택삭제
            </button>
          </div>

          {items.map(({ line, product }) => {
            const unitPrice = line.optionPrice ?? product.price
            return (
              <div key={`${product.id}::${line.optionId ?? ''}`} className="cart-item">
                <label className="cart-checkbox">
                  <input
                    type="checkbox"
                    checked={line.selected}
                    onChange={(e) => toggleLine(product.id, line.optionId, e.target.checked)}
                  />
                </label>

                <div className="cart-item-thumb" style={{ background: product.thumbnail }} />

                <div className="cart-item-info">
                  <p className="cart-item-brand">{product.brand}</p>
                  <p className="cart-item-name">{product.name}</p>
                  {line.optionName && <p className="cart-item-option">옵션: {line.optionName}</p>}
                  <p className="cart-item-price">{unitPrice.toLocaleString()}원</p>
                </div>

                <div className="cart-item-qty">
                  <button
                    className="qty-btn"
                    aria-label="수량 감소"
                    onClick={() => updateQuantity(product.id, line.optionId, -1)}
                    disabled={line.quantity <= 1}
                  >
                    <Icon name="minus" className="icon-sm" />
                  </button>
                  <span className="qty-value">{line.quantity}</span>
                  <button
                    className="qty-btn"
                    aria-label="수량 증가"
                    onClick={() => updateQuantity(product.id, line.optionId, 1)}
                  >
                    <Icon name="plus" className="icon-sm" />
                  </button>
                </div>

                <div className="cart-item-subtotal">{(unitPrice * line.quantity).toLocaleString()}원</div>

                <button
                  className="cart-item-remove"
                  aria-label="삭제"
                  onClick={() => removeLine(product.id, line.optionId)}
                >
                  <Icon name="trash" className="icon-sm" />
                </button>
              </div>
            )
          })}
        </div>

        <aside className="cart-summary">
          <h2>주문 요약</h2>
          <div className="summary-row">
            <span>상품금액</span>
            <span>{subtotal.toLocaleString()}원</span>
          </div>
          <div className="summary-row">
            <span>배송비</span>
            <span>{shipping === 0 ? '무료' : `${shipping.toLocaleString()}원`}</span>
          </div>
          {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD && (
            <p className="summary-hint">
              {(FREE_SHIPPING_THRESHOLD - subtotal).toLocaleString()}원 더 담으면 무료배송이에요
            </p>
          )}
          <div className="summary-divider" />
          <div className="summary-row summary-total">
            <span>총 결제금액</span>
            <span>{total.toLocaleString()}원</span>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="checkout-btn"
            disabled={selectedItems.length === 0 || submitting}
            onClick={handleCheckout}
          >
            {submitting
              ? '주문 처리 중...'
              : selectedItems.length > 0
                ? `${selectedItems.length}개 상품 주문하기`
                : '상품을 선택해주세요'}
          </Button>
          {notice && <p className="cart-demo-note">{notice}</p>}
        </aside>
      </div>
    </div>
  )
}
