// products 버킷 sets/ 안에서 지금 어디에도 쓰이지 않는 이미지를 지운다(publish-set을 다시 돌릴 때마다 옛 파일이 쌓이므로).
// 실행: node scripts/clean-sets.mjs [--dry]
// 「쓰임」 = products·product_options·product_plans·orders·site_banners·site_settings·seller_diary 어디에든 경로가 들어 있으면.
// sets/ 밖의 파일은 건드리지 않는다.
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const dry = process.argv.includes('--dry')
const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env
const sb = createClient(url, key)
const { error: authErr } = await sb.auth.signInWithPassword({ email, password: pw })
if (authErr) { console.error('로그인 실패:', authErr.message); process.exit(1) }

const files = []
async function walk(prefix) {
  for (let off = 0; ; off += 1000) {
    const { data } = await sb.storage.from('products').list(prefix, { limit: 1000, offset: off })
    if (!data?.length) break
    for (const it of data) {
      const p = `${prefix}/${it.name}`
      if (it.id === null) await walk(p)
      else files.push({ p, s: it.metadata?.size || 0 })
    }
    if (data.length < 1000) break
  }
}
await walk('sets')

let used = ''
for (const t of ['products', 'product_options', 'product_plans', 'orders', 'site_banners', 'site_settings', 'seller_diary']) {
  const { data, error } = await sb.from(t).select('*').limit(10000)
  if (error) { console.error(`${t} 읽기 실패 — 안전을 위해 지우지 않습니다:`, error.message); process.exit(1) }
  used += JSON.stringify(data)
}
const unused = files.filter((f) => !used.includes(f.p))
const mb = (n) => (n / 1048576).toFixed(1)
console.log(`sets/ ${files.length}개 중 안 쓰임 ${unused.length}개 (${mb(unused.reduce((s, f) => s + f.s, 0))}MB)`)
if (dry || !unused.length) process.exit(0)
let n = 0
for (let i = 0; i < unused.length; i += 100) {
  const { data, error } = await sb.storage.from('products').remove(unused.slice(i, i + 100).map((f) => f.p))
  if (error) { console.error('삭제 실패:', error.message); process.exit(1) }
  n += data.length
}
console.log(`지웠습니다 ${n}개`)
