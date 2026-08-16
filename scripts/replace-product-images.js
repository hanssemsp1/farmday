// 이미 등록된 상품의 이미지만 교체한다 (상품 id·가격·옵션 설정은 유지)
// 사용법: node scripts/replace-product-images.js <카테고리> <상품명>
//   예) node scripts/replace-product-images.js 과일 성주참외
// 이미지 출처: ../제품명/<카테고리>/<상품명>/  (썸네일1..N → 첫 장이 대표, 나머지는 상세)
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const [, , category, name] = process.argv
if (!category || !name) {
  console.error('사용법: node scripts/replace-product-images.js <카테고리> <상품명>')
  process.exit(1)
}

const IMAGE_EXT = /\.(png|jpe?g|webp)$/i
const dir = path.resolve('..', '제품명', category, name)
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

function ordered(files) {
  const num = (f, re) => Number((f.match(re) || [])[1] ?? 999)
  const thumbs = files.filter(f => /썸네일/.test(f)).sort((a, b) => num(a, /썸네일(\d+)/) - num(b, /썸네일(\d+)/))
  const rest = files.filter(f => !/썸네일/.test(f)).sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
  return [...thumbs, ...rest]
}

async function main() {
  if (!fs.existsSync(dir)) { console.error(`폴더가 없어요: ${dir}`); process.exit(1) }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD,
  })
  if (authError) { console.error('관리자 로그인 실패:', authError.message); process.exit(1) }

  const { data: product, error: findError } = await supabase
    .from('products').select('id,name,category').eq('name', name).eq('category', category).maybeSingle()
  if (findError) { console.error('상품 조회 실패:', findError.message); process.exit(1) }
  if (!product) { console.error(`등록된 상품이 없어요: ${category}/${name}`); process.exit(1) }

  const files = ordered(fs.readdirSync(dir).filter(f => IMAGE_EXT.test(f)))
  if (files.length === 0) { console.error('업로드할 이미지가 없어요.'); process.exit(1) }
  console.log(`[시작] ${category}/${name} — 이미지 ${files.length}장 업로드`)

  const urls = []
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(dir, file))
    const ext = path.extname(file).slice(1).toLowerCase()
    const storagePath = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('products')
      .upload(storagePath, buffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}` })
    if (error) { console.error(`  [실패] ${file}: ${error.message}`); continue }
    urls.push(supabase.storage.from('products').getPublicUrl(storagePath).data.publicUrl)
    console.log(`  [완료] ${file}`)
  }
  if (urls.length === 0) { console.error('업로드된 이미지가 없어 중단합니다.'); process.exit(1) }

  const [mainUrl, ...detailUrls] = urls
  const { error: updateError } = await supabase.from('products').update({
    thumbnail: `url("${mainUrl}") center/cover no-repeat`,
    detail_images: detailUrls,
  }).eq('id', product.id)

  if (updateError) { console.error('상품 수정 실패:', updateError.message); process.exit(1) }
  console.log(`[성공] 대표 1장 + 상세 ${detailUrls.length}장으로 교체했어요. (상품 id ${product.id} 유지)`)
}

main().catch(e => { console.error('오류:', e.message); process.exit(1) })
