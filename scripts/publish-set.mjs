// 완성된 상품 세트(썸네일·상세 이미지)와 기획서 옵션을 팜데이 판매 사이트(products / product_options)에 올린다.
//
// 실행: node scripts/publish-set.mjs <설정.json> [--dry]
//   설정: { "planId": "여자만새꼬막", "setDir": "C:/…/결과/새꼬막_v1/완성", "name": "여자만 새꼬막",
//          "category": "수산", "shipping": 0, "description": "한 줄 소개" }
//
// 가격(우리 사이트) = 쿠팡 쿠폰 뒤 가격의 약 93%를 x,900원으로 내림.
// 단, 결제수수료 3.5%·공급가·배송비를 빼고 15% 이상 남지 않으면 15%가 남는 가장 낮은 x,900원으로 올린다(쿠팡가를 넘으면 쿠팡가).
// 이미지는 JPEG(품질 85)로 줄여 products 버킷에 올린다. 같은 이름 상품이 있으면 덮어쓴다.

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'

const require = createRequire('C:/Users/서현주/OneDrive/Desktop/Agent/팜데이-책상/결과/BK거봉_v1/도구/package.json')
const { createCanvas, loadImage } = require('@napi-rs/canvas')

const cfg = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const dry = process.argv.includes('--dry')
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env
const sb = createClient(url, key)
const { error: authErr } = await sb.auth.signInWithPassword({ email, password: pw })
if (authErr) { console.error('로그인 실패:', authErr.message); process.exit(1) }

// ── 가격 ─────────────────────────────────────
const PG_FEE = 0.035
const MIN_MARGIN = 0.15 // 사이트가 쿠팡보다 비싸지지 않게 하한은 15%
const floor900 = (n) => Math.floor((n - 900) / 1000) * 1000 + 900
const ceil900 = (n) => Math.ceil((n - 900) / 1000) * 1000 + 900
function sitePrice(coupangReal, cost, ship) {
  let p = floor900(coupangReal * 0.93)
  const need = (cost + ship) / (1 - PG_FEE - MIN_MARGIN)
  if (p < need) p = Math.min(ceil900(need), coupangReal)
  return p
}

const { data: plans, error: planErr } = await sb.from('product_plans').select('*').eq('id', cfg.planId)
if (planErr || !plans?.length) { console.error('기획서 없음:', cfg.planId); process.exit(1) }
const plan = plans[0]
const keep = (o) => !(cfg.excludeOptions && new RegExp(cfg.excludeOptions).test(o.label))
const opts = (plan.options || []).filter(keep).map((o, i) => {
  const ship = o.shipping ?? cfg.shipping ?? 0
  const real = o.realPrice ?? o.price
  const site = sitePrice(real, o.cost, ship)
  const net = Math.round(site * (1 - PG_FEE) - o.cost - ship)
  return { ...o, sitePrice: site, siteNet: net, sort: i }
})
console.log(`\n[${cfg.name}] 옵션 ${opts.length}개`)
for (const o of opts) console.log(`  ${o.label} | 쿠팡 ${o.realPrice ?? o.price} → 사이트 ${o.sitePrice} (순이익 ${o.siteNet}, ${(o.siteNet / o.sitePrice * 100).toFixed(1)}%)`)

// ── 이미지 순서 ───────────────────────────────
const files = fs.readdirSync(cfg.setDir).filter((f) => /\.png$/i.test(f) && !f.startsWith('_'))
const thumb = files.find((f) => f === '썸네일1.png')
const tail = ['포장', '보관법', '상세9', '교환반품', '카카오채널', '이벤트']
const rank = (f) => {
  const b = f.replace(/\.png$/i, '')
  const m = b.match(/^상세(\d+)(?:-(\d+))?$/)
  const isNumbered16 = files.includes('상세16.png') && !files.includes('교환반품.png')
  if (m && (isNumbered16 || Number(m[1]) <= 8)) return Number(m[1]) * 100 + Number(m[2] || 0)
  const t = tail.indexOf(b)
  return t >= 0 ? 10000 + t : null
}
const details = files.map((f) => [f, rank(f)]).filter(([, r]) => r !== null).sort((a, b) => a[1] - b[1]).map(([f]) => f)
console.log('  썸네일:', thumb, '\n  상세 순서:', details.join(' → '))
if (dry) { console.log('\n--dry 라서 올리지 않았습니다.'); process.exit(0) }

async function upload(file, maxW) {
  const img = await loadImage(fs.readFileSync(path.join(cfg.setDir, file)))
  const w = Math.min(maxW, img.width), h = Math.round(img.height * w / img.width)
  const c = createCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h)
  const buf = c.toBuffer('image/jpeg', 85)
  const p = `sets/${encodeURIComponent(cfg.planId).replace(/%/g, '')}/${Date.now()}-${encodeURIComponent(file.replace(/\.png$/i, '')).replace(/%/g, '')}.jpg`
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`${file} 업로드 실패: ${error.message}`)
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl
}
const thumbUrl = await upload(thumb, 1000)
const detailUrls = []
for (const f of details) detailUrls.push(await upload(f, 780))

const main = opts.find((o) => /메인|⭐/.test(o.label)) || opts[0]
const row = {
  name: cfg.name, brand: '팜데이', category: cfg.category,
  price: Math.min(...opts.map((o) => o.sitePrice)),
  original_price: null, discount_rate: null,
  thumbnail: `url("${thumbUrl}") center/cover no-repeat`,
  description: cfg.description || '', detail_images: detailUrls,
  badges: ['new'], sold_out: !!cfg.soldOut,
}
const { data: existing } = await sb.from('products').select('id').eq('name', cfg.name)
let productId
if (existing?.length) {
  productId = existing[0].id
  const { error } = await sb.from('products').update(row).eq('id', productId)
  if (error) throw error
} else {
  const { data, error } = await sb.from('products').insert({ ...row, rating: 0, review_count: 0 }).select('id').single()
  if (error) throw error
  productId = data.id
}
await sb.from('product_options').delete().eq('product_id', productId)
const { error: optErr } = await sb.from('product_options').insert(opts.map((o, i) => ({
  product_id: productId, name: o.label.replace(/\s*⭐메인/, ''), price: o.sitePrice, sold_out: false, sort_order: i,
})))
if (optErr) throw optErr

// 기획서 옵션에 사이트 가격을 적어 둔다(쿠팡 가격은 price/realPrice 그대로)
plan.options = (plan.options || []).map((o) => { const s = opts.find((x) => x.label === o.label); return s ? { ...o, sitePrice: s.sitePrice } : o })
await sb.from('product_plans').update({ options: plan.options }).eq('id', cfg.planId)
console.log(`\n올렸습니다 → 상품 id ${productId} · 대표 가격 ${row.price}원 (메인 옵션 ${main.label})`)
