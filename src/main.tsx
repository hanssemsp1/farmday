import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FavoritesProvider } from './context/FavoritesContext'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { ProductsProvider } from './context/ProductsContext'
import { SiteSettingsProvider } from './context/SiteSettingsContext'
import './styles/tokens.css'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProductsProvider>
          <SiteSettingsProvider>
            <FavoritesProvider>
              <CartProvider>
                <App />
              </CartProvider>
            </FavoritesProvider>
          </SiteSettingsProvider>
        </ProductsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
