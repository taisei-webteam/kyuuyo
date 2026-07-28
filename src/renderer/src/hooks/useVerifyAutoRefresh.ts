import { useEffect, useRef } from 'react'

/** 連続したウィンドウ切り替えで問い合わせが続かないよう間隔を空ける */
const MIN_INTERVAL_MS = 10_000

/**
 * ウィンドウにフォーカスが戻ったとき、メール確認の状態を照会する。
 * 相手がブラウザでボタンを押してから利用者がアプリへ戻るまでの間にしか
 * 状態は変わらないため、この瞬間だけを発火点にする。
 */
export function useVerifyAutoRefresh(enabled: boolean, refresh: () => Promise<void>): void {
  const running = useRef(false)
  const lastRunAt = useRef(0)
  const refreshRef = useRef(refresh)

  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) return
    function handleFocus(): void {
      if (running.current) return
      if (Date.now() - lastRunAt.current < MIN_INTERVAL_MS) return
      running.current = true
      void refreshRef
        .current()
        .catch(() => {
          // 自動照会の失敗は無視する（手動の更新ボタンで再実行できる）
        })
        .finally(() => {
          lastRunAt.current = Date.now()
          running.current = false
        })
    }
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled])
}
