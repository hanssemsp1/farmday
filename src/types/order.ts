export interface OrderItem {
  productId: string
  name: string
  brand: string
  price: number
  quantity: number
  thumbnail: string
  optionId?: string
  optionName?: string
}

export interface DbOrder {
  id: string
  user_id: string | null // 비회원 주문은 비어 있음 (supabase/orders_guest.sql)
  guest?: boolean
  items: OrderItem[]
  total_amount: number
  status: string
  created_at: string
  // 결제 승인 뒤 서버가 채우는 칸 (supabase/orders_coupon.sql)
  subtotal?: number | null
  shipping_fee?: number | null
  coupon_amount?: number | null
  paid_at?: string | null
  // 배송지·발주 (supabase/orders_shipping.sql)
  buyer_name?: string | null
  buyer_phone?: string | null
  recipient_name?: string | null
  recipient_phone?: string | null
  zipcode?: string | null
  address1?: string | null
  address2?: string | null
  delivery_memo?: string | null
  supply_lines?: number[] | null
  supply_status?: string | null
  supply_ordered_at?: string | null
  // 취소 (supabase/orders_cancel.sql)
  cancel_status?: '요청' | '완료' | '거절' | null
  cancel_reason?: string | null
  cancel_requested_at?: string | null
  canceled_at?: string | null
  cancel_note?: string | null
  // 송장·배송 (supabase/orders_tracking.sql)
  shipments?: { lines: number[]; courier: string; number: string; at: string }[] | null
  delivery_status?: '배송중' | '배송완료' | null
  shipped_at?: string | null
  delivered_at?: string | null
}

/** 결제 전에 받는 배송지 */
export interface ShippingInfo {
  buyerName: string
  buyerPhone: string
  recipientName: string
  recipientPhone: string
  zipcode: string
  address1: string
  address2: string
  memo: string
  consent: boolean
}
