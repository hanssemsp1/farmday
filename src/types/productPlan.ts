// 상품 기획 — 대표님 양식(제품리스트1.xlsx)을 그대로 옮긴 모양
// 로컬 도구(farmday-studio/manager)와 같은 구조라 데이터를 그대로 주고받을 수 있다.

export interface PlanThumb {
  hook: string      // 썸네일에 넣을 문구 — 한 줄로 쓴다 (대표님 결정 2026-08-13)
  kicker?: string   // 예전에 쓰던 윗줄. 새로 쓰지 않고, 옛 데이터만 남아 있다
}

export interface PlanOption {
  label: string
  weight: string
  cost: number | null       // 공급가
  price: number | null      // 판매가(쿠폰적용값) — 정상가 계산에 쓴다
  realPrice?: number | null // 실제판매가 — 마진율·마진액 계산에 쓴다 (비우면 판매가로 계산)
  listPrice: number | null  // 정상가 (할인율이 있으면 자동 계산)
  discount: number | null   // 0.5 = 50%
  fee: number               // 쿠팡 수수료 (0.12)
  shipping: number          // 택배비 (있는 상품만)
  note: string
  priceAlt?: number | null  // 엑셀에 판매가가 두 개였을 때의 다른 값
  // 테무 — 내가 올린 값에 테무가 7.5%를 얹어 손님에게 보여준다.
  temu?: {
    shipping?: number | null  // 테무 배송비 (비우면 위 택배비를 쓴다)
    margin?: number | null    // 수익률 0.15 = 15% (판매단가 기준, 쿠팡 마진율과 같은 셈법)
    price?: number | null     // 판매단가를 직접 정했을 때 (비우면 수익률로 계산)
  }
}

export interface PlanCompetitorRow {
  rank: number
  prices: Record<string, number | null>   // { "600g": 25800, "1.2kg": 47600 }
  title: string                            // 쿠팡에 보이는 상품명
}

export interface PlanCoupangOptionRow {
  option: string
  optionId: string
  exposeId: string
  couponId: string
  couponAmount: number | null
  start: string
  end: string
}

export interface PlanExtraDetail {
  role: string    // 무엇을 담는 장인지 (예: 포장·배송 안내)
  text: string
  after?: number  // 정해진 11장 중 몇 번 뒤에 오는지 (없으면 맨 뒤)
}

// 정해진 썸네일 5장 말고 더 넣고 싶은 컷
export interface PlanExtraThumb {
  role: string    // 어떤 컷인지 (예: 당도 측정, 크기 비교)
  hook: string
  after?: string  // 어느 썸네일 뒤에 오는지 (main / sub1 …, 없으면 맨 뒤)
}

export interface PlanReview {
  stars: number
  text: string
  pick: string | null
}

// ── 체험단 ────────────────────────────────────────
// 두고애드에서 모집하므로 인원은 상품마다 다르다.
// 명단은 나중에 받으므로, 먼저 "무엇을 써달라고 할지"부터 만들어 둔다.
export interface CampaignReview {
  stars: number          // 5점만 몰리면 티가 난다. 4~5점을 섞는다
  text: string           // 리뷰 문구 — 사람마다 달라야 한다
  photo: string          // 같이 올릴 사진 (사진1, 사진2 …)
  option: string         // 어떤 옵션을 산 것으로 할지
  date?: string          // 이 사람의 작성요청날짜 — 한날에 몰리지 않게 며칠에 나눠 준다
  done?: boolean         // 전달 끝난 줄 표시
}

// 송장 — 받는 분은 두고애드에서 명단을 받아 채운다
export interface CampaignRecipient {
  name: string
  phone: string
  phone2?: string
  address: string
}

export interface PlanCampaign {
  option: string         // 기본 옵션 (줄 만들 때 채워 넣는다)
  count: number          // 이번에 모집한 인원
  requestDate: string    // 작성요청 시작 날짜 — 줄마다 날짜가 없으면 이 날로 나간다
  perDay?: number        // 하루에 몇 건씩 나눠 줄지 (기본 3)
  note: string           // 체험단에게 전할 안내
  reviews: CampaignReview[]
  // ── 송장 ──
  itemName?: string      // 품목명 (비우면 상품 이름을 쓴다)
  qty?: number           // 내품수량
  message?: string       // 배송메세지
  // 보내는 분은 농장·공급처라 매번 같다. 한 번 적어두면 계속 쓴다
  sender?: { name: string; phone: string; address: string }
  recipients?: CampaignRecipient[]
}

