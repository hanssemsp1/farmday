import HeroBanner from '../components/home/HeroBanner'
import QuickCategories from '../components/home/QuickCategories'
import PromoBanner from '../components/home/PromoBanner'
import ProductSection from '../components/home/ProductSection'
import { useProducts } from '../context/ProductsContext'

export default function HomePage() {
  const { products } = useProducts()
  const newArrivals = [...products].reverse().slice(0, 4)
  const bestPicks = products.slice(0, 4)

  return (
    <div>
      <HeroBanner />
      <QuickCategories />
      <PromoBanner />
      <ProductSection
        title="지금 뜨는 신상품"
        subtitle="따끈따끈 새로 나온 아이템"
        products={newArrivals}
        moreTo="/best"
      />
      <ProductSection
        title="베스트 상품"
        subtitle="지금 가장 많이 찾는 팜데이 인기템"
        products={bestPicks}
        moreTo="/best"
      />
    </div>
  )
}
