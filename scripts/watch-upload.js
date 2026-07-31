import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import chokidar from 'chokidar'
import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve('..', '제품명')
const CATEGORIES = ['과일', '야채', '수산', '축산', '선물세트', '식품']
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i
const STABILITY_DELAY_MS = 8000

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const pendingTimers = new Map()

function sortByThumbNumber(files) {
  return [...files].sort((a, b) => {
    const na = Number((a.match(/썸네일(\d+)/) || [])[1] ?? 999)
    const nb = Number((b.match(/썸네일(\d+)/) || [])[1] ?? 999)
    return na - nb
  })
}

async function processProduct(productDir) {
  const category = path.basename(path.dirname(productDir))
  const name = path.basename(productDir)

  if (!CATEGORIES.includes(category)) {
    console.warn(`[건너뜀] 카테고리 폴더명이 올바르지 않아요: "${category}" (${name})`)
    return
  }

  const { data: existing, error: lookupError } = await supabase
    .from('products')
    .select('id')
    .eq('name', name)
    .eq('category', category)
    .maybeSingle()

  if (lookupError) {
    console.error(`[오류] 기존 상품 조회 실패 (${name}):`, lookupError.message)
    return
  }
  if (existing) {
    console.log(`[건너뜀] 이미 등록된 상품이에요: ${category}/${name}`)
    return
  }

  let files
  try {
    files = fs.readdirSync(productDir).filter((f) => IMAGE_EXT.test(f))
  } catch (e) {
    console.error(`[오류] 폴더를 읽을 수 없어요 (${productDir}):`, e.message)
    return
  }
  if (files.length === 0) return

  const thumbFiles = sortByThumbNumber(files.filter((f) => /썸네일/.test(f)))
  const otherFiles = files.filter((f) => !/썸네일/.test(f)).sort((a, b) => a.localeCompare(b, 'ko'))
  const orderedFiles = [...thumbFiles, ...otherFiles]

  console.log(`[시작] ${category}/${name} 사진 ${orderedFiles.length}장 업로드 중...`)

  const urls = []
  for (const file of orderedFiles) {
    const filePath = path.join(productDir, file)
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(file).slice(1).toLowerCase()
    const storagePath = `${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('products').upload(storagePath, buffer, {
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    })
    if (error) {
      console.error(`[오류] 이미지 업로드 실패 (${file}):`, error.message)
      continue
    }
    const { data } = supabase.storage.from('products').getPublicUrl(storagePath)
    urls.push(data.publicUrl)
  }

  if (urls.length === 0) {
    console.error(`[오류] 업로드된 이미지가 없어 상품 등록을 건너뜀: ${name}`)
    return
  }

  const [mainUrl, ...detailUrls] = urls
  const { error: insertError } = await supabase.from('products').insert({
    name,
    brand: '팜데이푸드',
    category,
    price: 0,
    original_price: null,
    discount_rate: null,
    rating: 0,
    review_count: 0,
    thumbnail: `url("${mainUrl}") center/cover no-repeat`,
    description: null,
    detail_images: detailUrls,
    badges: [],
    sold_out: true,
  })

  if (insertError) {
    console.error(`[오류] 상품 등록 실패: ${name}`, insertError.message)
    return
  }

  console.log(`[완료] ${category}/${name} 등록됨 — 관리자 페이지에서 가격 입력하고 품절 해제하면 판매 시작돼요.`)
}

function scheduleProcess(productDir) {
  if (pendingTimers.has(productDir)) clearTimeout(pendingTimers.get(productDir))
  const timer = setTimeout(() => {
    pendingTimers.delete(productDir)
    processProduct(productDir).catch((e) => console.error(`[오류] 처리 실패 (${productDir}):`, e.message))
  }, STABILITY_DELAY_MS)
  pendingTimers.set(productDir, timer)
}

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`감시할 폴더가 없어요: ${ROOT}`)
    process.exit(1)
  }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  })
  if (authError) {
    console.error('관리자 로그인 실패:', authError.message)
    process.exit(1)
  }

  console.log(`나비서 상품 자동 업로드 감시 시작: ${ROOT}`)

  const watcher = chokidar.watch(ROOT, {
    depth: 3,
    ignoreInitial: false,
    awaitWriteFinish: { stabilityThreshold: 3000, pollInterval: 500 },
  })

  watcher.on('add', (filePath) => {
    if (!IMAGE_EXT.test(filePath)) return
    const productDir = path.dirname(filePath)
    const categoryDir = path.dirname(productDir)
    if (path.dirname(categoryDir) !== ROOT) return
    scheduleProcess(productDir)
  })
}

main()
