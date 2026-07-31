import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { createPost } from '../lib/posts'
import { DbPost } from '../types/post'
import './BoardWritePage.css'

const CATEGORIES: DbPost['category'][] = ['자유', '후기']

export default function BoardWritePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [category, setCategory] = useState<DbPost['category']>('자유')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) {
      navigate('/login')
      return
    }
    if (!title.trim() || !content.trim()) {
      setNotice('제목과 내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setNotice('')
    const authorName = (user.user_metadata?.name as string | undefined) || user.email?.split('@')[0] || '회원'
    const { data, error } = await createPost(category, title.trim(), content.trim(), authorName)
    setSubmitting(false)
    if (error || !data) {
      setNotice(`등록 중 오류가 발생했어요: ${error}`)
      return
    }
    navigate(`/board/${data.id}`)
  }

  return (
    <div className="container board-write">
      <h1>글쓰기</h1>

      <form className="board-write-form" onSubmit={handleSubmit}>
        <div className="category-tabs">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              className={`category-tab ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <input
          type="text"
          className="write-title"
          placeholder="제목을 입력하세요"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="write-content"
          placeholder="내용을 입력하세요"
          rows={12}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {notice && <p className="board-demo-note">{notice}</p>}

        <div className="write-actions">
          <Button variant="outline" type="button" onClick={() => navigate('/board')}>취소</Button>
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? '등록 중...' : '등록'}
          </Button>
        </div>
      </form>
    </div>
  )
}
