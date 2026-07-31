import { supabase } from './supabaseClient'
import { DbOrder, OrderItem } from '../types/order'

export async function createOrder(items: OrderItem[], totalAmount: number) {
  const { data, error } = await supabase
    .from('orders')
    .insert({ items, total_amount: totalAmount })
    .select()
    .single()
  return { data: data as DbOrder | null, error: error?.message ?? null }
}

export async function fetchOrders(): Promise<{ data: DbOrder[]; error: string | null }> {
  const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
  return { data: (data as DbOrder[]) ?? [], error: error?.message ?? null }
}

export async function fetchOrderById(id: string): Promise<{ data: DbOrder | null; error: string | null }> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
  return { data: data as DbOrder | null, error: error?.message ?? null }
}

export async function updateOrderStatus(id: string, status: string) {
  const { error } = await supabase.from('orders').update({ status }).eq('id', id)
  return { error: error?.message ?? null }
}
