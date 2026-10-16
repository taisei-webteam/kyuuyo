const STORAGE_KEY = 'kyuuyo-manual-demo'

/**
 * マニュアル撮影用の架空データモード。
 * 開発中のブラウザで `?manual=1` を付けたときだけ有効。本番の SQLite は読まない。
 */
export function isManualDemo(): boolean {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('manual') === '0') {
    sessionStorage.removeItem(STORAGE_KEY)
    return false
  }
  if (params.get('manual') === '1') {
    sessionStorage.setItem(STORAGE_KEY, '1')
    return true
  }
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

/** 撮影用モードでは実在の会社ロゴを出さない。 */
export function manualDemoLogo(src: string | undefined): string | undefined {
  return isManualDemo() ? undefined : src
}
