import { supabase } from './supabaseClient'

// 셀러 다이어리 — 하루 한 장.
// 나중에 전자책 재료로 쓴다. 특히 struggle(막힌 것)·hours(걸린 시간)·spent(쓴 돈)는
// 초보가 제일 궁금해하는 것이라 빠짐없이 채워두면 값지다.

const TABLE = 'seller_diary'

// 하루에 여러 상품을 올리고, 여러 곳에서 팔린다.
// 그래서 한 줄 글이 아니라 목록으로 담는다.
export interface DiaryItem {
  name: string        // 상품 이름
  channel: string     // 어디에 — 쿠팡 / 네이버 / 당근 / 테무
  option?: string     // 옵션 (예: 3kg) — 판매된 상품
  qty?: number | null // 판매된 상품일 때 몇 개
  amount?: number | null // 구매금액(결제액) — 판매된 상품
  orderNo?: string    // 엑셀에서 들어온 줄이면 주문번호 — 같은 파일을 다시 올려도 두 번 안 들어가게
  memo?: string
}

// 지금 팔거나 팔 곳 넷. 고르기만 하면 되게 목록으로 둔다
export const CHANNELS = ['쿠팡', '네이버', '당근', '테무'] as const

export interface DiaryDay {
  day: string            // '2026-08-13'
  revenue: number | null
  orders: number | null
  adCost: number | null
  spent: number | null
  hours: number | null
  registered: DiaryItem[]  // 등록상품 (예전 이름: 올린 상품)
  soldItems: DiaryItem[]   // 판매된 상품 (예전 이름: 팔린 상품)
  uploaded: string         // 예전에 한 줄로 적던 것 — 옛 기록을 위해 남겨둔다
  sold: string
  thoughts: string
  did: string              // 오늘 한 일 — 썸네일 만들기, 상세페이지, 상품 등록 같은 것
  struggle: string
  learned: string
  feedback: string
  tomorrow: string
  etc: string
  mood: string
  starred: boolean
  updatedAt?: string
}

interface DbDay {
  day: string
  revenue: number | null
  orders: number | null
  ad_cost: number | null
  spent: number | null
  hours: number | null
  registered: unknown[] | null
  sold_items: unknown[] | null
  uploaded: string | null
  sold: string | null
  thoughts: string | null
  did: string | null
  struggle: string | null
  learned: string | null
  feedback: string | null
  tomorrow: string | null
  etc: string | null
  mood: string | null
  starred: boolean
  updated_at: string | null
}

const fromDb = (r: DbDay): DiaryDay => ({
  day: r.day,
  revenue: r.revenue, orders: r.orders, adCost: r.ad_cost, spent: r.spent, hours: r.hours,
  registered: Array.isArray(r.registered) ? (r.registered as DiaryItem[]) : [],
  soldItems: Array.isArray(r.sold_items) ? (r.sold_items as DiaryItem[]) : [],
  uploaded: r.uploaded ?? '', sold: r.sold ?? '',
  thoughts: r.thoughts ?? '', did: r.did ?? '', struggle: r.struggle ?? '', learned: r.learned ?? '',
  feedback: r.feedback ?? '', tomorrow: r.tomorrow ?? '', etc: r.etc ?? '',
  mood: r.mood ?? '', starred: r.starred,
  updatedAt: r.updated_at ?? undefined,
})

const toDb = (d: DiaryDay) => ({
  day: d.day,
  revenue: d.revenue, orders: d.orders, ad_cost: d.adCost, spent: d.spent, hours: d.hours,
  registered: d.registered ?? [], sold_items: d.soldItems ?? [],
  uploaded: d.uploaded, sold: d.sold,
  thoughts: d.thoughts, struggle: d.struggle, learned: d.learned,
  // 「오늘 한 일」 칸은 나중에 생겼다. 서버에 칸을 아직 안 만들었어도
  // 비어 있는 동안은 저장이 막히지 않게, 적은 게 있을 때만 보낸다.
  ...(d.did ? { did: d.did } : {}),
  feedback: d.feedback, tomorrow: d.tomorrow, etc: d.etc,
  mood: d.mood, starred: d.starred,
})

export function emptyDay(day: string): DiaryDay {
  return {
    day, revenue: null, orders: null, adCost: null, spent: null, hours: null,
    registered: [], soldItems: [],
    uploaded: '', sold: '', thoughts: '', did: '', struggle: '', learned: '',
    feedback: '', tomorrow: '', etc: '', mood: '', starred: false,
  }
}

export async function fetchDiary(): Promise<DiaryDay[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('day', { ascending: false })
  if (error) throw error
  return (data as DbDay[]).map(fromDb)
}

export async function saveDay(d: DiaryDay): Promise<DiaryDay> {
  const { data, error } = await supabase.from(TABLE).upsert(toDb(d)).select().single()
  if (error) throw error
  return fromDb(data as DbDay)
}

export async function deleteDay(day: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('day', day)
  if (error) throw error
}

// 오늘 날짜 (한국 기준)
export function todayKey(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000)
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

export function labelOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${m}월 ${d}일 (${'일월화수목금토'[dt.getDay()]})`
}
