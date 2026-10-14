import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { useProducts } from '../context/ProductsContext'
import { useAuth } from '../context/AuthContext'
import { useCart, CartLine } from '../context/CartContext'
import { createOrder } from '../lib/orders'
import { requestTossPayment } from '../lib/toss'
import { BUSINESS, ORDERS_OPEN } from '../config/business'
import { fetchFirstOrderCoupon, FIRST_ORDER_COUPON } from '../lib/coupon'
import { computeTotals } from '../../supabase/functions/_shared/pricing'
import ShippingForm, { emptyShipping, shippingProblem } from '../components/checkout/ShippingForm'
import type { ShippingInfo } from '../types/order'
import { createGuestOrder, rememberGuestCheckout } from '../lib/guestOrder'
import './CartPage.css'

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
  // 첫 구매 여부(결제 완료 주문 0건) — 최종 판정은 결제 승인 서버가 DB로 다시 한다
  const [isFirstOrder, setIsFirstOrder] = useState(false)
  useEffect(() => {
    let alive = true
    fetchFirstOrderCoupon(user?.id).then((s) => {
      if (alive) setIsFirstOrder(s.available)
    })
    return () => {
      alive = false
    }
  }, [user?.id])
  const { shipping, coupon, total, couponShortBy } = computeTotals(subtotal, isFirstOrder, selectedItems.length > 0)

  // 배송지 — 지난번 주소를 이 기기에 기억해 두고 불러온다 (동의 칸은 매번 새로)
  const shipKey = user ? 'farmday_ship_' + user.id : ''
  const [ship, setShip] = useState<ShippingInfo>(() => emptyShipping())
  useEffect(() => {
    if (!user) return
    try {
      const saved = localStorage.getItem('farmday_ship_' + user.id)
      if (saved) {
        setShip({ ...emptyShipping(), ...JSON.parse(saved), consent: false })
        return
      }
    } catch {
      /* 저장소 못 쓰면 빈 칸 */
    }
    // 처음 주문이면 회원가입 때 적은 이름·연락처·주소로 채운다
    const m = (user.user_metadata ?? {}) as Record<string, string | undefined>
    setShip({
      ...emptyShipping(m.name ?? '', m.phone ?? ''),
      zipcode: m.zipcode ?? '',
      address1: m.zipcode ? m.address ?? '' : '', // 옛 가입(우편번호 없이 손으로 적은 주소)은 주소 찾기로 다시 고르게
      address2: m.address2 ?? '',
    })
  }, [user])

  // 비회원 주문 — 로그인 안 한 손님이 「비회원으로 주문」을 고르면 배송지 + 이메일·조회 비밀번호를 받는다
  const [guestMode, setGuestMode] = useState(false)
  const [askSignup, setAskSignup] = useState(false)
  function startGuest() {
    setAskSignup(false)
    setNotice('')
    setGuestMode(true)
    setTimeout(() => document.querySelector('.ship-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  // 회원이면 이 장바구니가 얼마가 되는지 — 안내 창에 보여 준다
  const asMember = computeTotals(subtotal, true, selectedItems.length > 0)
  const [guest, setGuest] = useState({ email: '', pin: '', pin2: '', privacy: false })
  const guestOn = !user && guestMode

  function guestProblem(): string | null {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) return '주문 안내를 받을 이메일을 확인해 주세요.'
    if (!/^\d{4,6}$/.test(guest.pin)) return '주문 조회 비밀번호를 숫자 4~6자리로 정해 주세요.'
    if (guest.pin !== guest.pin2) return '주문 조회 비밀번호가 서로 달라요.'
    if (!guest.privacy) return '비회원 주문 개인정보 수집·이용에 동의해 주세요.'
    return null
  }

  async function handleCheckout() {
    if (!ORDERS_OPEN) {
      window.open(BUSINESS.kakaoChannel, '_blank', 'noopener,noreferrer')
      return
    }
    if (!user && !guestMode) {
      // 비회원 주문 전에 한 번 — 「회원가입하면 첫 구매 3,000원 할인」 안내
      setAskSignup(true)
      return
    }
    const problem = shippingProblem(ship) ?? (guestOn ? guestProblem() : null)
    if (problem) {
      setNotice(problem)
      document.querySelector(shippingProblem(ship) ? '.ship-form' : '.guest-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (user) {
      try {
        localStorage.setItem(shipKey, JSON.stringify({ ...ship, consent: false }))
      } catch {
        /* 무시 */
      }
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
      optionId: line.optionId,
      optionName: line.optionName,
    }))
    let orderId: string
    if (user) {
      const { data: order, error } = await createOrder(orderItems, total, ship, user.id)
      if (error || !order) {
        setSubmitting(false)
        setNotice(`주문 처리 중 오류가 발생했어요: ${error}`)
        return
      }
      orderId = order.id
    } else {
      // 비회원 주문은 서버가 만든다 — 결제 확인용 일회용 표를 이 탭에 적어 둔다
      const r = await createGuestOrder(orderItems, ship, guest.email.trim(), guest.pin, guest.privacy)
      if (!r.ok || !r.orderId || !r.token) {
        setSubmitting(false)
        setNotice(r.message ?? '주문을 만들지 못했어요.')
        return
      }
      orderId = r.orderId
      rememberGuestCheckout(orderId, r.token, orderItems, { orderNo: r.orderNo ?? '', phone: ship.buyerPhone })
    }
    removeLines(selectedItems.map(({ product, line }) => ({ productId: product.id, optionId: line.optionId })))

    try {
      await requestTossPayment({
        orderId,
        orderName:
          orderItems.length > 1 ? `${orderItems[0].name} 외 ${orderItems.length - 1}건` : orderItems[0].name,
        amount: total,
        customerName: ship.buyerName.trim() || (user?.user_metadata?.name as string | undefined) || user?.email?.split('@')[0] || '고객',
        customerEmail: user ? user.email! : guest.email.trim(),
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
          <div className="cart-empty-actions">
            <Link to="/best">
              <Button variant="accent">쇼핑하러 가기</Button>
            </Link>
            {user && (
              <Link to="/mypage/orders">
                <Button variant="outline">주문내역 보기</Button>
              </Link>
            )}
          </div>
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
        <div className="cart-main">
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
        {/* 결제가 열려 있고 로그인했거나 「비회원으로 주문」을 골랐을 때 배송지를 받는다 */}
        {ORDERS_OPEN && (user || guestOn) && <ShippingForm value={ship} onChange={setShip} />}
        {ORDERS_OPEN && guestOn && (
          <section className="ship-form guest-form">
            <h2>비회원 주문 정보</h2>
            <p className="guest-form-hint">
              주문을 확인하거나 취소할 때 <b>주문번호 + 휴대폰 번호 + 조회 비밀번호</b>가 필요해요. 결제가 끝나면 주문번호를 알려 드려요.
            </p>
            <input
              className="ship-full"
              type="email"
              value={guest.email}
              onChange={(e) => setGuest({ ...guest, email: e.target.value.slice(0, 120) })}
              placeholder="이메일 (결제·주문 안내를 받을 주소)"
              autoComplete="email"
            />
            <div className="ship-grid">
              <label>
                주문 조회 비밀번호
                <input
                  type="password"
                  inputMode="numeric"
                  value={guest.pin}
                  onChange={(e) => setGuest({ ...guest, pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="숫자 4~6자리"
                  autoComplete="new-password"
                />
              </label>
              <label>
                비밀번호 확인
                <input
                  type="password"
                  inputMode="numeric"
                  value={guest.pin2}
                  onChange={(e) => setGuest({ ...guest, pin2: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="한 번 더"
                  autoComplete="new-password"
                />
              </label>
            </div>
            <label className="ship-check ship-consent">
              <input type="checkbox" checked={guest.privacy} onChange={(e) => setGuest({ ...guest, privacy: e.target.checked })} />
              <span>
                <b>[필수]</b> 비회원 주문 개인정보 수집·이용 동의 — 수집 항목: 주문하시는 분·받는 분 이름, 휴대폰 번호, 이메일, 배송지 / 목적: 주문·결제·배송,
                주문 조회·취소, 고객 상담 / 보관 기간: 전자상거래법에 따라 계약·결제·배송 기록은 5년, 소비자 불만·분쟁 처리 기록은 3년 보관 뒤 파기.
                동의하지 않으면 비회원 주문을 할 수 없어요. <Link to="/privacy" target="_blank">개인정보처리방침</Link>
              </span>
            </label>
          </section>
        )}
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
          {coupon > 0 && (
            <div className="summary-row summary-coupon">
              <span>{FIRST_ORDER_COUPON.title}</span>
              <span>−{coupon.toLocaleString()}원</span>
            </div>
          )}
          {couponShortBy > 0 && (
            <p className="summary-hint">
              {couponShortBy.toLocaleString()}원 더 담으면 첫 구매 {FIRST_ORDER_COUPON.amount.toLocaleString()}원 할인이에요
            </p>
          )}
          {!user && subtotal > 0 && (
            <p className="summary-hint summary-hint-muted">
              <Link to="/signup">회원가입</Link>하면 첫 구매 {FIRST_ORDER_COUPON.minSubtotal / 10000}만 원 이상{' '}
              {FIRST_ORDER_COUPON.amount.toLocaleString()}원 할인 쿠폰을 받을 수 있어요
              {guestOn && ' (비회원 주문에는 쿠폰이 적용되지 않아요)'}
            </p>
          )}
          <div className="summary-divider" />
          <div className="summary-row summary-total">
            <span>총 결제금액</span>
            <span>{total.toLocaleString()}원</span>
          </div>
          {ORDERS_OPEN ? (
            <Button
              variant="primary"
              size="lg"
              className="checkout-btn"
              disabled={selectedItems.length === 0 || submitting}
              onClick={handleCheckout}
            >
              {submitting
                ? '주문 처리 중...'
                : selectedItems.length === 0
                  ? '상품을 선택해주세요'
                  : !user && !guestMode
                    ? '비회원으로 주문하기'
                    : `${selectedItems.length}개 상품 ${guestOn ? '비회원으로 ' : ''}주문하기`}
            </Button>
          ) : null}
          {ORDERS_OPEN && !user && selectedItems.length > 0 && (
            <button
              type="button"
              className="guest-toggle"
              onClick={() => {
                setNotice('')
                if (guestMode) setGuestMode(false)
                else navigate('/login?next=/cart')
              }}
            >
              {guestMode ? '비회원 주문 그만두기' : '로그인하고 주문하기'}
            </button>
          )}
          {ORDERS_OPEN ? null : (
            <>
              <a
                className="btn btn-lg checkout-btn checkout-kakao"
                href={BUSINESS.kakaoChannel}
                target="_blank"
                rel="noopener noreferrer"
              >
                카카오채널로 주문하기
              </a>
              <p className="cart-demo-note">
                지금은 카카오채널로 주문받아요. 담으신 상품과 옵션을 보내 주시면 바로 안내해 드려요.
              </p>
            </>
          )}
          {notice && <p className="cart-demo-note">{notice}</p>}
        </aside>
      </div>

      {askSignup && (
        <div className="signup-ask-bg" onClick={() => setAskSignup(false)}>
          <div className="signup-ask" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="signup-ask-x" aria-label="닫기" onClick={() => setAskSignup(false)}>×</button>
            <p className="signup-ask-tag">회원 첫 구매 혜택</p>
            <h2>
              회원가입하면 바로
              <br />
              <strong>{FIRST_ORDER_COUPON.amount.toLocaleString()}원 할인</strong>
            </h2>
            <p className="signup-ask-desc">
              첫 주문 {FIRST_ORDER_COUPON.minSubtotal / 10000}만 원 이상이면 {FIRST_ORDER_COUPON.amount.toLocaleString()}원을 바로 빼 드려요.
              가입은 1분이면 끝나요.
            </p>
            <div className="signup-ask-compare">
              {asMember.coupon > 0 ? (
                <>
                  <div><span>비회원 주문</span><b>{total.toLocaleString()}원</b></div>
                  <div className="is-member"><span>회원가입 후 주문</span><b>{asMember.total.toLocaleString()}원</b></div>
                </>
              ) : (
                <div className="is-short">
                  지금 장바구니 {subtotal.toLocaleString()}원 — {asMember.couponShortBy.toLocaleString()}원 더 담고 회원으로 주문하면{' '}
                  {FIRST_ORDER_COUPON.amount.toLocaleString()}원 할인돼요
                </div>
              )}
            </div>
            <Link to="/signup?next=/cart" className="btn btn-lg btn-primary signup-ask-go">
              회원가입하고 {FIRST_ORDER_COUPON.amount.toLocaleString()}원 할인받기
            </Link>
            <button type="button" className="signup-ask-skip" onClick={startGuest}>
              괜찮아요, 비회원으로 주문할게요
            </button>
            <p className="signup-ask-login">
              이미 회원이세요? <Link to="/login?next=/cart">로그인</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
