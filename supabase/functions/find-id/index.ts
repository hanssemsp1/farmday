// 아이디(가입 이메일) 찾기 — 이름 + 연락처가 회원가입 때 적은 것과 같으면, 이메일을 가려서(앞 2글자 + 도메인) 돌려준다.
// 받는 값: { name, phone }. 로그인 없이 부를 수 있다(anon 키). 전체 이메일은 절대 돌려주지 않는다.
// 남의 가입 여부 캐기 막기: ① 같은 접속(IP)·같은 번호로 10분에 5번 넘으면 거절(find_id_log 표)
//                            ② 찾았든 못 찾았든 응답 시간을 같게(최소 1.2초)  ③ 이메일은 앞 2글자만
import { createClient } from 'npm:@supabase/supabase-js@2'

const LIMIT = 5
const WINDOW_MIN = 10
const MIN_MS = 1200

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')
const squash = (v: unknown) => String(v ?? '').replace(/\s+/g, '')

/** farmdaytest2@gmail.com → fa****@gmail.com */
export function maskEmail(email: string): string {
  const [id, domain] = email.split('@')
  if (!domain) return '****'
  return id.slice(0, 2) + '****@' + domain
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const started = Date.now()
  // 모든 응답을 같은 최소 시간 뒤에 — 찾았는지 시간으로 짐작하지 못하게
  const reply = async (status: number, body: Record<string, unknown>) => {
    const wait = MIN_MS - (Date.now() - started)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
  if (req.method !== 'POST') return reply(405, { ok: false, message: 'POST만 받습니다.' })
  let body: { name?: string; phone?: string }
  try { body = await req.json() } catch { return reply(400, { ok: false, message: '요청 형식이 올바르지 않아요.' }) }
  const name = squash(body.name)
  const phone = digits(body.phone)
  if (!name || phone.length < 10) return reply(400, { ok: false, message: '이름과 휴대폰 번호를 정확히 적어 주세요.' })

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // ① 반복 조회 제한
  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim()
  const keys = ['ip:' + ip, 'phone:' + (await sha256(phone))]
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString()
  const { data: recent, error: logErr } = await db.from('find_id_log').select('key').in('key', keys).gte('at', since)
  if (!logErr) {
    const tooMany = keys.some((k) => (recent ?? []).filter((r) => r.key === k).length >= LIMIT)
    if (tooMany) return reply(429, { ok: false, message: `여러 번 조회하셨어요. ${WINDOW_MIN}분 뒤에 다시 시도해 주세요.` })
    await db.from('find_id_log').insert(keys.map((key) => ({ key })))
    // 하루 지난 기록 정리
    await db.from('find_id_log').delete().lt('at', new Date(Date.now() - 864e5).toISOString())
  }

  // 회원 찾기
  const found: string[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) return reply(500, { ok: false, message: '잠시 뒤 다시 시도해 주세요.' })
    for (const u of data.users) {
      const m = (u.user_metadata ?? {}) as Record<string, unknown>
      if (squash(m.name) === name && digits(m.phone) === phone && u.email) found.push(maskEmail(u.email))
    }
    if (data.users.length < 200) break
  }
  return reply(200, { ok: true, emails: found })
})
