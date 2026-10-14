// 비회원 주문 공용 — 조회 비밀번호 해시, 일회용 표, 주문번호, 조회 횟수 제한.
// guest-order(만들기·조회), toss-confirm(결제 확인), order-cancel(취소)이 같이 쓴다.

export const GUEST_LIMIT = 5 // 10분에 틀린 조회 5번까지
export const GUEST_WINDOW_MIN = 10
const PBKDF2_ITER = 100_000

export const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '')

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((h) => parseInt(h, 16)))

export async function sha256(text: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

async function pbkdf2(pw: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256))
}

/** 조회 비밀번호 → 「pbkdf2$반복$소금$해시」 (원문은 저장하지 않는다) */
export async function hashPin(pw: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return `pbkdf2$${PBKDF2_ITER}$${hex(salt.buffer)}$${await pbkdf2(pw, salt, PBKDF2_ITER)}`
}

export async function verifyPin(pw: string, stored: string | null | undefined) {
  const [kind, iter, salt, hash] = String(stored ?? '').split('$')
  if (kind !== 'pbkdf2' || !hash) return false
  const got = await pbkdf2(pw, unhex(salt), Number(iter))
  // 길이가 같은 두 값을 끝까지 비교 (시간으로 짐작하지 못하게)
  let diff = got.length ^ hash.length
  for (let i = 0; i < Math.min(got.length, hash.length); i++) diff |= got.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

/** 결제 확인용 일회용 표 — 원문은 손님 브라우저에만, 서버엔 해시만 */
export function newToken() {
  return hex(crypto.getRandomValues(new Uint8Array(24)).buffer)
}

/** 주문번호(손님에게 보여 주는 것) = FD-주문 id 앞 8자리 — 발주 엑셀의 거래처주문번호와 같은 머리 */
export const orderNoOf = (id: string) => 'FD-' + id.slice(0, 8).toUpperCase()
export const normOrderNo = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/^FD-?/, '').replace(/[^0-9A-F]/g, '').slice(0, 8)

export const pinOk = (v: string) => /^\d{4,6}$/.test(v)

// deno-lint-ignore no-explicit-any
type Db = any

export const GUEST_DAY_LIMIT = 20 // 하루(24시간)에 틀린 조회 20번까지

/**
 * 틀린 조회가 많으면 true. 열쇠: 접속 IP, 휴대폰 번호(해시), 주문번호 — 비밀번호가 숫자 4~6자리라 경우의 수가 작으므로
 * IP를 바꿔 가며 한 주문을 두드려도 주문번호·번호 열쇠에서 막힌다. 10분 5번 + 하루 20번.
 */
export async function tooManyFailures(db: Db, ip: string, phone: string, orderNo = '') {
  const keys = ['guest-ip:' + ip, 'guest-phone:' + (await sha256(phone)).slice(0, 32), ...(orderNo ? ['guest-order:' + orderNo] : [])]
  const now = Date.now()
  const since10 = new Date(now - GUEST_WINDOW_MIN * 60_000).toISOString()
  const sinceDay = new Date(now - 864e5).toISOString()
  const { data, error } = await db.from('find_id_log').select('key,at').in('key', keys).gte('at', sinceDay)
  if (error) return { blocked: false, keys }
  const rows = (data ?? []) as { key: string; at: string }[]
  const blocked = keys.some((k) => {
    const mine = rows.filter((r) => r.key === k)
    return mine.filter((r) => r.at >= since10).length >= GUEST_LIMIT || mine.length >= GUEST_DAY_LIMIT
  })
  return { blocked, keys }
}

export async function recordFailure(db: Db, keys: string[]) {
  await db.from('find_id_log').insert(keys.map((key) => ({ key })))
}

export const clientIp = (req: Request) =>
  (req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? 'unknown').split(',')[0].trim()

/**
 * 주문번호 + 휴대폰 + 비밀번호로 비회원 주문 찾기. 틀리면 횟수를 센다.
 * 돌려주는 값: { order } | { status, code, message }
 */
export async function findGuestOrder(db: Db, req: Request, input: { orderNo?: unknown; phone?: unknown; password?: unknown }) {
  const no = normOrderNo(input.orderNo)
  const phone = digits(input.phone)
  const pw = String(input.password ?? '')
  if (no.length !== 8 || phone.length < 10 || !pinOk(pw)) {
    return { status: 400, code: 'BAD_INPUT', message: '주문번호·휴대폰 번호·비밀번호(숫자 4~6자리)를 확인해 주세요.' }
  }
  const { blocked, keys } = await tooManyFailures(db, clientIp(req), phone, no)
  if (blocked) return { status: 429, code: 'TOO_MANY', message: '여러 번 틀리셨어요. 잠시 뒤 다시 시도하시거나 카카오채널로 문의해 주세요.' }

  const { data } = await db.from('orders').select('*').eq('guest', true).eq('guest_phone', phone)
  const cand = ((data ?? []) as { id: string; guest_pw_hash: string }[]).find((o) => o.id.slice(0, 8).toUpperCase() === no)
  if (!cand || !(await verifyPin(pw, cand.guest_pw_hash))) {
    await recordFailure(db, keys)
    return { status: 404, code: 'NOT_FOUND', message: '주문을 찾지 못했어요. 주문번호·휴대폰 번호·비밀번호를 다시 확인해 주세요.' }
  }
  // deno-lint-ignore no-explicit-any
  return { order: cand as any }
}

/** 손님 화면에 돌려줄 때 빼는 칸 */
// deno-lint-ignore no-explicit-any
export function publicOrder(o: any) {
  const { guest_pw_hash: _a, guest_token_hash: _b, payment_key: _c, supply_lines: _d, user_id: _e, ...rest } = o
  return { ...rest, order_no: orderNoOf(o.id) }
}
