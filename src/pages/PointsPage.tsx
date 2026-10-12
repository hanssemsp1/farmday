import './PointsPage.css'

interface PointHistory {
  id: string
  date: string
  label: string
  amount: number
}

// 적립금 기능은 아직 없다 — 예시 내역을 보여주면 회원마다 가짜 적립이 보이므로 비워 둔다
const HISTORY: PointHistory[] = []

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
      {HISTORY.length === 0 && <p className="points-history-date">아직 적립·사용 내역이 없어요.</p>}
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
