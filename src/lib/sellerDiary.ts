import { supabase } from './supabaseClient'

// 셀러 다이어리 — 하루 한 장.
// 나중에 전자책 재료로 쓴다. 특히 struggle(막힌 것)·hours(걸린 시간)·spent(쓴 돈)는
// 초보가 제일 궁금해하는 것이라 빠짐없이 채워두면 값지다.

const TABLE = 'seller_diary'

export interface DiaryDay {
  day: string            // '2026-08-13'
  revenue: number | null
  orders: number | null
  adCost: number | null
  spent: number | null
  hours: number | null
  uploaded: string
  sold: string
  thoughts: string
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
  uploaded: string | null
  sold: string | null
  thoughts: string | null
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
  uploaded: r.uploaded ?? '', sold: r.sold ?? '',
  thoughts: r.thoughts ?? '', struggle: r.struggle ?? '', learned: r.learned ?? '',
  feedback: r.feedback ?? '', tomorrow: r.tomorrow ?? '', etc: r.etc ?? '',
  mood: r.mood ?? '', starred: r.starred,
  updatedAt: r.updated_at ?? undefined,
})

const toDb = (d: DiaryDay) => ({
  day: d.day,
  revenue: d.revenue, orders: d.orders, ad_cost: d.adCost, spent: d.spent, hours: d.hours,
  uploaded: d.uploaded, sold: d.sold,
  thoughts: d.thoughts, struggle: d.struggle, learned: d.learned,
  feedback: d.feedback, tomorrow: d.tomorrow, etc: d.etc,
  mood: d.mood, starred: d.starred,
})

export function emptyDay(day: string): DiaryDay {
  return {
    day, revenue: null, orders: null, adCost: null, spent: null, hours: null,
    uploaded: '', sold: '', thoughts: '', struggle: '', learned: '',
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
