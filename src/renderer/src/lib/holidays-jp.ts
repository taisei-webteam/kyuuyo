/**
 * 日本の祝日プリセットデータ
 *
 * 実体は Main / Renderer 共有の `src/shared/holidays-jp.ts` に移設済み。
 * 後方互換のため、ここから再エクスポートする。
 */
export type { HolidayEntry } from '../../../shared/holidays-jp'
export {
  getHolidaysForYear,
  getHolidayMap,
  getNationalHolidaySet,
  isNationalHoliday,
} from '../../../shared/holidays-jp'
