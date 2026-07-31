import { Product } from '../types/product'

const GRADIENTS = [
  'linear-gradient(135deg,#4A154B,#1264A3)',
  'linear-gradient(135deg,#1264A3,#2EB67D)',
  'linear-gradient(135deg,#2EB67D,#ECB22E)',
  'linear-gradient(135deg,#ECB22E,#4A154B)',
  'linear-gradient(135deg,#4A154B,#ECB22E)',
  'linear-gradient(135deg,#1264A3,#4A154B)',
]

const ITEMS: { name: string; brand: string; category: string }[] = [
  { name: '거봉 포도(특품) 2kg', brand: '상주 과일농원', category: '과일' },
  { name: '딱딱한 털복숭아 4kg', brand: '청도 과수원', category: '과일' },
  { name: '해남 꿀고구마 5kg', brand: '해남 농협', category: '야채' },
  { name: '흙당근 3kg', brand: '제주 당근마을', category: '야채' },
  { name: '손질 전복(특대) 10미', brand: '완도 바다마을수산', category: '수산' },
  { name: '자연산 광어회 (2인분)', brand: '제주 수산직송', category: '수산' },
  { name: '한우 등심 1++ 500g', brand: '횡성한우협동조합', category: '축산' },
  { name: '흑염소 진액 30포', brand: '지리산 흑염소농장', category: '축산' },
  { name: '농산물 선물세트 5호', brand: '팜데이푸드', category: '선물세트' },
  { name: '수산 선물세트 3호', brand: '팜데이푸드', category: '선물세트' },
  { name: '전라도 깻잎 김치 1kg', brand: '해남 김치공방', category: '식품' },
  { name: '국내산 고춧가루 1kg', brand: '영양 고추마을', category: '식품' },
]

export const dummyProducts: Product[] = ITEMS.map((item, i) => {
  const price = 12000 + i * 3500
  const hasDiscount = i % 3 !== 2
  const discountRate = hasDiscount ? 10 + (i % 4) * 5 : 0
  const originalPrice = hasDiscount ? Math.round((price / (1 - discountRate / 100)) / 100) * 100 : undefined
  const badges: Product['badges'] = []
  if (i < 4) badges.push('best')
  if (i % 5 === 0) badges.push('new')
  if (hasDiscount) badges.push('sale')

  return {
    id: `p${i + 1}`,
    name: item.name,
    brand: item.brand,
    category: item.category,
    price,
    originalPrice,
    discountRate: hasDiscount ? discountRate : undefined,
    rating: Math.round((3.8 + (i % 5) * 0.25) * 10) / 10,
    reviewCount: 120 + i * 47,
    thumbnail: GRADIENTS[i % GRADIENTS.length],
    badges,
    soldOut: i === 9,
  }
})
