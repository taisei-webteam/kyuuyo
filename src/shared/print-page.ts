/**
 * PDF / 印刷の用紙サイズ。
 *
 * B4・B5 は日本の事務用紙（JIS）。
 *   JIS B5: 182 × 257 mm
 *   JIS B4: 257 × 364 mm
 *
 * Electron の printToPDF は A 判などの名前付きサイズのみ受け付ける。
 * B 判はインチ単位のカスタムサイズに変換して渡す（縦寸）。
 * 横向きは呼び出し側の landscape: true で回転する。
 */

export type PdfPaper = 'A4' | 'A3' | 'B5' | 'B4'

export interface PdfPageInches {
  width: number
  height: number
}

const MM_PER_INCH = 25.4

/** printToPDF に渡す pageSize。B 判だけインチ寸法、A 判は名前のまま。 */
export function toPrintToPdfPageSize(paper: PdfPaper): 'A4' | 'A3' | PdfPageInches {
  if (paper === 'B5') {
    return { width: 182 / MM_PER_INCH, height: 257 / MM_PER_INCH }
  }
  if (paper === 'B4') {
    return { width: 257 / MM_PER_INCH, height: 364 / MM_PER_INCH }
  }
  return paper
}

/** CSS @page の size キーワード。B 判は JIS を明示する（無印 B5 は ISO）。 */
export function toCssPageSize(paper: PdfPaper): string {
  if (paper === 'B5') return 'JIS-B5'
  if (paper === 'B4') return 'JIS-B4'
  return paper
}
