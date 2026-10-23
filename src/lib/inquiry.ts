import { supabase } from './supabaseClient'
import type { GuestCred } from './guestOrder'

// 1:1 문의 — 쓰기 · 내 문의 보기는 서버(inquiry 함수)만. 관리자는 표를 바로 읽고 답한다(RLS 관리자 정책).

export const INQUIRY_KINDS = ['교환·반품', '배송', '상품', '기타'] as const
export type InquiryKind = typeof INQUIRY_KINDS[number]

export interface MyInquiry {
  id: string
  order_no: string | null
  kind: InquiryKind
  product_name: string | null
  body: string
  photos: number
  status: '새 문의' | '답변함' | '끝'
  answer: string | null
  answered_at: string | null
  created_at: string
}

export interface AdminInquiry extends Omit<MyInquiry, 'photos'> {
  user_id: string | null
  order_id: string | null
  buyer_name: string
  phone: string
  photos: string[]
}

async function call<T>(body: Record<string, unknown>): Promise<T & { ok: boolean; code?: string; message?: string }> {
  // 문의 글 · 사진은 서울에서만 처리(국외 이전 없음) — 실행 지역을 서울로 고정한다
  const { data, error } = await supabase.functions.invoke('inquiry', { body, headers: { 'x-region': 'ap-northeast-2' } })
  if (data && typeof data === 'object') return data
  const ctx = (error as { context?: Response } | null)?.context
  if (ctx && typeof ctx.json === 'function') {
    try { return await ctx.json() } catch { /* 본문 없음 */ }
  }
  return { ok: false, code: 'NETWORK', message: error?.message ?? '서버에 연결하지 못했어요.' } as unknown as T & { ok: boolean }
}

/** 사진 파일 → base64 (5MB 넘으면 거절) */
export async function photoPayload(files: File[]) {
  const out: { type: string; data: string }[] = []
  for (const f of files.slice(0, 3)) {
    if (f.size > 5 * 1024 * 1024) throw new Error(`「${f.name}」이 5MB보다 커요. 휴대폰에서 크기를 줄여 다시 골라 주세요.`)
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res(String(r.result).split(',')[1] ?? '')
      r.onerror = () => rej(new Error('사진을 읽지 못했어요.'))
      r.readAsDataURL(f)
    })
    out.push({ type: f.type || 'image/jpeg', data })
  }
  return out
}

export function sendInquiry(input: {
  guest?: GuestCred; orderNo?: string; kind: InquiryKind; buyerName: string; phone: string; productName: string; body: string; photos: { type: string; data: string }[]
}) {
  return call<{ id?: string }>({ action: 'create', ...input })
}

export function myInquiries(guest?: GuestCred) {
  return call<{ inquiries?: MyInquiry[] }>({ action: 'mine', ...(guest ? { guest } : {}) })
}

// ── 관리자 ──
export async function adminInquiries() {
  const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(300)
  return { data: (data ?? []) as AdminInquiry[], error }
}
export async function adminAnswer(id: string, answer: string, status: AdminInquiry['status']) {
  return supabase.from('inquiries').update({ answer: answer.trim() || null, status, answered_at: answer.trim() ? new Date().toISOString() : null }).eq('id', id)
}
export async function photoUrl(path: string) {
  const { data } = await supabase.storage.from('inquiry-photos').createSignedUrl(path, 600)
  return data?.signedUrl ?? ''
}