export interface ProductPlan {
  id: string
  category: string
  season: string[]
  status: string
  vendor: { name: string; note: string }
  coupang: {
    name: string
    category: string
    searchFilter: string
    tags: string[]
    registerId: string
    optionRows: PlanCoupangOptionRow[]
    priceMemo?: string
    optionIds?: string
  }
  options: PlanOption[]
  competitors: { weights: string[]; rows: PlanCompetitorRow[] }
  content: {
    thumbs: Record<string, PlanThumb>
    details: Record<string, string>
    // 정해진 11장 말고 더 넣고 싶은 것 (12번부터 이어진다)
    extras: PlanExtraDetail[]
    // 정해진 썸네일 5장 말고 더 넣고 싶은 컷
    thumbExtras: PlanExtraThumb[]
    // 칸마다 붙여둔 사진 주소.
    //   썸네일 고정칸 → 'main' / 'sub1' …,  추가컷 → 'tx0' (thumbExtras 0번)
    //   상세 고정칸  → 'd2' / 'd3' …,       추가장 → 'ex0' (extras 0번)
    pics: Record<string, string[]>
    badge: string
    notes: string[]
  }
  reviews: PlanReview[]
  campaign: PlanCampaign            // 체험단
  assets: { folder: string; preview: string }
  updatedAt?: string
}

// 쇼핑몰 카테고리와 같은 구성으로 맞춘다 (선물세트 포함)
export const PLAN_CATEGORIES = ['야채', '과일', '수산', '축산', '선물세트', '식품'] as const

export function emptyPlan(id: string, category = ''): ProductPlan {
  const thumbs: Record<string, PlanThumb> = {}
  THUMB_SLOTS.forEach((t) => { thumbs[t.key] = { hook: '' } })
  const details: Record<string, string> = {}
  DETAIL_SLOTS.forEach((d) => { details[d.no] = '' })
  return {
    id, category, season: [], status: '기획',
    vendor: { name: '', note: '' },
    coupang: { name: '', category: '', searchFilter: '', tags: [], registerId: '', optionRows: [] },
    options: [],
    competitors: { weights: [], rows: [1, 2, 3, 4, 5].map((rank) => ({ rank, prices: {}, title: '' })) },
    content: { thumbs, details, extras: [], thumbExtras: [], pics: {}, badge: '', notes: [] },
    reviews: [],
    campaign: { option: '', count: 30, requestDate: '', note: '', reviews: [] },
    assets: { folder: '', preview: '' },
  }
}

// ── 대표님 양식의 칸 구성 ──────────────────────────────
// 썸네일 5장 — 무엇을 쓰고 어떤 사진을 넣는지가 정해져 있다
export const THUMB_SLOTS = [
  { key: 'main', name: '메인 썸네일', guide: '경쟁사 1~5등을 보고 우리 문구를 정합니다', img: '눈에 띄는 디자인' },
  { key: 'sub1', name: '서브 썸네일 1', guide: '제품의 중요한 특징', img: '상품만 크게 잡은 사진' },
  { key: 'sub2', name: '서브 썸네일 2', guide: '제품의 산지 정보', img: '제품과 산지 정보가 함께 들어간 사진' },
  { key: 'sub3', name: '서브 썸네일 3', guide: '요리법이나 맛있게 먹는 법', img: '요리하는 사진, 맛있게 먹는 사진' },
  { key: 'sub4', name: '서브 썸네일 4', guide: '배송·포장 상태', img: '배송 포장 상태나 생물 상태 사진' },
] as const

