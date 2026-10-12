// 팜데이 사이트(/admin/planning)에 올라간 상품기획을 읽어온다.
//
// 실행: node scripts/pull-plan.mjs            (목록만)
//       node scripts/pull-plan.mjs 곶감        (이름에 「곶감」이 든 것의 내용 전부)
//
// .env.local 의 ADMIN_EMAIL / ADMIN_PASSWORD 로 로그인한다. 비밀번호는 화면에 찍지 않는다.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const q = process.argv[2] || null

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env
if (!url || !key || !email || !pw) {
  console.error('\n.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / ADMIN_EMAIL / ADMIN_PASSWORD 가 있어야 합니다.')
  process.exit(1)
}

const supabase = createClient(url, key)
const { error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw })
if (authErr) {
  console.error('로그인 실패:', authErr.message)
  process.exit(1)
}

const { data, error } = await supabase.from('product_plans').select('*')
if (error) {
  console.error('읽기 실패:', error.message)
  process.exit(1)
}

const rows = (data || []).sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))

if (!q) {
  console.log(`\n올라간 기획 ${rows.length}건\n`)
  for (const r of rows) {
    const 날 = String(r.updated_at || r.created_at || '').slice(0, 10)
    console.log(`  ${(r.id || r.name || '?').padEnd(24)} ${날}`)
  }
  console.log('\n내용을 보려면: node scripts/pull-plan.mjs <이름 일부>\n')
} else {
  const hit = rows.filter((r) => JSON.stringify(r).includes(q))
  if (!hit.length) { console.log(`「${q}」로 찾은 기획이 없습니다.`); process.exit(0) }
  for (const r of hit) console.log(JSON.stringify(r, null, 2))
}
