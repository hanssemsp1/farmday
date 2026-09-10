// 로고 손질 — 올리기 전에 브라우저에서 미리 고쳐 둔다.
//
// 왜 필요한가.
//  · 푸터는 바탕이 남색(#10243E)이다. 흰 바탕에 짙은 글자로 만든 로고를 그대로 올리면
//    흰 네모가 얹히고, 배경을 빼도 짙은 회색 글자는 남색 위에서 거의 안 보인다.
//  · 그렇다고 대표님이 로고 파일을 색깔별로 다시 만드실 일은 아니다. 여기서 바꿔 드린다.

export interface LogoFix {
  /** 흰 바탕을 투명하게 (남색 위에 흰 네모가 얹히지 않게) */
  cutWhite?: boolean
  /** 남아 있는 그림을 전부 흰색으로 (어두운 바탕에서 읽히게) */
  toWhite?: boolean
}

/** 이 밝기 이상이면 배경으로 본다. JPG 는 압축 때문에 흰색이 250 언저리로 흩어진다 */
const WHITE_HARD = 238
/** 여기서부터 서서히 투명해지게 — 글자 가장자리가 톱니처럼 되지 않도록 */
const WHITE_SOFT = 218
/**
 * 색기가 이만큼도 안 되면 「검정·회색」으로 본다.
 * 흰색으로 바꿀 때 이런 픽셀만 건드려서, 금색 장식선처럼 색이 있는 부분은 원래 색 그대로 남긴다.
 */
const GRAY_MAX = 45

export async function fixLogo(file: File, opt: LogoFix): Promise<File> {
  if (!opt.cutWhite && !opt.toWhite) return file
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bmp = await createImageBitmap(file)
    const cv = document.createElement('canvas')
    cv.width = bmp.width
    cv.height = bmp.height
    const cx = cv.getContext('2d')
    if (!cx) return file
    cx.drawImage(bmp, 0, 0)
    bmp.close?.()

    const img = cx.getImageData(0, 0, cv.width, cv.height)
    const p = img.data
    for (let i = 0; i < p.length; i += 4) {
      if (p[i + 3] === 0) continue
      const lo = Math.min(p[i], p[i + 1], p[i + 2])
      const hi = Math.max(p[i], p[i + 1], p[i + 2])

      if (opt.cutWhite) {
        // 세 색이 고르게 밝으면(=회색빛 흰색) 배경으로 본다.
        // 노란 장식선처럼 색이 있는 부분은 lo 값이 낮아 살아남는다.
        if (lo >= WHITE_HARD) { p[i + 3] = 0; continue }
        if (lo > WHITE_SOFT) {
          const keep = (WHITE_HARD - lo) / (WHITE_HARD - WHITE_SOFT)
          p[i + 3] = Math.round(p[i + 3] * keep)
          if (p[i + 3] === 0) continue
        }
      }

      // 검정·회색 글자만 흰색으로. 금색 선 같은 색깔은 원래 색 그대로 둔다.
      if (opt.toWhite && hi - lo <= GRAY_MAX) { p[i] = 255; p[i + 1] = 255; p[i + 2] = 255 }
    }
    cx.putImageData(img, 0, 0)

    const blob: Blob | null = await new Promise((done) => cv.toBlob(done, 'image/png'))
    if (!blob) return file
    const base = file.name.replace(/\.[^.]+$/, '') || 'logo'
    return new File([blob], `${base}.png`, { type: 'image/png' })
  } catch {
    // 손질에 실패하면 원본을 그대로 올린다 — 아무것도 못 올리는 것보다 낫다
    return file
  }
}
