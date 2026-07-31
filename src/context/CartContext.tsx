import { createContext, ReactNode, useContext, useState } from 'react'

export interface CartLine {
  productId: string
  quantity: number
  selected: boolean
}

interface CartContextValue {
  lines: CartLine[]
  itemCount: number
  addToCart: (productId: string, quantity?: number) => void
  toggleAll: (checked: boolean) => void
  toggleLine: (productId: string, checked: boolean) => void
  updateQuantity: (productId: string, delta: number) => void
  removeLine: (productId: string) => void
  removeSelected: () => void
  removeLines: (productIds: string[]) => void
}

const CART_STORAGE_KEY = 'farmday_cart'

const DEFAULT_LINES: CartLine[] = []

function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_LINES
  } catch {
    return DEFAULT_LINES
  }
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLinesState] = useState<CartLine[]>(readStoredCart)

  function setLines(updater: (prev: CartLine[]) => CartLine[]) {
    setLinesState((prev) => {
      const next = updater(prev)
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  function addToCart(productId: string, quantity = 1) {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId)
      if (existing) {
        return prev.map((l) =>
          l.productId === productId ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
        )
      }
      return [...prev, { productId, quantity, selected: true }]
    })
  }

  function toggleAll(checked: boolean) {
    setLines((prev) => prev.map((l) => ({ ...l, selected: checked })))
  }

  function toggleLine(productId: string, checked: boolean) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, selected: checked } : l)))
  }

  function updateQuantity(productId: string, delta: number) {
    setLines((prev) =>
      prev.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.min(99, Math.max(1, l.quantity + delta)) } : l,
      ),
    )
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId))
  }

  function removeSelected() {
    setLines((prev) => prev.filter((l) => !l.selected))
  }

  function removeLines(productIds: string[]) {
    setLines((prev) => prev.filter((l) => !productIds.includes(l.productId)))
  }

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        lines,
        itemCount,
        addToCart,
        toggleAll,
        toggleLine,
        updateQuantity,
        removeLine,
        removeSelected,
        removeLines,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
