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
      setProducts(data)
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

export function useProducts() {
  const ctx = useContext(ProductsContext)
  if (!ctx) throw new Error('useProducts must be used within ProductsProvider')
  return ctx
}
