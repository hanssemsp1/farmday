import { supabase } from './supabaseClient'
import type { DbOrder, OrderItem, ShippingInfo } from '../types/order'
import type { CancelResult } from './orderCancel'

// 비회원 주문 — 브라우저는 DB에 직접 닿지 않고 서버(guest-order·toss-confirm·order-cancel)만 부른다.

export interface GuestCred { orderNo: string; phone: string; password: string }
export type GuestOrder = DbOrder & { order_no: string }

async function call<T>(fn: string, body: Record<string, unknown>): Promise<T & { ok: boolean; code?: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (data && typeof data === 'object') return data
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try { return await ctx.json() } catch { /* 본문 없음 */ }
  }
  return { ok: false, code: 'NETWORK', message: error?.message ?? '서버에 연결하지 못했어요.' } as unknown as T & { ok: boolean }
}

export function createGuestOrder(items: OrderItem[], ship: ShippingInfo, email: string, password: string, privacyConsent: boolean) {
  return call<{ orderId?: string; orderNo?: string; token?: string }>('guest-order', { action: 'create', items, ship, email, password, privacyConsent })
}

export function lookupGuestOrder(cred: GuestCred) {
  return call<{ order?: GuestOrder }>('guest-order', { action: 'lookup', ...cred })
}

export function cancelGuestOrder(cred: GuestCred, reason: string) {
  return call<CancelResult>('order-cancel', { action: 'cancel', reason, guest: cred })
}

// 결제창을 다녀오는 동안 필요한 것 — 같은 탭의 sessionStorage 에만 둔다(창을 닫으면 사라짐)
const TOKEN = (orderId: string) => 'farmday_guest_token_' + orderId
const ITEMS = (orderId: string) => 'farmday_guest_items_' + orderId
const CRED = 'farmday_guest_cred'

// 비밀번호는 저장하지 않는다 — 조회 화면에서 다시 적게 하고 주문번호·휴대폰만 미리 채운다
export type GuestHint = Pick<GuestCred, 'orderNo' | 'phone'>

export function rememberGuestCheckout(orderId: string, token: string, items: OrderItem[], hint: GuestHint) {
  try {
    sessionStorage.setItem(TOKEN(orderId), token)
    sessionStorage.setItem(ITEMS(orderId), JSON.stringify(items))
    sessionStorage.setItem(CRED, JSON.stringify(hint))
  } catch { /* 저장소를 못 쓰면 결제 뒤 「비회원 주문 조회」로 */ }
}
export function guestTokenOf(orderId: string) {
  try { return sessionStorage.getItem(TOKEN(orderId)) ?? '' } catch { return '' }
}
export function guestItemsOf(orderId: string): OrderItem[] {
  try { return JSON.parse(sessionStorage.getItem(ITEMS(orderId)) ?? '[]') } catch { return [] }
}
export function savedGuestHint(): GuestHint | null {
  try { return JSON.parse(sessionStorage.getItem(CRED) ?? 'null') } catch { return null }
}
export function saveGuestHint(hint: GuestHint | null) {
  try {
    if (hint) sessionStorage.setItem(CRED, JSON.stringify({ orderNo: hint.orderNo, phone: hint.phone }))
    else sessionStorage.removeItem(CRED)
  } catch { /* 무시 */ }
}
export function forgetGuestToken(orderId: string) {
  try { sessionStorage.removeItem(TOKEN(orderId)) } catch { /* 무시 */ }
}
