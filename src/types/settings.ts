export interface SiteSettings {
  companyName: string
  ceoName: string
  businessRegNo: string
  address: string
  phone: string
  // 로고 — 안 올리면 지금처럼 글자(Farmday.)가 나온다
  logoHeader?: string   // 위쪽(밝은 바탕)용
  logoFooter?: string   // 아래쪽(어두운 바탕)용
  tagline?: string      // 푸터 한 줄 소개
}
