// 파밍 공급가 매일 확인용 (이대리)
//  node scripts/farming.mjs apply-map <map.json>   기획서 옵션에 farming(파밍 구성상품 [이름, 개수]) 짝을 써 넣는다
//  node scripts/farming.mjs export                 브라우저 확인 스크립트(collect.js)에 넣을 JSON 출력 {vendors, items}
//  node scripts/farming.mjs update <diff.json> [--dry]
//      diff = collect.js 결과의 「바뀜」 배열 [{p, i, l, old, new}]
//      → 기획서 cost 갱신. 오른 옵션은 사이트 가격이 15% 규칙(결제수수료 3.5% 빼고 15% 이상)에 못 미치면
//        가장 낮은 x,900원으로 올린다(쿠팡가는 건드리지 않음). 내린 옵션은 cost만 고치고 가격은 그대로.
import 'dotenv/config'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env
const sb = createClient(url, key)
const { error: authErr } = await sb.auth.signInWithPassword({ email, password: pw })
if (authErr) { console.error('로그인 실패:', authErr.message); process.exit(1) }

const [cmd, arg] = process.argv.slice(2)
const dry = process.argv.includes('--dry')
const { data: plans } = await sb.from('product_plans').select('id,vendor,options')
const byId = Object.fromEntries(plans.map((p) => [p.id, p]))
const PG = 0.035, MIN = 0.15
const okPrice = (site, cost, ship) => site * (1 - PG) - cost - ship >= site * MIN
const ruleUp = (cost, ship) => { let s = 900; while (!okPrice(s, cost, ship)) s += 1000; return s }
const strip = (s) => (s || '').replace(/\s*⭐메인/, '').trim()

if (cmd === 'apply-map') {
  const map = JSON.parse(fs.readFileSync(arg, 'utf8'))
  for (const [id, opts] of Object.entries(map)) {
    if (id.startsWith('_')) continue
    const p = byId[id]; if (!p) { console.log('기획서 없음:', id); continue }
    p.options = (p.options || []).map((o, i) => (opts[i] ? { ...o, farming: opts[i] } : o))
    if (!dry) { const { error } = await sb.from('product_plans').update({ options: p.options }).eq('id', id); if (error) console.log('ERR', id, error.message) }
    console.log('짝 넣음', id, Object.keys(opts).length + '개')
  }
} else if (cmd === 'export') {
  const items = []; const vendors = new Set()
  for (const p of plans) (p.options || []).forEach((o, i) => {
    if (!o.farming) return
    vendors.add(p.vendor?.name)
    items.push({ p: p.id, i, l: strip(o.label), c: o.cost, f: o.farming })
  })
  const body = JSON.stringify({ vendors: [...vendors].filter(Boolean), items })
  // 크롬 쪽 스크립트가 받아 가도록 공개 저장소에도 올린다(공급가·옵션 이름만, 개인정보 없음)
  const { error } = await sb.storage.from('products').upload('farming/export.json', new Blob([body], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '60' })
  if (error) console.error('업로드 실패:', error.message)
  else console.error('업로드:', sb.storage.from('products').getPublicUrl('farming/export.json').data.publicUrl)
  console.log(body)
} else if (cmd === 'update') {
  const diff = JSON.parse(fs.readFileSync(arg, 'utf8'))
  const { data: prods } = await sb.from('products').select('id,name,product_options(id,name,price)')
  for (const d of diff) {
    const p = byId[d.p]; if (!p) { console.log('기획서 없음', d.p); continue }
    const o = p.options[d.i]; const ship = o.shipping || 0
    const before = o.cost; o.cost = d.new
    o.note = `${o.note ? o.note + ' · ' : ''}파밍 ${before}→${d.new} (${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)})`
    let line = `${d.p} | ${strip(o.label)} | 공급가 ${before}→${d.new}`
    // 사이트 옵션 찾기: 이 기획서의 옵션 이름을 모두 가진 사이트 상품
    const labels = p.options.map((x) => strip(x.label)).filter(Boolean)
    const prod = prods.find((pr) => labels.every((l) => (pr.product_options || []).some((po) => po.name === l)))
    const po = prod && prod.product_options.find((x) => x.name === strip(o.label))
    if (po) {
      const ok = okPrice(po.price, d.new, ship)
      if (d.new > before && !ok) {
        const np = ruleUp(d.new, ship)
        line += ` | 사이트 ${po.price}→${np} (인상)`
        if (!dry) {
          await sb.from('product_options').update({ price: np }).eq('id', po.id)
          po.price = np // 상품 대표 가격 = 옵션 최저가 (publish-set 과 같은 규칙)
          await sb.from('products').update({ price: Math.min(...prod.product_options.map((x) => x.price)) }).eq('id', prod.id)
        }
        o.sitePrice = np
      } else line += ` | 사이트 ${po.price} 그대로 (남는 몫 ${Math.round((po.price * (1 - PG) - d.new - ship) / po.price * 100)}%)`
    } else line += ' | 사이트 상품 없음(쿠팡만)'
    console.log(line)
  }
  if (!dry) for (const id of new Set(diff.map((d) => d.p))) await sb.from('product_plans').update({ options: byId[id].options }).eq('id', id)
  console.log(dry ? '(--dry 라서 저장 안 함)' : '저장함')
} else {
  console.log('사용법: apply-map <map.json> | export | update <diff.json> [--dry]')
}
