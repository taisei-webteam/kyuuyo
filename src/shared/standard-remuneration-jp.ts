/**
 * 健康保険の標準報酬月額表（全国共通）
 *
 * 標準報酬月額の等級区分は都道府県によらず全国共通（保険料「率」のみ都道府県で異なる）。
 * 報酬月額（月々の総支給額の平均）を、該当する標準報酬月額へ当てはめるために使用する。
 *
 * 出典: 全国健康保険協会（協会けんぽ）「標準報酬月額表」
 *   https://www.kyoukaikenpo.or.jp/
 *
 * 注意:
 * - 本表は健康保険の等級（第1〜50級／58,000〜1,390,000円）。
 *   厚生年金は上限が異なる（標準報酬月額 650,000円が上限）が、本アプリは
 *   標準報酬月額を単一値で管理しているため健康保険の区分で当てはめる。
 * - 定時決定・随時改定の結果は必ず「決定通知書」と照合すること。
 */

export interface StandardRemunerationGrade {
  /** 健康保険の等級（1〜50） */
  grade: number
  /** 標準報酬月額（円） */
  standard: number
  /** 報酬月額の下限（この額以上・円）。上限は次等級の下限。 */
  lower: number
}

/** 健康保険 標準報酬月額表（第1〜50級） */
export const STANDARD_REMUNERATION_TABLE: StandardRemunerationGrade[] = [
  { grade: 1, standard: 58000, lower: 0 },
  { grade: 2, standard: 68000, lower: 63000 },
  { grade: 3, standard: 78000, lower: 73000 },
  { grade: 4, standard: 88000, lower: 83000 },
  { grade: 5, standard: 98000, lower: 93000 },
  { grade: 6, standard: 104000, lower: 101000 },
  { grade: 7, standard: 110000, lower: 107000 },
  { grade: 8, standard: 118000, lower: 114000 },
  { grade: 9, standard: 126000, lower: 122000 },
  { grade: 10, standard: 134000, lower: 130000 },
  { grade: 11, standard: 142000, lower: 138000 },
  { grade: 12, standard: 150000, lower: 146000 },
  { grade: 13, standard: 160000, lower: 155000 },
  { grade: 14, standard: 170000, lower: 165000 },
  { grade: 15, standard: 180000, lower: 175000 },
  { grade: 16, standard: 190000, lower: 185000 },
  { grade: 17, standard: 200000, lower: 195000 },
  { grade: 18, standard: 220000, lower: 210000 },
  { grade: 19, standard: 240000, lower: 230000 },
  { grade: 20, standard: 260000, lower: 250000 },
  { grade: 21, standard: 280000, lower: 270000 },
  { grade: 22, standard: 300000, lower: 290000 },
  { grade: 23, standard: 320000, lower: 310000 },
  { grade: 24, standard: 340000, lower: 330000 },
  { grade: 25, standard: 360000, lower: 350000 },
  { grade: 26, standard: 380000, lower: 370000 },
  { grade: 27, standard: 410000, lower: 395000 },
  { grade: 28, standard: 440000, lower: 425000 },
  { grade: 29, standard: 470000, lower: 455000 },
  { grade: 30, standard: 500000, lower: 485000 },
  { grade: 31, standard: 530000, lower: 515000 },
  { grade: 32, standard: 560000, lower: 545000 },
  { grade: 33, standard: 590000, lower: 575000 },
  { grade: 34, standard: 620000, lower: 605000 },
  { grade: 35, standard: 650000, lower: 635000 },
  { grade: 36, standard: 680000, lower: 665000 },
  { grade: 37, standard: 710000, lower: 695000 },
  { grade: 38, standard: 750000, lower: 730000 },
  { grade: 39, standard: 790000, lower: 770000 },
  { grade: 40, standard: 830000, lower: 810000 },
  { grade: 41, standard: 880000, lower: 855000 },
  { grade: 42, standard: 930000, lower: 905000 },
  { grade: 43, standard: 980000, lower: 955000 },
  { grade: 44, standard: 1030000, lower: 1005000 },
  { grade: 45, standard: 1090000, lower: 1055000 },
  { grade: 46, standard: 1150000, lower: 1115000 },
  { grade: 47, standard: 1210000, lower: 1175000 },
  { grade: 48, standard: 1270000, lower: 1235000 },
  { grade: 49, standard: 1330000, lower: 1295000 },
  { grade: 50, standard: 1390000, lower: 1355000 },
]

/**
 * 報酬月額（円）から該当する標準報酬月額の等級を求める。
 * @param remuneration 報酬月額（4〜6月の平均など）
 */
export function remunerationToStandard(remuneration: number): StandardRemunerationGrade {
  const r = Math.max(0, Math.floor(remuneration))
  // 下限が大きい等級から探し、r 以上の下限を持つ最初の等級を採用する。
  for (let i = STANDARD_REMUNERATION_TABLE.length - 1; i >= 0; i--) {
    if (r >= STANDARD_REMUNERATION_TABLE[i].lower) {
      return STANDARD_REMUNERATION_TABLE[i]
    }
  }
  return STANDARD_REMUNERATION_TABLE[0]
}
