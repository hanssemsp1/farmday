// 상품기획 사진 올리기/지우기
//
// 사진은 글자와 달리 파일이라 서버의 사진 보관함(Storage)에 둔다.
// 기획서에는 사진 자체가 아니라 "주소"만 적어 둔다 — 그래야 자료가 무겁지 않다.

import { supabase } from './supabaseClient'

const BUCKET = 'plan-images'

// 상품 이름을 짧은 영문·숫자로 바꾼다.
// ⚠️ 보관함은 경로에 한글을 받지 않는다(Invalid key). 그래서 한글은 못 쓴다.
//    대신 이름이 다르면 값도 달라지므로 상품별로 폴더가 갈린다.
function folderOf(planId: string): string {
  let h = 0
  for (let i = 0; i < planId.length; i++) h = (h * 31 + planId.charCodeAt(i)) >>> 0
  const ascii = planId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
  return `${ascii || 'p'}_${h.toString(36)}`
}

/** 파일 이름을 안전하게 — 한글·공백이 들어가면 올릴 수 없다 */
function safeName(planId: string, file: File): string {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const stamp = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return `${folderOf(planId)}/${stamp}${rand}.${ext}`
}

export interface UploadResult {
  url?: string
  error?: string
}

/** 사진 한 장 올리기. 성공하면 볼 수 있는 주소를 준다 */
export async function uploadPlanImage(planId: string, file: File): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) return { error: '사진 파일만 올릴 수 있어요.' }
  // 너무 큰 사진은 서버·화면 모두 느려진다
  if (file.size > 10 * 1024 * 1024) return { error: '사진이 너무 큽니다 (10MB 이하).' }

  const path = safeName(planId, file)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) return { error: error.message }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}

/** 사진 지우기 (주소에서 경로를 되찾아 지운다) */
export async function deletePlanImage(url: string): Promise<string | null> {
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return null // 우리 보관함 사진이 아니면 그냥 둔다
  const path = decodeURIComponent(url.slice(i + marker.length))
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return error ? error.message : null
}
