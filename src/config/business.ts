// 팜데이 사업자 정보 — 전자상거래법 제10조제1항(사업자 신원 표시)에 따라 모든 화면 하단에 보여 준다.
// 관리자 화면(site_settings)에 값이 있으면 그 값을 쓰고, 불러오는 중이거나 실패해도 견본이 아니라 이 실제 값이 나온다.
export const BUSINESS = {
  companyName: '팜데이',
  ceoName: '서현주',
  businessRegNo: '604-28-94890',
  mailOrderNo: '제 2026-인천강화-0121 호',
  address: '인천광역시 강화군 화도면 해안남로 2898-2',
  phone: '010-4275-4966',
  email: 'farmfarmday@naver.com',
  hosting: 'Vercel Inc.',
  privacyOfficer: '서현주',
  kakaoChannel: 'https://pf.kakao.com/_nxdMwX',
  ftcBizInfo: 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6042894890',
}

// 사이트 결제를 열지 여부. 토스 실결제 키·주문 배송지 칸·서버 결제 승인이 갖춰지기 전까지 false.
// false면 장바구니의 주문 버튼이 카카오채널 주문 안내로 바뀐다.
export const ORDERS_OPEN = false
