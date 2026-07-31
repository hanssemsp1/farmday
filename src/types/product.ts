export interface Product {
  id: string
  name: string
  brand: string
  category: string
  price: number
  originalPrice?: number
  discountRate?: number
  rating: number
  reviewCount: number
  thumbnail: string
  description?: string
  detailImages?: string[]
  badges?: ('best' | 'new' | 'sale')[]
  soldOut?: boolean
}
