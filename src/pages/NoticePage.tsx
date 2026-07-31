import { Link } from 'react-router-dom'
import { dummyPosts } from '../data/dummyPosts'
import './NoticePage.css'

export default function NoticePage() {
  const notices = dummyPosts.filter((p) => p.category === '공지')

  return (
    <div className="container notice-page">
      <h1>공지사항</h1>

      <ul className="notice-list">
        {notices.map((notice) => (
          <li key={notice.id}>
            <Link to={`/board/${notice.id}`} className="notice-row">
              <span className="notice-title">{notice.title}</span>
              <span className="notice-date">{notice.date}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
