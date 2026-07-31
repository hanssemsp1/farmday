export interface OrderItem {
  productId: string
  name: string
  brand: string
  price: number
  quantity: number
  thumbnail: string
  optionName?: string
}

export interface DbOrder {
  id: string
  user_id: string
  items: OrderItem[]
  total_amount: number
  status: string
  created_at: string
}
