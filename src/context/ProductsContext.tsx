import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Product } from '../types/product'
import { fetchProducts } from '../lib/products'

interface ProductsContextValue {
  products: Product[]
  loading: boolean
  refetch: () => void
}

const ProductsContext = createContext<ProductsContextValue | null>(null)

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetchProducts().then(({ data }) => {
      // 제철이 지나 품절 처리한 상품은 판매 중인 상품 뒤로 보낸다 (순서는 그대로 유지)
      setProducts(soldOutLast(data))
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <ProductsContext.Provider value={{ products, loading, refetch: load }}>{children}</ProductsContext.Provider>
  )
}

export function soldOutLast(list: Product[]): Product[] {
  return [...list.filter((p) => !p.soldOut), ...list.filter((p) => p.soldOut)]
}

export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider')
  return ctx
}
