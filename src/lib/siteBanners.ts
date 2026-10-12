import { supabase } from './supabaseClient'

// 메인 배너 — 관리자 화면에서 사진·글씨를 바꾼다.
// 손님 화면은 이걸 읽어 보여주고, 서버가 안 되면 아무것도 안 보여주는 대신
// HeroBanner 가 예전 기본 배너를 그대로 쓴다(화면이 비지 않게).

const TABLE = 'site_banners'

export interface SiteBanner {
  id: string
  sort: number
  active: boolean
  eyebrow: string
  title: string
  descr: string
  cta: string
  link: string
  image: string      // 배경 사진 주소 (비우면 gradient)
  gradient: string
}

const fromDb = (r: Record<string, unknown>): SiteBanner => ({
  id: String(r.id),
  sort: Number(r.sort ?? 0),
  active: r.active !== false,
  eyebrow: String(r.eyebrow ?? ''),
  title: String(r.title ?? ''),
  descr: String(r.descr ?? ''),
  cta: String(r.cta ?? ''),
  link: String(r.link ?? ''),
  image: String(r.image ?? ''),
  gradient: String(r.gradient ?? ''),
})

/** 손님 화면용 — 켜둔 배너만, 차례대로 */
export async function fetchBanners(): Promise<SiteBanner[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('sort')
  if (error || !data) return []
  return data.map(fromDb).filter((b) => b.active)
}

/** 관리자용 — 꺼둔 것까지 전부 */
export async function fetchAllBanners(): Promise<SiteBanner[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('sort')
  if (error) throw error
  return (data ?? []).map(fromDb)
}

export async function saveBanner(b: SiteBanner): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert({
    id: b.id, sort: b.sort, active: b.active,
    eyebrow: b.eyebrow, title: b.title, descr: b.descr,
    cta: b.cta, link: b.link, image: b.image, gradient: b.gradient,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export function emptyBanner(sort: number): SiteBanner {
  return {
    id: `b${Date.now().toString(36)}`,
    sort, active: true,
    eyebrow: '', title: '', descr: '', cta: '', link: '/best',
    image: '', gradient: 'linear-gradient(120deg,#4A154B,#1264A3 75%)',
  }
}
