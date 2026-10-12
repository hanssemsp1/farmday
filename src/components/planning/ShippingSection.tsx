import { useState } from 'react'
import * as XLSX from 'xlsx'
import type { ProductPlan, CampaignRecipient } from '../../types/productPlan'

// 송장 — 두고애드에서 받은 명단을 붙여넣고, 대표님 송장양식 그대로 내려받는다.
// 보내는 분(농장·공급처)은 매번 같으므로 한 번 적어두면 계속 쓰인다.
export default function ShippingSection({
  plan, edit,
}: {
  plan: ProductPlan
  edit: (fn: (d: ProductPlan) => void) => void
}) {
  const c = plan.campaign || ({} as ProductPlan['campaign'])
  const list = c.recipients || []
  const sender = c.sender || { name: '', phone: '', address: '' }
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')

  const setC = (patch: Partial<ProductPlan['campaign']>) =>
    edit((d) => { d.campaign = { ...d.campaign, ...patch } })
  const setSender = (patch: Partial<typeof sender>) =>
    edit((d) => { d.campaign.sender = { ...(d.campaign.sender || { name: '', phone: '', address: '' }), ...patch } })
  const setRow = (i: number, patch: Partial<CampaignRecipient>) =>
    edit((d) => { d.campaign.recipients![i] = { ...d.campaign.recipients![i], ...patch } })
  const delRow = (i: number) =>
    edit((d) => { d.campaign.recipients!.splice(i, 1) })

  // 붙여넣은 명단을 줄 단위로 읽는다.
  // 엑셀에서 복사하면 탭으로, 그 외에는 쉼표로 나뉜다.
  // 전화번호는 숫자 모양으로 찾아내고, 가장 긴 조각을 주소로 본다 — 순서가 달라도 웬만하면 맞는다.
  function applyPaste() {
    const lines = paste.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) { setMsg('붙여넣은 내용이 없어요.'); return }
    const rows: CampaignRecipient[] = []
    for (const line of lines) {
      const cells = line.split(/\t|,/).map((s) => s.trim()).filter(Boolean)
      if (!cells.length) continue
      // 머리글 줄은 건너뛴다
      if (/받는|성명|이름|전화|주소/.test(cells.join('')) && rows.length === 0 && cells.length >= 2 && !/\d{2,}/.test(cells.join(''))) continue

      const phones = cells.filter((s) => /^[\d\-+() ]{9,}$/.test(s))
      const rest = cells.filter((s) => !phones.includes(s))
      const address = rest.slice().sort((a, b) => b.length - a.length)[0] || ''
      const name = rest.find((s) => s !== address) || ''
      rows.push({
        name,
        phone: phones[0] || '',
        phone2: phones[1] || '',
        address,
      })
    }
    if (!rows.length) { setMsg('읽어낸 줄이 없어요. 이름·전화·주소가 한 줄에 있어야 해요.'); return }
    edit((d) => { d.campaign.recipients = [...(d.campaign.recipients || []), ...rows] })
    setPaste('')
    setMsg(`${rows.length}명을 넣었어요. 잘못 들어간 곳은 표에서 고치시면 됩니다.`)
  }

  // 대표님 송장양식 그대로 내려받기
  function download() {
    const head = ['품목명', '내품수량', '받는분성명', '받는분전화번호', '받는분기타연락처',
      '받는분주소(전체, 분할)', '보내는분성명', '보내는분전화번호', '보내는분주소(전체, 분할)', '배송메세지1']
    const body = list.map((r) => [
      c.itemName || plan.id,
      c.qty ?? 1,
      r.name, r.phone, r.phone2 || '', r.address,
      sender.name, sender.phone, sender.address,
      c.message || '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([head, ...body])
    ws['!cols'] = [{ wch: 26 }, { wch: 9 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
      { wch: 44 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '송장')
    XLSX.writeFile(wb, `송장양식_${plan.id}.xlsx`)
  }

  // 빠진 곳이 있으면 미리 알려준다 — 송장은 하나만 비어도 배송이 막힌다
  const bad = list.filter((r) => !r.name || !r.phone || !r.address).length
  const senderMissing = !sender.name || !sender.phone || !sender.address

  return (
    <>
      <div className="xl-head"><span>📦</span>송장 <span className="cnt">{list.length}명</span></div>

      <table className="xl">
        <tbody>
          <tr>
            <th className="rowhead">품목명</th>
            <td className="fill"><input value={c.itemName || ''} placeholder={plan.id}
              onChange={(e) => setC({ itemName: e.target.value })} /></td>
          </tr>
          <tr>
            <th className="rowhead">내품수량 · 배송메세지</th>
            <td className="fill campset">
              <input type="number" min={1} value={c.qty ?? 1}
                onChange={(e) => setC({ qty: Number(e.target.value) })} />
              <input style={{ flex: 1 }} value={c.message || ''} placeholder="예: 체험단 발송"
                onChange={(e) => setC({ message: e.target.value })} />
            </td>
          </tr>
          <tr>
            <th className="rowhead">보내는 분</th>
            <td className="fill campset">
              <input style={{ flex: '0 0 130px' }} value={sender.name} placeholder="상호명·성함"
                onChange={(e) => setSender({ name: e.target.value })} />
              <input style={{ flex: '0 0 150px' }} value={sender.phone} placeholder="전화번호"
                onChange={(e) => setSender({ phone: e.target.value })} />
              <input style={{ flex: 1 }} value={sender.address} placeholder="농장·사장님 주소"
                onChange={(e) => setSender({ address: e.target.value })} />
            </td>
          </tr>
        </tbody>
      </table>

      {senderMissing && list.length > 0 && (
        <div className="xl-warn"><div><b>보내는 분이 비어 있어요</b> — 상호명·전화·주소를 채워야 송장이 나갑니다.</div></div>
      )}

      {/* 명단 붙여넣기 */}
      <div className="ship-paste">
        <textarea rows={3} value={paste} onChange={(e) => setPaste(e.target.value)}
          placeholder={'두고애드에서 받은 명단을 그대로 붙여넣으세요 (한 줄에 한 명)\n예: 홍길동  010-1234-5678  서울시 강남구 …'} />
        <div className="ship-paste-act">
          <button className="campmake" onClick={applyPaste}>붙여넣은 명단 넣기</button>
          {msg && <span className="hintx">{msg}</span>}
        </div>
      </div>

      {bad > 0 && (
        <div className="xl-warn">
          <div className="amber"><b>빠진 곳이 있어요</b> — {bad}명의 이름·전화·주소 중 비어 있는 칸이 있습니다.</div>
        </div>
      )}

      {list.length > 0 && (
        <div className="xl-scroll">
          <table className="xl grid ship">
            <thead><tr>
              <th className="w1">NO</th><th className="wname">받는분</th><th className="wphone">전화번호</th>
              <th className="wphone">기타연락처</th><th className="l">주소</th><th className="w1" />
            </tr></thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={i} className={!r.name || !r.phone || !r.address ? 'thin' : ''}>
                  <td className="w1 no">{i + 1}</td>
                  <td className="wname"><input value={r.name} placeholder="성함"
                    onChange={(e) => setRow(i, { name: e.target.value })} /></td>
                  <td className="wphone"><input value={r.phone} placeholder="010-"
                    onChange={(e) => setRow(i, { phone: e.target.value })} /></td>
                  <td className="wphone"><input value={r.phone2 || ''}
                    onChange={(e) => setRow(i, { phone2: e.target.value })} /></td>
                  <td className="l"><input value={r.address} placeholder="주소"
                    onChange={(e) => setRow(i, { address: e.target.value })} /></td>
                  <td className="w1"><button className="x" title="이 줄 지우기" onClick={() => delRow(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="camp-actions">
        <button className="xl-add" onClick={() => edit((d) => {
          d.campaign.recipients = [...(d.campaign.recipients || []), { name: '', phone: '', address: '' }]
        })}>＋ 한 줄 추가</button>
        {list.length > 0 && (
          <button className="camp-dl" onClick={download}>⬇ 송장양식 내려받기 (.xlsx)</button>
        )}
      </div>
    </>
  )
}
