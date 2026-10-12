// 상품기획을 팜데이 사이트(/admin/planning)에 바로 올린다.
//
// 실행: node scripts/push-plan.mjs plans/진미채.json
//       node scripts/push-plan.mjs plans/진미채.json --dry   (올리지 않고 확인만)
//
// .env.local 의 ADMIN_EMAIL / ADMIN_PASSWORD 로 로그인한다.
// (watch-upload.js 가 상품 사진을 올릴 때 쓰던 그 계정 — 자동화용으로 만들어둔 것)
// 비밀번호는 화면에 찍지 않는다.

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const file = process.argv[2]
const dry = process.argv.includes('--dry')
if (!file) {
  console.error('사용법: node scripts/push-plan.mjs plans/진미채.json')
  process.exit(1)
}

const plan = JSON.parse(await fs.readFile(file, 'utf8'))

// ── 올리기 전에 사람이 볼 수 있게 요약 ─────────────────
const 채운칸 = [
  ['썸네일 문구', !!plan.content?.thumbs?.main?.hook],
  ['상품명·태그', !!(plan.coupang?.name && plan.coupang?.tags?.length)],
  ['경쟁사', (plan.competitors?.rows || []).some((r) => r.title)],
  ['단가·판매가', (plan.options || []).some((o) => o.cost && o.price)],
  ['상세 문구', Object.values(plan.content?.details || {}).some((v) => (v || '').trim())],
  ['사진 폴더', !!plan.assets?.folder],
]
console.log(`\n[${plan.id}] ${plan.category}`)
채운칸.forEach(([name, ok]) => console.log(`  ${ok ? '✓' : '·'} ${name}`))
console.log(`  옵션 ${(plan.options || []).length}개 · 태그 ${(plan.coupang?.tags || []).length}개`)

// 마진 검산 — 사이트와 같은 식으로 (실판매가 × (1−수수료) − 공급가 − 택배비)
// 쿠폰을 쓰는 상품은 realPrice(쿠폰 뺀 값)로 계산해야 한다. 사이트 화면도 같은 기준(productPlan.ts)
for (const o of plan.options || []) {
  const sell = o.realPrice != null ? o.realPrice : o.price
  if (o.cost == null || !sell) continue
  const net = Math.round(sell * (1 - (o.fee ?? 0.12)) - o.cost - (o.shipping || 0))
  const rate = Math.round((net / sell) * 1000) / 10
  const coupon = o.realPrice != null && o.price && o.realPrice !== o.price ? ` (정가 ${o.price})` : ''
  const flag = net <= 0 ? '  ❌ 적자' : net < sell * 0.1 ? '  ⚠️ 얇음' : ''
  console.log(`    ${o.label.padEnd(16)} ${String(sell).padStart(7)}원 → ${String(net).padStart(6)}원 ${String(rate).padStart(5)}%${coupon}${flag}`)
}

if (dry) { console.log('\n--dry 라서 올리지 않았습니다.'); process.exit(0) }

// ── 로그인 후 저장 ────────────────────────────────────
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env
if (!url || !key || !email || !pw) {
  console.error('\n.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / ADMIN_EMAIL / ADMIN_PASSWORD 가 있어야 합니다.')
  process.exit(1)
}

const supabase = createClient(url, key)
const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw })
if (authErr) { console.error('\n로그인 실패:', authErr.message); process.exit(1) }

const row = {
  id: plan.id,
  category: plan.category,
  season: plan.season ?? [],
  status: plan.status ?? '기획',
  vendor: plan.vendor,
  coupang: plan.coupang,
  options: plan.options,
  competitors: plan.competitors,
  content: plan.content,
  reviews: plan.reviews ?? [],
  assets: plan.assets,
}
const { error } = await supabase.from('product_plans').upsert(row)
if (error) { console.error('\n저장 실패:', error.message); process.exit(1) }

console.log(`\n올렸습니다 → 사이트 /admin/planning 에서 「${plan.id}」 불러오기`)
