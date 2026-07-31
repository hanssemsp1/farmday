import { Post } from '../types/post'

const TITLES: { category: Post['category']; title: string }[] = [
  { category: '공지', title: '팜데이 여름 정기휴무 안내 (8/15 배송 없음)' },
  { category: '공지', title: '신선식품 배송 지연 관련 안내드립니다' },
  { category: '후기', title: '거봉 포도 정말 달고 알이 커요!' },
  { category: '자유', title: '고구마 요리하기 좋은 레시피 있을까요?' },
  { category: '후기', title: '전복 손질까지 되어있어서 편했어요' },
  { category: '자유', title: '오늘 장바구니 인증합니다 🍅' },
  { category: '후기', title: '한우 등심 선물세트 받으신 분 계신가요' },
  { category: '자유', title: '냉장고 파먹기 챌린지 같이 하실 분' },
  { category: '공지', title: '추석 선물세트 사전예약 오픈 안내' },
  { category: '후기', title: '깻잎 김치 진짜 손맛 나요 재구매 확정' },
  { category: '자유', title: '흑염소진액 드셔보신 분 효과 어떤가요' },
  { category: '후기', title: '광어회 신선도 최고였습니다' },
  { category: '자유', title: '이번 주 특가 상품 뭐가 좋을까요' },
  { category: '공지', title: '고객센터 운영시간 변경 안내' },
  { category: '후기', title: '당근이 진짜 흙당근이라 향이 다르네요' },
  { category: '자유', title: '대게 찜하는 법 공유해요' },
  { category: '후기', title: '선물세트 포장 꼼꼼해서 만족했어요' },
  { category: '자유', title: '고춧가루 김장용으로 얼마나 필요할까요' },
  { category: '공지', title: '개인정보처리방침 개정 안내' },
  { category: '후기', title: '털복숭아 향이 진해서 놀랐어요' },
  { category: '자유', title: '오늘 저녁 메뉴 추천 받습니다' },
  { category: '후기', title: '재구매 의사 100%입니다' },
  { category: '자유', title: '팜데이 회원 등급 혜택 궁금해요' },
]

export const dummyPosts: Post[] = TITLES.map((t, i) => ({
  id: TITLES.length - i,
  category: t.category,
  title: t.title,
  author: ['팜데이지기', '오늘의식탁', '냉파요정', '건강한밥상', '제철러버'][i % 5],
  date: `2026.07.${String(28 - (i % 27)).padStart(2, '0')}`,
  views: 34 + i * 17,
  content:
    '안녕하세요, 팜데이 게시판입니다.\n\n이 글은 데모용 더미 콘텐츠예요. 실제 게시판 기능은 백엔드(DB) 연동 후 글 작성·수정·삭제가 저장됩니다.\n\n신선한 상품과 함께 즐거운 하루 되세요!',
}))
