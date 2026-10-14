import { supabase } from './supabaseClient'
import { DbOrder, OrderItem, ShippingInfo } from '../types/order'

/** 01012345678 → 010-1234-5678 (공급처 주문서에 같은 모양으로 들어가게) */
function dashPhone(v: string) {
  const d = v.replace(/\D/g, '')
  if (/^02\d{7,8}$/.test(d)) return d.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3')
  if (/^0\d{9,10}$/.test(d)) return d.replace(/^(0\d{2})(\d{3,4})(\d{4})$/, '$1-$2-$3')
  return v.trim()
}

export async function createOrder(items: OrderItem[], totalAmount: number, ship: ShippingInfo, userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      user_id: userId, // 지킴이(orders_guest.sql)가 「로그인한 본인 것」인지 본다
      items,
      total_amount: totalAmount,
      buyer_name: ship.buyerName.trim(),
      buyer_phone: dashPhone(ship.buyerPhone),
      recipient_name: ship.recipientName.trim(),
      recipient_phone: dashPhone(ship.recipientPhone),
      zipcode: ship.zipcode.trim(),
      address1: ship.address1.trim(),
      address2: ship.address2.trim(),
      delivery_memo: ship.memo.trim(),
      supply_consent: ship.consent,
    })
    .select()
    .single()
  return { data: data as DbOrder | null, error: error?.message ?? null }
}

/** 내 주문만 — 관리자 계정은 모든 주문을 읽을 수 있으므로(orders_admin_read) 반드시 내 것으로 거른다 */
export async function fetchOrders(userId: string): Promise<{ data: DbOrder[]; error: string | null }> {
  const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  return { data: (data as DbOrder[]) ?? [], error: error?.message ?? null }
}

export async function fetchOrderById(id: string): Promise<{ data: DbOrder | null; error: string | null }> {
  const { data, error } = await supabase.from('orders').select('*').eq('id', id).single()
  return { data: data as DbOrder | null, error: error?.message ?? null }
}
