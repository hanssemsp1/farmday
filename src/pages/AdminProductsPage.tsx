import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductsContext'
import { isAdmin } from '../lib/adminConfig'
import { createProduct, deleteProduct, updateProduct } from '../lib/products'
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
  soldOut: false,
}

export default function AdminProductsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { products, loading, refetch } = useProducts()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
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
      soldOut: p.soldOut ?? false,
    })
    setNotice('')
  }

  function cancelEdit() {
    setEditingId(null)
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
            <div className="admin-field">
              <label>썸네일 색상</label>
              <div className="thumb-picker">
                {GRADIENTS.map((g) => (
                  <button
                    type="button"
                    key={g}
                    className={`thumb-swatch ${form.thumbnail === g ? 'active' : ''}`}
                    style={{ background: g }}
                    onClick={() => setForm({ ...form, thumbnail: g })}
                    aria-label="썸네일 색상 선택"
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
          </div>

          {notice && <p className="admin-notice">{notice}</p>}

          <div className="admin-form-actions">
            <Button variant="outline" type="button" onClick={cancelEdit}>취소</Button>
            <Button type="submit" variant="accent" disabled={submitting}>
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
