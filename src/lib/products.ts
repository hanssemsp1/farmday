import { supabase } from './supabaseClient'
import { Product } from '../types/product'

interface DbProduct {
  id: string
  name: string
  brand: string
  category: string
  price: number
  original_price: number | null
  discount_rate: number | null
  rating: number
  review_count: number
  thumbnail: string
  description: string | null
  badges: Product['badges']
  sold_out: boolean
}

function fromDb(row: DbProduct): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: row.category,
    price: row.price,
    originalPrice: row.original_price ?? undefined,
    discountRate: row.discount_rate ?? undefined,
    rating: row.rating,
    reviewCount: row.review_count,
    thumbnail: row.thumbnail,
    description: row.description ?? undefined,
    badges: row.badges ?? [],
    soldOut: row.sold_out,
  }
}

function toDb(input: Omit<Product, 'id'>) {
  return {
    name: input.name,
    brand: input.brand,
    category: input.category,
    price: input.price,
    original_price: input.originalPrice ?? null,
    discount_rate: input.discountRate ?? null,
    rating: input.rating,
    review_count: input.reviewCount,
    thumbnail: input.thumbnail,
    description: input.description ?? null,
    badges: input.badges ?? [],
    sold_out: input.soldOut ?? false,
  }
}

export async function fetchProducts(): Promise<{ data: Product[]; error: string | null }> {
  const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
  return { data: ((data as DbProduct[]) ?? []).map(fromDb), error: error?.message ?? null }
}

export async function fetchProductById(id: string): Promise<{ data: Product | null; error: string | null }> {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).single()
  return { data: data ? fromDb(data as DbProduct) : null, error: error?.message ?? null }
}

export async function createProduct(input: Omit<Product, 'id'>) {
  const { data, error } = await supabase.from('products').insert(toDb(input)).select().single()
  return { data: data ? fromDb(data as DbProduct) : null, error: error?.message ?? null }
}

export async function updateProduct(id: string, input: Omit<Product, 'id'>) {
  const { data, error } = await supabase.from('products').update(toDb(input)).eq('id', id).select().single()
  return { data: data ? fromDb(data as DbProduct) : null, error: error?.message ?? null }
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id)
  return { error: error?.message ?? null }
}
