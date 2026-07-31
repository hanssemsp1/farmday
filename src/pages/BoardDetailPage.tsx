import { FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { dummyPosts } from '../data/dummyPosts'
import { fetchPostById, deletePost } from '../lib/posts'
import { DbPost } from '../types/post'
import './BoardDetailPage.css'

interface Comment {
  id: number
  author: string
  content: string
}

export default function BoardDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const noticePost = dummyPosts.find((p) => p.id === Number(id) && p.category === '공지')

  const [dbPost, setDbPost] = useState<DbPost | null>(null)
  const [loading, setLoading] = useState(!noticePost)
  const [notFound, setNotFound] = useState(false)

  const [comments, setComments] = useState<Comment[]>([
    { id: 1, author: '오늘의식탁', content: '저도 이거 궁금했는데 공감이요!' },
    { id: 2, author: '냉파요정', content: '좋은 정보 감사합니다 🙌' },
  ])
  const [commentInput, setCommentInput] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (noticePost || !id) return
    fetchPostById(id).then(({ data }) => {
      setDbPost(data)
      setNotFound(!data)
      setLoading(false)
    })
  }, [id, noticePost])

  function handleAddComment(e: FormEvent) {
    e.preventDefault()
    if (!commentInput.trim()) return
    setComments((prev) => [...prev, { id: prev.length + 1, author: '나', content: commentInput.trim() }])
    setCommentInput('')
  }

  function handleEdit() {
    setNotice('수정 기능은 준비 중이에요.')
  }

  async function handleDelete() {
    if (!dbPost) return
    const { error } = await deletePost(dbPost.id)
    if (error) {
      setNotice(`삭제 중 오류가 발생했어요: ${error}`)
      return
    }
    navigate('/board')
  }

  if (loading) return null

  if (noticePost) {
    return (
      <div className="container board-detail">
        <div className="board-detail-head">
          <span className="badge badge-accent">{noticePost.category}</span>
          <h1>{noticePost.title}</h1>
          <div className="board-detail-meta">
            <span>{noticePost.author}</span>
            <span>{noticePost.date}</span>
            <span>조회 {noticePost.views.toLocaleString()}</span>
          </div>
        </div>
        <div className="board-detail-content">
          {noticePost.content.split('\n').map((line, i) => (
            <p key={i}>{line || ' '}</p>
          ))}
        </div>
        <div className="board-detail-actions">
          <div />
          <Button variant="outline" onClick={() => navigate('/notice')}>목록으로</Button>
        </div>
      </div>
    )
  }

  if (notFound || !dbPost) {
    return (
      <div className="container board-detail">
        <p className="board-empty">존재하지 않는 게시글이에요.</p>
        <Link to="/board">
          <Button variant="outline">목록으로</Button>
        </Link>
      </div>
    )
  }

  const isAuthor = user?.id === dbPost.author_id

  return (
    <div className="container board-detail">
      <div className="board-detail-head">
        <span className={`badge badge-${dbPost.category === '후기' ? 'green' : 'yellow'}`}>
          {dbPost.category}
        </span>
        <h1>{dbPost.title}</h1>
        <div className="board-detail-meta">
          <span>{dbPost.author_name}</span>
          <span>{new Date(dbPost.created_at).toLocaleDateString('ko-KR')}</span>
          <span>조회 {dbPost.views.toLocaleString()}</span>
        </div>
      </div>

      <div className="board-detail-content">
        {dbPost.content.split('\n').map((line, i) => (
          <p key={i}>{line || ' '}</p>
        ))}
      </div>

      {notice && <p className="board-demo-note">{notice}</p>}

      <div className="board-detail-actions">
        <div>
          {isAuthor && (
            <>
              <button className="text-btn" onClick={handleEdit}>수정</button>
              <button className="text-btn" onClick={handleDelete}>삭제</button>
            </>
          )}
        </div>
        <Button variant="outline" onClick={() => navigate('/board')}>목록으로</Button>
      </div>

      <div className="board-comments">
        <h2>댓글 {comments.length}</h2>
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <span className="comment-author">{c.author}</span>
              <p className="comment-content">{c.content}</p>
            </li>
          ))}
        </ul>
        <form className="comment-form" onSubmit={handleAddComment}>
          <input
            type="text"
            placeholder="댓글을 남겨보세요"
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
          />
          <Button type="submit" size="sm">등록</Button>
        </form>
      </div>
    </div>
  )
}
