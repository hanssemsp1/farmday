import { supabase } from './supabaseClient'
import { ProductOption } from '../types/product'

interface DbOption {
  id: string
  name: string
  price: number
  sold_out: boolean
  sort_order: number
}

function fromDb(row: DbOption): ProductOption {
  return { id: row.id, name: row.name, price: row.price, soldOut: row.sold_out, sortOrder: row.sort_order }
}

export async function fetchProductOptions(productId: string): Promise<{ data: ProductOption[]; error: string | null }> {
  const { data, error } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
  return { data: ((data as DbOption[]) ?? []).map(fromDb), error: error?.message ?? null }
}

export async function replaceProductOptions(
  productId: string,
  options: { name: string; price: number; soldOut: boolean }[],
) {
  const { error: deleteError } = await supabase.from('product_options').delete().eq('product_id', productId)
  if (deleteError) return { error: deleteError.message }
  if (options.length === 0) return { error: null }

  const { error: insertError } = await supabase.from('product_options').insert(
    options.map((o, i) => ({
      product_id: productId,
      name: o.name,
      price: o.price,
      sold_out: o.soldOut,
      sort_order: i,
    })),
  )
  return { error: insertError?.message ?? null }
}