// 상세페이지 11장 — 기본 템플릿 3장은 채우지 않아도 된다
export const DETAIL_SLOTS = [
  { no: 1, role: '배송 안내', base: true, hint: '' },
  { no: 2, role: '핵심 상품소개', base: false, hint: '이 상품을 한 줄로 말하면?' },
  { no: 3, role: '상품 추가특징', base: false, hint: '다른 곳과 뭐가 다른지' },
  { no: 4, role: '상품이 특별한 이유', base: false, hint: '등급·인증·재배 방식' },
  { no: 5, role: '산지 내용', base: false, hint: '어디서 어떻게 자랐는지' },
  { no: 6, role: '제품 영양', base: false, hint: '성분 사실만. 효능 표현은 법 위반' },
  { no: 7, role: '맛있게 먹는 법', base: false, hint: '보관법·조리법·손질법' },
  { no: 8, role: '상품옵션 및 중량안내', base: false, hint: '옵션별 실중량·구성' },
  { no: 9, role: '구매 전 안내', base: false, hint: '미리 알려야 할 것' },
  { no: 10, role: '반품·교환 안내', base: true, hint: '' },
  { no: 11, role: '카카오채널 안내', base: true, hint: '' },
] as const

// 자주 쓰는 할인율 — 고정값이 아니라 빠르게 고르라고 두는 것.
// 42%·45%처럼 그때그때 다른 값을 직접 넣으실 수 있다.
export const DISCOUNTS = [0.5, 0.45, 0.42, 0.4, 0.35, 0.3]

// 마진 계산에 쓰는 판매가 — 실제판매가가 있으면 그걸, 없으면 판매가(쿠폰적용값)를 쓴다
export function marginPriceOf(o: PlanOption): number | null {
  return o.realPrice != null ? o.realPrice : (o.price ?? null)
}

// 남는 돈 = 실제판매가 − 쿠팡수수료 − 공급가 − 택배비
export function netOf(o: PlanOption): number | null {
  const base = marginPriceOf(o)
  if (o.cost == null || !base) return null
  return Math.round(base * (1 - (o.fee ?? 0.12)) - o.cost - (o.shipping || 0))
}

// ── 테무 ──────────────────────────────────────
// 테무는 수수료가 없고, 내가 올린 값에 7.5%를 얹어 손님에게 보여준다.
export const TEMU_MARKUP = 0.075
export const TEMU_DEFAULT_MARGIN = 0.15

export function temuShippingOf(o: PlanOption): number {
  return o.temu?.shipping != null ? o.temu.shipping : (o.shipping || 0)
}

// 판매단가 = (공급가 + 배송비) ÷ (1 − 수익률), 10원 단위.
// 수익률은 쿠팡 마진율과 같은 셈법 — 판매단가에서 그만큼이 남는다.
export function temuPriceOf(o: PlanOption): number | null {
  if (o.temu?.price) return o.temu.price
  if (o.cost == null) return null
  const m = o.temu?.margin ?? TEMU_DEFAULT_MARGIN
  if (m >= 1) return null
  return Math.round((o.cost + temuShippingOf(o)) / (1 - m) / 10) * 10
}

// 손님에게 보이는 값 = 판매단가 × 1.075
export function temuShownOf(o: PlanOption): number | null {
  const p = temuPriceOf(o)
  return p == null ? null : Math.round(p * (1 + TEMU_MARKUP) / 10) * 10
}

// 남는 돈 = 판매단가 − 공급가 − 배송비 (테무 수수료 0%)
export function temuNetOf(o: PlanOption): number | null {
  const p = temuPriceOf(o)
  if (p == null || o.cost == null) return null
  return p - o.cost - temuShippingOf(o)
}

// 정상가 = 판매가 ÷ (1 − 할인율), 100원 단위
export function listPriceOf(o: PlanOption): number | null {
  if (o.price && o.discount) return Math.round(o.price / (1 - o.discount) / 100) * 100
  return o.listPrice ?? null
}

// 6단계 중 몇 단계를 채웠나 — 목록에서 진행도를 보여준다
export function doneCount(p: ProductPlan): number {
  const 문구칸 = DETAIL_SLOTS.filter((d) => !d.base).map((d) => d.no)
  return [
    !!p.content?.thumbs?.main?.hook,
    !!(p.coupang?.name && p.coupang?.tags?.length),
    (p.competitors?.rows || []).some((r) => r.title || Object.values(r.prices || {}).some((v) => v)),
    (p.options || []).some((o) => o.cost && o.price),
    문구칸.some((n) => (p.content?.details?.[n] || '').trim()),
    !!p.assets?.folder,
  ].filter(Boolean).length
}
