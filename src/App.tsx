import { Route, Routes } from 'react-router-dom'
import Header from './components/layout/Header'
import CategoryNav from './components/layout/CategoryNav'
import Footer from './components/layout/Footer'
import HomePage from './pages/HomePage'
import BestProductsPage from './pages/BestProductsPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import CartPage from './pages/CartPage'
import MyPage from './pages/MyPage'
import BoardPage from './pages/BoardPage'
import BoardDetailPage from './pages/BoardDetailPage'
import BoardWritePage from './pages/BoardWritePage'
import NoticePage from './pages/NoticePage'
import WishlistPage from './pages/WishlistPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import CouponPage from './pages/CouponPage'
import PointsPage from './pages/PointsPage'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage'
import CheckoutFailPage from './pages/CheckoutFailPage'
import NotificationsPage from './pages/NotificationsPage'
import AdminProductsPage from './pages/AdminProductsPage'
import AdminSettingsPage from './pages/AdminSettingsPage'
import AdminPlanningPage from './pages/AdminPlanningPage'
import ProductDetailPage from './pages/ProductDetailPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import ShippingPolicyPage from './pages/ShippingPolicyPage'

export default function App() {
  return (
    <>
      <Header />
      <CategoryNav />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/best" element={<BestProductsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/mypage/orders" element={<OrderHistoryPage />} />
          <Route path="/mypage/coupons" element={<CouponPage />} />
          <Route path="/mypage/points" element={<PointsPage />} />
          <Route path="/mypage/notifications" element={<NotificationsPage />} />
          <Route path="/board" element={<BoardPage />} />
          <Route path="/board/write" element={<BoardWritePage />} />
          <Route path="/board/:id" element={<BoardDetailPage />} />
          <Route path="/notice" element={<NoticePage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="/checkout/fail" element={<CheckoutFailPage />} />
          <Route path="/admin/products" element={<AdminProductsPage />} />
          <Route path="/admin/planning" element={<AdminPlanningPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/shipping" element={<ShippingPolicyPage />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
