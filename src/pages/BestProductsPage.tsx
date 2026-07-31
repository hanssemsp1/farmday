import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductGrid from '../components/product/ProductGrid'
import Icon from '../components/ui/Icon'
import { useProducts } from '../context/ProductsContext'
import './BestProductsPage.css'

const SORT_OPTIONS = [
  { value: 'popular', label: '인기순' },
  { value: 'new', label: '신상품순' },
  { value: 'price-asc', label: '낮은 가격순' },
  { value: 'price-desc', label: '높은 가격순' },
] as const

type SortValue = (typeof SORT_OPTIONS)[number]['value']

export default function BestProductsPage() {
  const { products: allProducts } = useProducts()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sort, setSort] = useState<SortValue>('popular')
  const [keyword, setKeyword] = useState(() => searchParams.get('q') ?? '')

  const category = searchParams.get('category') ?? ''

  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setKeyword(q)
  }, [searchParams])

  const products = useMemo(() => {
    let list = allProducts.filter((p) => {
      const matchesKeyword = keyword.trim()
        ? p.name.includes(keyword.trim()) || p.brand.includes(keyword.trim())
        : true
      const matchesCategory = category ? p.category === category : true
      return matchesKeyword && matchesCategory
    })
    list = [...list]
    if (sort === 'price-asc') list.sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list.sort((a, b) => b.price - a.price)
    if (sort === 'new') list.sort((a, b) => (b.badges?.includes('new') ? 1 : 0) - (a.badges?.includes('new') ? 1 : 0))
    return list
  }, [sort, keyword, category, allProducts])

  function clearCategory() {
    const next = new URLSearchParams(searchParams)
    next.delete('category')
    setSearchParams(next)
  }

  return (
    <div className="best-page">
      <section className="hero">
        <div className="container hero-inner">
          <p className="hero-eyebrow">2026 SUMMER BEST</p>
          <h1>
            지금 가장 많이 찾는
            <br />
            팜데이 베스트 상품
          </h1>
          <p className="hero-desc">최대 30% 할인 · 무료배송 · 오늘 발송</p>
        </div>
      </section>

      <section className="container filter-bar">
        <div className="filter-search">
          <Icon name="search" className="icon-sm" />
          <input
            type="text"
            placeholder="베스트 상품 안에서 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <div className="sort-tabs">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`sort-tab ${sort === opt.value ? 'active' : ''}`}
              onClick={() => setSort(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {category && (
        <section className="container active-filters">
          <button className="filter-chip" onClick={clearCategory}>
            {category}
            <span className="filter-chip-close">×</span>
          </button>
        </section>
      )}

      <section className="container products-section">
        <div className="products-meta">
          총 <strong>{products.length}</strong>개 상품
        </div>
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <div className="empty-state">검색 결과가 없어요.</div>
        )}
      </section>
    </div>
  )
}
