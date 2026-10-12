// 상품기획(product_plans)의 옵션 가격을 사이트 상품(products)에 반영한다.
//
//   node scripts/sync-price.mjs           무엇이 어떻게 바뀔지 보기만 (기본)
//   node scripts/sync-price.mjs --apply   실제로 가격을 넣는다
//   node scripts/sync-price.mjs --apply --live   품절도 함께 해제한다
//
// ⚠️ 기획의 상품명은 길고(쿠팡용), 사이트 상품명은 폴더명이라 짧다.
//    「거봉포도」 ⊂ 「[특품] 산지직송 고당도 경북 명품 거봉포도」 처럼
//    공백을 지운 뒤 포함 관계로 찾는다.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const LIVE = process.argv.includes('--live')

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
const { error: authErr } = await sb.auth.signInWithPassword({
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
})
if (authErr) { console.error('관리자 로그인 실패:', authErr.message); process.exit(1) }

const squash = (s) => String(s || '').replace(/\s+/g, '').toLowerCase()

const { data: plans } = await sb.from('product_plans').select('*')
const { data: prods } = await sb.from('products').select('id,name,category,price,original_price,sold_out')

// 기획에서 「가장 싼 옵션 가격」과 「옵션 수」를 뽑는다
const planInfo = (p) => {
  const d = p.data || p
  const name = d.coupang?.name || d.name || ''
  const prices = (d.options || [])
    .map((o) => Number(o.price))
    .filter((n) => Number.isFinite(n) && n > 0)
  return { name, min: prices.length ? Math.min(...prices) : null, count: prices.length }
}

const infos = plans.map(planInfo).filter((i) => i.name)

// ⚠️ 「흰다리새우」가 「무항생제흰다리새우」 안에 들어 있어서, 그냥 찾으면
//    무항생제 상품에 일반 새우 가격(37,800)이 붙는다. 실제로 8,100원 손해가 날 뻔했다.
//    그래서 ① 사이트 상품명이 긴 것부터 짝을 지어 먼저 가져가게 하고
//         ② 이미 다른 상품이 쓴 기획은 다시 쓰지 않는다.
// 헷갈리는 짝은 사람이 정해준다. 사이트 상품명 → 기획 이름의 일부
//   「흰다리새우」와 「무항생제흰다리새우」는 두 기획 이름에 모두 '무항생제'가 들어 있어
//   자동으로는 구분할 수 없다. 실제로 한 번 서로 뒤바뀌어 8,100원 차이가 날 뻔했다.
const MANUAL = {
  '무항생제흰다리새우': '[무항생제] 신안 노지 흰다리새우',
  '흰다리새우': '[당일조업] 신안 활새우',
}

const rows = []
const used = new Set()
for (const pr of prods) {
  const key = squash(pr.name)
  const manual = MANUAL[pr.name]
  let cands = infos
    .map((i, idx) => ({ i, idx }))
    .filter(({ idx }) => !used.has(idx))

  if (manual) {
    cands = cands.filter(({ i }) => squash(i.name).includes(squash(manual)))
  } else {
    cands = cands.filter(({ i }) => squash(i.name).includes(key))
  }

  if (cands.length === 1) {
    used.add(cands[0].idx)
    rows.push({ pr, hit: cands[0].i })
  } else if (cands.length > 1) {
    // ⚠️ 후보가 여럿이면 넣지 않는다. 잘못 넣으면 가격이 어긋난다.
    rows.push({ pr, ambiguous: cands.map((c) => c.i) })
  } else {
    rows.push({ pr })
  }
}
rows.sort((a, b) => a.pr.name.localeCompare(b.pr.name, 'ko'))

const ok = rows.filter((r) => r.hit && r.hit.min)
const amb = rows.filter((r) => r.ambiguous)
const noPlan = rows.filter((r) => !r.hit && !r.ambiguous)
const noPrice = rows.filter((r) => r.hit && !r.hit.min)

console.log(`\n=== 이어진 것 ${ok.length}건 ===`)
ok.forEach(({ pr, hit }) => {
  const mark = pr.price === hit.min ? '(그대로)' : `${pr.price?.toLocaleString()} → ${hit.min.toLocaleString()}`
  console.log(`· ${pr.category}/${pr.name.padEnd(14)} ${String(hit.min).padStart(8)}원  옵션 ${hit.count}개  ${mark}`)
})

if (noPrice.length) {
  console.log(`\n=== 기획은 있는데 가격이 비었음 ${noPrice.length}건 ===`)
  noPrice.forEach(({ pr }) => console.log(`· ${pr.category}/${pr.name}`))
}
if (amb.length) {
  console.log(`
=== ⚠️ 짝이 여럿이라 넣지 않음 ${amb.length}건 ===`)
  amb.forEach(({ pr, ambiguous }) => {
    console.log(`· ${pr.category}/${pr.name}`)
    ambiguous.forEach((i) => console.log(`    후보: ${i.name}  (${i.min?.toLocaleString()}원)`))
  })
}
if (noPlan.length) {
  console.log(`\n=== 기획을 못 찾음 ${noPlan.length}건 ===`)
  noPlan.forEach(({ pr }) => console.log(`· ${pr.category}/${pr.name}`))
}

if (!APPLY) {
  console.log('\n미리보기입니다. 실제로 넣으려면 --apply 를 붙이세요.')
  console.log('품절까지 풀려면 --apply --live')
  process.exit(0)
}

let n = 0
for (const { pr, hit } of ok) {
  if (pr.price === hit.min && !(LIVE && pr.sold_out)) continue
  const patch = { price: hit.min }
  if (LIVE) patch.sold_out = false
  const { error } = await sb.from('products').update(patch).eq('id', pr.id)
  if (error) console.error(`  ! ${pr.name}: ${error.message}`)
  else { n++; console.log(`  ✓ ${pr.name} ${hit.min.toLocaleString()}원${LIVE ? ' · 판매중' : ''}`) }
}
console.log(`\n${n}건 반영했습니다.`)
if (!LIVE) console.log('※ 품절 상태는 그대로입니다. 관리자 페이지에서 풀거나 --live 를 쓰세요.')
