// 완성된 상품 세트(썸네일·상세 이미지)와 기획서 옵션을 팜데이 판매 사이트(products / product_options)에 올린다.
//
// 실행: node scripts/publish-set.mjs <설정.json> [--dry]
//   설정: { "planId": "여자만새꼬막", "setDir": "C:/…/결과/새꼬막_v1/완성", "name": "여자만 새꼬막",
//          "category": "수산", "shipping": 0, "description": "한 줄 소개" }
//   "order": ["상세1", …] 을 주면 상세 이미지를 그 순서 그대로 올린다(대표님이 만든 기존 세트용)
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
// cfg.extraPlans: 다른 기획서의 옵션을 뒤에 붙인다(같은 세트를 쓰는 대품·특품처럼 쿠팡엔 따로, 사이트엔 한 상품)
for (const id of cfg.extraPlans || []) {
  const { data: more } = await sb.from('product_plans').select('options').eq('id', id)
  if (!more?.length) { console.error('기획서 없음:', id); process.exit(1) }
  plan.options = [...(plan.options || []), ...(more[0].options || [])]
}
// cfg.labels: 기획서 옵션 이름이 비어 있을 때(대표님 옛 기획서) 순서대로 붙일 이름
if (cfg.labels) plan.options = (plan.options || []).map((o, i) => (o.label ? o : { ...o, label: cfg.labels[i] || o.weight || `옵션 ${i + 1}` }))
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
const thumb = cfg.main ? cfg.main + '.png' : files.find((f) => f === '썸네일1.png') // cfg.main: 대표 썸네일 파일 이름(대표님 세트처럼 이름이 다를 때)
const tail = ['포장', '보관법', '상세9', '교환반품', '카카오채널', '이벤트']
const rank = (f) => {
  const b = f.replace(/\.png$/i, '')
  const m = b.match(/^상세(\d+)(?:-(\d+))?$/)
  const isNumbered16 = files.includes('상세16.png') && !files.includes('교환반품.png')
  if (m && (isNumbered16 || Number(m[1]) <= 8)) return Number(m[1]) * 100 + Number(m[2] || 0)
  const t = tail.indexOf(b)
  return t >= 0 ? 10000 + t : null
}
// order 항목이 경로(/ 포함)면 setDir 밖의 파일 — 사이트 공통 장(교환·반품 등)을 끼울 때
const details = cfg.order ? cfg.order.map((n) => (/[\/]/.test(n) ? n : n + '.png')) : files.map((f) => [f, rank(f)]).filter(([, r]) => r !== null).sort((a, b) => a[1] - b[1]).map(([f]) => f)
console.log('  썸네일:', thumb, '\n  상세 순서:', details.join(' → '))
if (dry) { console.log('\n--dry 라서 올리지 않았습니다.'); process.exit(0) }

async function upload(file, maxW) {
  const img = await loadImage(fs.readFileSync(path.isAbsolute(file) ? file : path.join(cfg.setDir, file)))
  const w = Math.min(maxW, img.width), h = Math.round(img.height * w / img.width)
  const c = createCanvas(w, h); c.getContext('2d').drawImage(img, 0, 0, w, h)
  const buf = c.toBuffer('image/jpeg', 85)
  const p = `sets/${encodeURIComponent(cfg.planId).replace(/%/g, '')}/${Date.now()}-${encodeURIComponent(path.basename(file).replace(/\.png$/i, '')).replace(/%/g, '')}.jpg`
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: 'image/jpeg', upsert: true })
  if (error) throw new Error(`${file} 업로드 실패: ${error.message}`)
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl
}
const thumbUrl = await upload(thumb, 1000)
// 추가 썸네일(썸네일2~N, 번호 순) — 상품 화면 맨 위에서 넘겨 본다. cfg.thumbs 로 고를 수 있음
const thumbNo = (f) => Number(f.match(/\d+/)[0])
const extraThumbs = cfg.thumbs
  ? cfg.thumbs.map((n) => n + '.png')
  : files.filter((f) => /^썸네일\d+\.png$/.test(f) && f !== thumb).sort((a, b) => thumbNo(a) - thumbNo(b))
console.log('  추가 썸네일:', extraThumbs.join(' → ') || '없음')
const thumbUrls = []
for (const f of extraThumbs) thumbUrls.push(await upload(f, 1000))
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
// thumbnails 칸은 supabase/products_thumbnails.sql 실행 뒤에만 있다 — 없으면 건너뛴다
{
  const { error } = await sb.from('products').update({ thumbnails: thumbUrls }).eq('id', productId)
  if (error) console.warn('  ⚠️ 추가 썸네일 저장 건너뜀(products_thumbnails.sql 실행 필요):', error.message)
}
// 옵션은 이름으로 찾아 고친다 — 지우고 새로 만들면 옵션 id가 바뀌어 손님 장바구니에 담긴 옵션이 끊긴다
const { data: oldOpts } = await sb.from('product_options').select('id,name').eq('product_id', productId)
const wanted = opts.map((o, i) => ({ name: o.label.replace(/\s*⭐메인/, ''), price: o.sitePrice, sold_out: false, sort_order: i }))
for (const w of wanted) {
  const hit = oldOpts?.find((o) => o.name === w.name)
  const { error } = hit
    ? await sb.from('product_options').update(w).eq('id', hit.id)
    : await sb.from('product_options').insert({ ...w, product_id: productId })
  if (error) throw error
}
const gone = (oldOpts || []).filter((o) => !wanted.some((w) => w.name === o.name)).map((o) => o.id)
if (gone.length) await sb.from('product_options').delete().in('id', gone)

// 기획서 옵션에 사이트 가격을 적어 둔다(쿠팡 가격은 price/realPrice 그대로)
plan.options = (plan.options || []).map((o) => { const s = opts.find((x) => x.label === o.label); return s ? { ...o, sitePrice: s.sitePrice } : o })
// 다른 기획서 옵션을 합쳤을 때는 되써 넣지 않는다(합친 옵션이 원래 기획서에 섞이지 않게)
if (!cfg.extraPlans) await sb.from('product_plans').update({ options: plan.options }).eq('id', cfg.planId)
console.log(`\n올렸습니다 → 상품 id ${productId} · 대표 가격 ${row.price}원 (메인 옵션 ${main.label})`)
