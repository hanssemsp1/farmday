import { useLayoutEffect, type RefObject } from 'react'

/**
 * 글 칸(textarea)이 내용만큼 저절로 늘어나게 한다 — 높이 상한 없음.
 * 글이 바뀔 때뿐 아니라 칸의 폭이 바뀔 때(창 크기·확대·분할창 폭)도 다시 재서,
 * 줄바꿈이 늘어나도 아래가 잘리지 않는다. 폰트가 늦게 들어와도 한 번 더 잰다.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string, min: number) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = Math.max(el.scrollHeight, min) + 'px'
    }
    fit()
    // 폭이 바뀌면 줄 수가 바뀐다 → 다시 잰다
    let lastW = el.clientWidth
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) { lastW = el.clientWidth; fit() }
    })
    ro.observe(el)
    // 웹폰트가 나중에 들어오면 글자 폭이 달라진다
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    fonts?.ready.then(fit).catch(() => {})
    return () => ro.disconnect()
  }, [ref, value, min])
}
