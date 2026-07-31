import { createContext, ReactNode, useContext, useState } from 'react'

export interface CartLine {
  productId: string
  quantity: number
  selected: boolean
  optionId?: string
  optionName?: string
  optionPrice?: number
}

export interface CartOption {
  id: string
  name: string
  price: number
}

interface CartContextValue {
  lines: CartLine[]
  itemCount: number
  addToCart: (productId: string, quantity?: number, option?: CartOption) => void
  toggleAll: (checked: boolean) => void
  toggleLine: (productId: string, optionId: string | undefined, checked: boolean) => void
  updateQuantity: (productId: string, optionId: string | undefined, delta: number) => void
  removeLine: (productId: string, optionId: string | undefined) => void
  removeSelected: () => void
  removeLines: (keys: { productId: string; optionId?: string }[]) => void
}

const CART_STORAGE_KEY = 'farmday_cart'

const DEFAULT_LINES: CartLine[] = []

function lineKey(productId: string, optionId?: string) {
  return `${productId}::${optionId ?? ''}`
}

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

  function addToCart(productId: string, quantity = 1, option?: CartOption) {
    setLines((prev) => {
      const key = lineKey(productId, option?.id)
      const existing = prev.find((l) => lineKey(l.productId, l.optionId) === key)
      if (existing) {
        return prev.map((l) =>
          lineKey(l.productId, l.optionId) === key ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l,
        )
      }
      return [
        ...prev,
        {
          productId,
          quantity,
          selected: true,
          optionId: option?.id,
          optionName: option?.name,
          optionPrice: option?.price,
        },
      ]
    })
  }

  function toggleAll(checked: boolean) {
    setLines((prev) => prev.map((l) => ({ ...l, selected: checked })))
  }

  function toggleLine(productId: string, optionId: string | undefined, checked: boolean) {
    const key = lineKey(productId, optionId)
    setLines((prev) => prev.map((l) => (lineKey(l.productId, l.optionId) === key ? { ...l, selected: checked } : l)))
  }

  function updateQuantity(productId: string, optionId: string | undefined, delta: number) {
    const key = lineKey(productId, optionId)
    setLines((prev) =>
      prev.map((l) =>
        lineKey(l.productId, l.optionId) === key
          ? { ...l, quantity: Math.min(99, Math.max(1, l.quantity + delta)) }
          : l,
      ),
    )
  }

  function removeLine(productId: string, optionId: string | undefined) {
    const key = lineKey(productId, optionId)
    setLines((prev) => prev.filter((l) => lineKey(l.productId, l.optionId) !== key))
  }

  function removeSelected() {
    setLines((prev) => prev.filter((l) => !l.selected))
  }

  function removeLines(keys: { productId: string; optionId?: string }[]) {
    const removeSet = new Set(keys.map((k) => lineKey(k.productId, k.optionId)))
    setLines((prev) => prev.filter((l) => !removeSet.has(lineKey(l.productId, l.optionId))))
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
