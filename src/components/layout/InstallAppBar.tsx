import { useEffect, useState } from 'react'
import './InstallAppBar.css'

// 휴대폰으로 사이트에 들어온 손님에게 「앱 설치」 띠를 맨 위에 한 줄 보여 준다.
// - 안드로이드(크롬·삼성 인터넷): 브라우저가 주는 설치 창을 그대로 띄운다.
// - 아이폰(사파리): 설치 창이 없어서 「공유 → 홈 화면에 추가」 방법을 보여 준다.
// - 이미 앱으로 열었거나, 컴퓨터이거나, 닫기를 누른 지 14일이 안 됐으면 안 보인다.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const HIDE_KEY = 'farmday-install-hidden-until'
const HIDE_DAYS = 14

function hiddenByUser() {
  try { return Number(localStorage.getItem(HIDE_KEY) || 0) > Date.now() } catch { return false }
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isPhone() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

export default function InstallAppBar() {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [iosGuide, setIosGuide] = useState(false)
  const [closed, setClosed] = useState(() => hiddenByUser() || isStandalone())

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const onInstalled = () => setClosed(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ios = isIos()
  if (closed || !isPhone() || (!evt && !ios)) return null

  function hide() {
    try { localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 864e5)) } catch { /* 저장 못 해도 이번엔 닫는다 */ }
    setClosed(true)
  }

  async function install() {
    if (evt) {
      await evt.prompt()
      const { outcome } = await evt.userChoice
      setEvt(null)
      if (outcome === 'accepted') setClosed(true)
    } else {
      setIosGuide(true)
    }
  }

  return (
    <div className="install-bar" role="region" aria-label="앱 설치 안내">
      <img src="/icons/icon-192.png" alt="" className="install-bar-icon" />
      <div className="install-bar-text">
        <strong>팜데이 앱</strong>
        <span>바탕화면에서 바로 열기</span>
      </div>
      <button type="button" className="install-bar-btn" onClick={install}>설치</button>
      <button type="button" className="install-bar-close" onClick={hide} aria-label="닫기">×</button>

      {iosGuide && (
        <div className="install-guide" role="dialog" aria-label="아이폰 설치 방법" onClick={() => setIosGuide(false)}>
          <div className="install-guide-box" onClick={(e) => e.stopPropagation()}>
            <strong>아이폰에 팜데이 앱 설치</strong>
            <ol>
              <li>사파리 아래쪽 <b>공유 버튼</b>(네모에 위 화살표)을 누릅니다</li>
              <li><b>「홈 화면에 추가」</b>를 누릅니다</li>
              <li>오른쪽 위 <b>「추가」</b>를 누르면 바탕화면에 팜데이가 생깁니다</li>
            </ol>
            <button type="button" className="install-bar-btn" onClick={() => setIosGuide(false)}>알겠어요</button>
          </div>
        </div>
      )}
    </div>
  )
}
