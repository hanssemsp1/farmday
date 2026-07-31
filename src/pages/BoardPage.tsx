import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/ui/Icon'
import Button from '../components/ui/Button'
import { fetchPosts } from '../lib/posts'
import { DbPost } from '../types/post'
import './BoardPage.css'

const PAGE_SIZE = 10

export default function BoardPage() {
  const [posts, setPosts] = useState<DbPost[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetchPosts().then(({ data }) => {
      setPosts(data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(
    () => posts.filter((p) => (keyword.trim() ? p.title.includes(keyword.trim()) : true)),
    [posts, keyword],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagePosts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function handleSearch(value: string) {
    setKeyword(value)
    setPage(1)
  }

  return (
    <div className="container board-page">
      <div className="board-head">
        <h1>게시판</h1>
        <Link to="/board/write">
          <Button variant="accent">글쓰기</Button>
        </Link>
      </div>

      <div className="board-search">
        <Icon name="search" className="icon-sm" />
        <input
          type="text"
          placeholder="제목으로 검색"
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      <table className="board-table">
        <thead>
          <tr>
            <th className="col-category">분류</th>
            <th className="col-title">제목</th>
            <th className="col-author">작성자</th>
            <th className="col-date">작성일</th>
            <th className="col-views">조회</th>
          </tr>
        </thead>
        <tbody>
          {!loading && pagePosts.length === 0 && (
            <tr>
              <td colSpan={5} className="board-empty">
                {posts.length === 0 ? '아직 등록된 글이 없어요. 첫 글을 남겨보세요!' : '검색 결과가 없어요.'}
              </td>
            </tr>
          )}
          {pagePosts.map((post) => (
            <tr key={post.id}>
              <td className="col-category">
                <span className={`badge badge-${post.category === '후기' ? 'green' : 'yellow'}`}>
                  {post.category}
                </span>
              </td>
              <td className="col-title">
                <Link to={`/board/${post.id}`} className="board-title-link">{post.title}</Link>
              </td>
              <td className="col-author">{post.author_name}</td>
              <td className="col-date">{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
              <td className="col-views">{post.views.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="board-pagination">
          <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="이전 페이지">
            <Icon name="chevron-right" className="icon-sm rotate-180" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              className={p === currentPage ? 'active' : ''}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setPage(currentPage + 1)}
            aria-label="다음 페이지"
          >
            <Icon name="chevron-right" className="icon-sm" />
          </button>
        </div>
      )}
    </div>
  )
}
