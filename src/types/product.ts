export interface ProductOption {
  id: string
  name: string
  price: number
  soldOut: boolean
  sortOrder: number
}

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
  /** 상품 화면 맨 위에서 넘겨 보는 추가 썸네일(대표 썸네일 다음 장들) */
  thumbnails?: string[]
  badges?: ('best' | 'new' | 'sale')[]
  soldOut?: boolean
  options?: ProductOption[]
}
