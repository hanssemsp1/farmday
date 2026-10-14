// 주소 찾기 — 카카오(다음) 우편번호 서비스(무료, 키 없음). 회원가입·장바구니 배송지가 같이 쓴다.
const POSTCODE_SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'

interface DaumAddress { zonecode: string; roadAddress: string; jibunAddress: string; buildingName: string; apartment: string }
declare global {
  interface Window {
    daum?: { Postcode: new (o: { oncomplete: (d: DaumAddress) => void }) => { open: () => void } }
  }
}

function load(): Promise<void> {
  if (window.daum?.Postcode) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = POSTCODE_SRC
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('주소 찾기를 불러오지 못했어요'))
    document.head.appendChild(s)
  })
}

/** 화면이 열릴 때 미리 불러 둔다 — 누르는 순간 바로 열려야 팝업 차단에 안 걸린다 */
export function preloadPostcode() {
  load().catch(() => { /* 누를 때 다시 시도 */ })
}

/** 주소 찾기 창을 열고, 고르면 { zipcode, address } 를 돌려준다 */
export async function findAddress(onPick: (a: { zipcode: string; address: string }) => void) {
  if (!window.daum?.Postcode) await load()
  new window.daum!.Postcode({
    oncomplete: (d) => {
      const extra = d.apartment === 'Y' && d.buildingName ? ` (${d.buildingName})` : ''
      onPick({ zipcode: d.zonecode, address: (d.roadAddress || d.jibunAddress) + extra })
    },
  }).open()
}
