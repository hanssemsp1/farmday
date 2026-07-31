import './PointsPage.css'

interface PointHistory {
  id: string
  date: string
  label: string
  amount: number
}

const HISTORY: PointHistory[] = [
  { id: 'p1', date: '2026.07.25', label: '거봉 포도(특품) 구매 적립', amount: 120 },
  { id: 'p2', date: '2026.07.18', label: '한우 등심 구매 적립', amount: 330 },
  { id: 'p3', date: '2026.07.10', label: '리뷰 작성 적립', amount: 500 },
  { id: 'p4', date: '2026.07.02', label: '해남 꿀고구마 구매 사용', amount: -1000 },
  { id: 'p5', date: '2026.06.22', label: '전복 손질 구매 적립', amount: 260 },
  { id: 'p6', date: '2026.06.09', label: '신규가입 축하 적립', amount: 3000 },
]

const BALANCE = HISTORY.reduce((sum, h) => sum + h.amount, 0)

export default function PointsPage() {
  return (
    <div className="container points-page">
      <h1>적립금</h1>

      <div className="points-balance-card">
        <p className="points-balance-label">사용 가능한 적립금</p>
        <p className="points-balance-value">{BALANCE.toLocaleString()}P</p>
      </div>

      <h2 className="points-history-title">적립·사용 내역</h2>
      <div className="points-history-list">
        {HISTORY.map((h) => (
          <div key={h.id} className="points-history-row">
            <div>
              <p className="points-history-label">{h.label}</p>
              <p className="points-history-date">{h.date}</p>
            </div>
            <span className={`points-amount ${h.amount > 0 ? 'positive' : 'negative'}`}>
              {h.amount > 0 ? '+' : ''}
              {h.amount.toLocaleString()}P
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
