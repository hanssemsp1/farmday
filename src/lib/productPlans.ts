import { supabase } from './supabaseClient'
import { ProductPlan } from '../types/productPlan'

// 상품 기획 저장소
// ⚠️ 이 표에는 업체 공급가와 마진이 들어 있다. 데이터베이스 쪽에 관리자 잠금(RLS)이
//    걸려 있어야 안전하다 — supabase/product_plans.sql 참고.

const TABLE = 'product_plans'

interface DbPlan {
  id: string
  category: string | null
  season: string[] | null
  status: string | null
  vendor: ProductPlan['vendor'] | null
  coupang: ProductPlan['coupang'] | null
  options: ProductPlan['options'] | null
  competitors: ProductPlan['competitors'] | null
  content: ProductPlan['content'] | null
  reviews: ProductPlan['reviews'] | null
  assets: ProductPlan['assets'] | null
  updated_at: string | null
}

function fromDb(r: DbPlan): ProductPlan {
  return {
    id: r.id,
    category: r.category ?? '',
    season: r.season ?? [],
    status: r.status ?? '기획',
    vendor: r.vendor ?? { name: '', note: '' },
    coupang: r.coupang ?? { name: '', category: '', searchFilter: '', tags: [], registerId: '', optionRows: [] },
    options: r.options ?? [],
    competitors: r.competitors ?? { weights: [], rows: [] },
    content: r.content ?? { thumbs: {}, details: {}, badge: '', notes: [] },
    reviews: r.reviews ?? [],
    assets: r.assets ?? { folder: '', preview: '' },
    updatedAt: r.updated_at ?? undefined,
  }
}

function toDb(p: ProductPlan) {
  return {
    id: p.id,
    category: p.category,
    season: p.season,
    status: p.status,
    vendor: p.vendor,
    coupang: p.coupang,
    options: p.options,
    competitors: p.competitors,
    content: p.content,
    reviews: p.reviews,
    assets: p.assets,
  }
}

export async function fetchPlans(): Promise<ProductPlan[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('id')
  if (error) throw error
  return (data as DbPlan[]).map(fromDb)
}

export async function fetchPlan(id: string): Promise<ProductPlan | null> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromDb(data as DbPlan) : null
}

// 같은 id가 있으면 덮어쓰고 없으면 새로 만든다
export async function savePlan(plan: ProductPlan): Promise<ProductPlan> {
  const { data, error } = await supabase.from(TABLE).upsert(toDb(plan)).select().single()
  if (error) throw error
  return fromDb(data as DbPlan)
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
