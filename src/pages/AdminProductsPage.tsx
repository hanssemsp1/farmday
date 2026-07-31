import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductsContext'
import { isAdmin } from '../lib/adminConfig'
import { createProduct, deleteProduct, updateProduct } from '../lib/products'
import { uploadProductImage } from '../lib/storage'
import { Product } from '../types/product'
import Button from '../components/ui/Button'
import './AdminProductsPage.css'

const CATEGORIES = ['과일', '야채', '수산', '축산', '선물세트', '식품']
const GRADIENTS = [
  'linear-gradient(135deg,#4A154B,#1264A3)',
  'linear-gradient(135deg,#1264A3,#2EB67D)',
  'linear-gradient(135deg,#2EB67D,#ECB22E)',
  'linear-gradient(135deg,#ECB22E,#4A154B)',
]

const EMPTY_FORM = {
  name: '',
  brand: '',
  category: CATEGORIES[0],
  price: '',
  originalPrice: '',
  discountRate: '',
  thumbnail: GRADIENTS[0],
  description: '',
  detailImages: [] as string[],
  soldOut: false,
}

function extractUrl(thumbnail: string): string | null {
  const match = thumbnail.match(/^url\("(.+)"\) center\/cover no-repeat$/)
  return match ? match[1] : null
}

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { products, loading, refetch } = useProducts()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!authLoading && !isAdmin(user)) navigate('/')
  }, [authLoading, user, navigate])

  if (authLoading || !isAdmin(user)) return null

  function startCreate() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    setNotice('')
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: String(p.price),
      originalPrice: p.originalPrice ? String(p.originalPrice) : '',
      discountRate: p.discountRate ? String(p.discountRate) : '',
      thumbnail: p.thumbnail,
      description: p.description ?? '',
      detailImages: p.detailImages ?? [],
      soldOut: p.soldOut ?? false,
    })
    setNotice('')
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleBulkImageSelect(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return
    setUploading(true)
    setNotice('')
    const results = await Promise.all(files.map(uploadProductImage))
    setUploading(false)

    const urls = results.filter((r) => r.url).map((r) => r.url!) as string[]
    const failedCount = results.filter((r) => r.error).length
    if (failedCount > 0) setNotice(`${failedCount}개 이미지 업로드에 실패했어요.`)
    if (urls.length === 0) return

    setForm((f) => {
      const currentMain = extractUrl(f.thumbnail)
      if (!currentMain) {
        const [first, ...rest] = urls
        return { ...f, thumbnail: `url("${first}") center/cover no-repeat`, detailImages: [...f.detailImages, ...rest] }
      }
      return { ...f, detailImages: [...f.detailImages, ...urls] }
    })
  }

  function setMainPhoto(url: string) {
    setForm((f) => {
      const currentMain = extractUrl(f.thumbnail)
      const pool = new Set(f.detailImages)
      if (currentMain) pool.add(currentMain)
      pool.delete(url)
      return { ...f, thumbnail: `url("${url}") center/cover no-repeat`, detailImages: Array.from(pool) }
    })
  }

  function removePhoto(url: string) {
    setForm((f) => {
      const currentMain = extractUrl(f.thumbnail)
      if (currentMain === url) {
        const [next, ...rest] = f.detailImages
        return { ...f, thumbnail: next ? `url("${next}") center/cover no-repeat` : GRADIENTS[0], detailImages: rest }
      }
      return { ...f, detailImages: f.detailImages.filter((u) => u !== url) }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.brand.trim() || !form.price) {
      setNotice('상품명, 브랜드, 가격은 필수예요.')
      return
    }
    setSubmitting(true)
    setNotice('')

    const input: Omit<Product, 'id'> = {
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      price: Number(form.price),
      originalPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
      discountRate: form.discountRate ? Number(form.discountRate) : undefined,
      rating: 0,
      reviewCount: 0,
      thumbnail: form.thumbnail,
      description: form.description.trim() || undefined,
      detailImages: form.detailImages,
      badges: [],
      soldOut: form.soldOut,
    }

    const { error } =
      editingId === 'new' ? await createProduct(input) : await updateProduct(editingId!, input)

    setSubmitting(false)
    if (error) {
      setNotice(`저장 중 오류가 발생했어요: ${error}`)
      return
    }
    setEditingId(null)
    refetch()
  }

  async function handleDelete(id: string) {
    const { error } = await deleteProduct(id)
    if (error) {
      setNotice(`삭제 중 오류가 발생했어요: ${error}`)
      return
    }
    refetch()
  }

  return (
    <div className="container admin-products">
      <div className="admin-head">
        <h1>상품 관리 ({products.length})</h1>
        <Button variant="accent" onClick={startCreate}>새 상품 추가</Button>
      </div>

      {editingId && (
        <form className="admin-form" onSubmit={handleSubmit}>
          <h2>{editingId === 'new' ? '새 상품 추가' : '상품 수정'}</h2>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>상품명</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="admin-field">
              <label>브랜드/산지</label>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} required />
            </div>
            <div className="admin-field">
              <label>카테고리</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="admin-field admin-field-wide">
              <label>상품 사진 (썸네일 후보 + 상세 이미지 한 번에 선택)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkImageSelect}
                disabled={uploading}
              />
              <p className="admin-hint">
                사진을 여러 장 한 번에 선택하세요. 아래에서 대표로 쓸 사진을 클릭하면 메인 썸네일로 지정되고,
                나머지는 상세페이지 이미지로 자동 등록돼요.
              </p>
              {uploading && <span className="thumb-uploading">업로드 중...</span>}

              <div className="photo-grid">
                {(() => {
                  const mainUrl = extractUrl(form.thumbnail)
                  const photos = [...(mainUrl ? [mainUrl] : []), ...form.detailImages]
                  return photos.map((url) => (
                    <div key={url} className={`photo-item ${url === mainUrl ? 'is-main' : ''}`}>
                      <button type="button" onClick={() => setMainPhoto(url)} className="photo-item-img">
                        <img src={url} alt="상품 사진" />
                        {url === mainUrl && <span className="photo-main-badge">대표</span>}
                      </button>
                      <button
                        type="button"
                        className="photo-remove-btn"
                        onClick={() => removePhoto(url)}
                        aria-label="사진 삭제"
                      >
                        ×
                      </button>
                    </div>
                  ))
                })()}
              </div>

              <div className="thumb-picker">
                {GRADIENTS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    className={`thumb-swatch ${form.thumbnail === g ? 'active' : ''}`}
                    style={{ background: g }}
                    onClick={() => setForm({ ...form, thumbnail: g })}
                    aria-label="기본 색상 선택"
                  />
                ))}
              </div>
            </div>
            <div className="admin-field">
              <label>판매가(원)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>정가(원, 선택)</label>
              <input
                type="number"
                value={form.originalPrice}
                onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
              />
            </div>
            <div className="admin-field">
              <label>할인율(%, 선택)</label>
              <input
                type="number"
                value={form.discountRate}
                onChange={(e) => setForm({ ...form, discountRate: e.target.value })}
              />
            </div>
            <div className="admin-field admin-field-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={form.soldOut}
                  onChange={(e) => setForm({ ...form, soldOut: e.target.checked })}
                />
                품절 처리
              </label>
            </div>
            <div className="admin-field admin-field-wide">
              <label>상세 설명</label>
              <textarea
                rows={6}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="상품 상세페이지에 보여줄 설명을 입력하세요"
              />
            </div>
          </div>

          {notice && <p className="admin-notice">{notice}</p>}

          <div className="admin-form-actions">
            <Button variant="outline" type="button" onClick={cancelEdit}>취소</Button>
            <Button type="submit" variant="accent" disabled={submitting || uploading}>
              {submitting ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      )}

      {!loading && (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>상품명</th>
              <th>브랜드</th>
              <th>카테고리</th>
              <th>가격</th>
              <th>상태</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td><div className="admin-thumb" style={{ background: p.thumbnail }} /></td>
                <td>{p.name}</td>
                <td>{p.brand}</td>
                <td>{p.category}</td>
                <td>{p.price.toLocaleString()}원</td>
                <td>{p.soldOut ? <span className="badge badge-yellow">품절</span> : '판매중'}</td>
                <td className="admin-row-actions">
                  <button className="text-btn" onClick={() => startEdit(p)}>수정</button>
                  <button className="text-btn" onClick={() => handleDelete(p.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
