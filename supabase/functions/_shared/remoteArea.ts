// 제주·도서산간 판정 — 대표님 결정(26.10.14): 이 지역은 주문을 받지 않는다(추가 배송비 장치 없음 + 산지 직송).
// 장바구니(브라우저)와 결제 승인(Edge Function)이 같은 표를 쓴다. 아무것도 import 하지 않는다.
// 출처: 쇼핑몰 공용 「제주도 및 도서산간 지역 기준표」(docs.channel.io campaignus) — 제주·울릉은 CJ대한통운 도선료 안내와 일치.
// 표의 「신안 섬지역3 28826」은 앞뒤가 모두 588xx 라 58826 의 오타로 보고 58826 으로 적었다.
// 택배사마다 범위가 조금씩 다르다 — 공급처(파밍·최고집)가 다른 섬을 알려 오면 여기에 더한다.

export const REMOTE_AREAS: { name: string; from: number; to: number }[] = [
  { name: '제주도', from: 63000, to: 63644 },
  { name: '인천 중구 섬지역', from: 22386, to: 22388 },
  { name: '인천 강화 섬지역', from: 23004, to: 23010 },
  { name: '인천 옹진 섬지역', from: 23100, to: 23116 },
  { name: '인천 옹진 섬지역', from: 23124, to: 23136 },
  { name: '충남 당진 섬지역', from: 31708, to: 31708 },
  { name: '충남 태안 섬지역', from: 32133, to: 32133 },
  { name: '충남 보령 섬지역', from: 33411, to: 33411 },
  { name: '경북 울릉도', from: 40200, to: 40240 },
  { name: '부산 강서구 섬지역', from: 46768, to: 46771 },
  { name: '경남 사천 섬지역', from: 52570, to: 52571 },
  { name: '경남 통영 섬지역', from: 53031, to: 53033 },
  { name: '경남 통영 섬지역', from: 53089, to: 53104 },
  { name: '경남 통영 섬지역', from: 54000, to: 54000 },
  { name: '전북 부안 섬지역', from: 56347, to: 56349 },
  { name: '전남 영광 섬지역', from: 57068, to: 57069 },
  { name: '전남 목포 섬지역', from: 58760, to: 58762 },
  { name: '전남 신안 섬지역', from: 58800, to: 58810 },
  { name: '전남 신안 섬지역', from: 58816, to: 58818 },
  { name: '전남 신안 섬지역', from: 58826, to: 58826 },
  { name: '전남 신안 섬지역', from: 58828, to: 58866 },
  { name: '전남 진도 섬지역', from: 58953, to: 58958 },
  { name: '전남 완도 섬지역', from: 59102, to: 59103 },
  { name: '전남 완도 섬지역', from: 59106, to: 59106 },
  { name: '전남 완도 섬지역', from: 59127, to: 59127 },
  { name: '전남 완도 섬지역', from: 59129, to: 59129 },
  { name: '전남 완도 섬지역', from: 59137, to: 59166 },
  { name: '전남 여수 섬지역', from: 59650, to: 59650 },
  { name: '전남 여수 섬지역', from: 59766, to: 59766 },
  { name: '전남 여수 섬지역', from: 59781, to: 59790 },
]

export const REMOTE_AREA_MESSAGE = '제주·도서산간 지역은 산지에서 배송이 어려워 주문을 받지 않아요.'

/** 5자리 우편번호가 제주·도서산간이면 그 지역 이름, 아니면 null */
export function remoteAreaOf(zipcode: string | null | undefined): string | null {
  const z = Number(String(zipcode ?? '').replace(/\D/g, ''))
  if (!z || String(zipcode ?? '').replace(/\D/g, '').length !== 5) return null
  const hit = REMOTE_AREAS.find((a) => z >= a.from && z <= a.to)
  return hit ? hit.name : null
}
