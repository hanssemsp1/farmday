import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSiteSettings } from '../context/SiteSettingsContext'
import { isAdmin } from '../lib/adminConfig'
import { updateSiteSettings } from '../lib/settings'
import Button from '../components/ui/Button'
import './AdminProductsPage.css'

export default function AdminSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const { settings, loading, refetch } = useSiteSettings()
  const [form, setForm] = useState({ companyName: '', ceoName: '', businessRegNo: '', address: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!authLoading && !isAdmin(user)) navigate('/')
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  if (authLoading || !isAdmin(user)) return null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setNotice('')
    const { error } = await updateSiteSettings(form)
    setSubmitting(false)
    if (error) {
      setNotice(`저장 중 오류가 발생했어요: ${error}`)
      return
    }
    setNotice('저장됐어요.')
    refetch()
  }

  return (
    <div className="container admin-products">
      <div className="admin-head">
        <h1>사이트 설정</h1>
      </div>

      {!loading && (
        <form className="admin-form" onSubmit={handleSubmit}>
          <h2>회사 정보 (푸터에 표시돼요)</h2>

          <div className="admin-form-grid">
            <div className="admin-field">
              <label>상호명</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>대표자명</label>
              <input value={form.ceoName} onChange={(e) => setForm({ ...form, ceoName: e.target.value })} required />
            </div>
            <div className="admin-field">
              <label>사업자등록번호</label>
              <input
                value={form.businessRegNo}
                onChange={(e) => setForm({ ...form, businessRegNo: e.target.value })}
                required
              />
            </div>
            <div className="admin-field">
              <label>고객센터 전화번호</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <div className="admin-field admin-field-wide">
              <label>주소</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
          </div>

          {notice && <p className="admin-notice">{notice}</p>}

          <div className="admin-form-actions">
            <Button type="submit" variant="accent" disabled={submitting}>
              {submitting ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
