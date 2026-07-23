import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { UpdaterEvent } from '../../../shared/types'
import styles from './UpdateIndicator.module.css'

const hasApi = typeof window !== 'undefined' && 'api' in window

/**
 * 自動更新の進捗を画面右下に表示する（裏で走るダウンロードを可視化）。
 * ダウンロード完了後は「今すぐ再起動して更新」ボタンを提供する。
 * 配布版のみ更新イベントが発火するため、開発版では何も表示されない。
 */
export function UpdateIndicator(): ReactElement | null {
  const [event, setEvent] = useState<UpdaterEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    if (!hasApi) return
    // 購読前に発生した状態（既にダウンロード中/完了 等）を同期取得
    void window.api.updater.getState().then((s) => {
      if (s) setEvent(s)
    })
    const unsubscribe = window.api.updater.onEvent((e) => {
      setEvent(e)
      setDismissed(false) // 新しい状態が来たら再表示する
    })
    return unsubscribe
  }, [])

  if (!event || dismissed) return null
  const { status } = event
  // 確認中・更新なし・エラーは表示しない（UIをうるさくしない）
  if (status === 'checking' || status === 'not-available' || status === 'error') {
    return null
  }

  const handleRestart = async (): Promise<void> => {
    setRestarting(true)
    try {
      await window.api.updater.quitAndInstall()
    } catch {
      setRestarting(false)
    }
  }

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <button
        type="button"
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label="閉じる"
      >
        ×
      </button>

      {status === 'available' && (
        <>
          <div className={styles.title}>
            新しいバージョン{event.version ? ` v${event.version}` : ''}を準備中…
          </div>
          <div className={styles.bar}>
            <div className={styles.barIndeterminate} />
          </div>
        </>
      )}

      {status === 'progress' && (
        <>
          <div className={styles.title}>更新をダウンロード中… {event.percent ?? 0}%</div>
          <div className={styles.bar}>
            <div className={styles.barFill} style={{ width: `${event.percent ?? 0}%` }} />
          </div>
        </>
      )}

      {status === 'downloaded' && (
        <>
          <div className={styles.title}>
            更新の準備ができました{event.version ? `（v${event.version}）` : ''}
          </div>
          <div className={styles.desc}>今すぐ再起動して更新を適用できます。</div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={handleRestart}
              disabled={restarting}
            >
              {restarting ? '再起動中…' : '今すぐ再起動して更新'}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setDismissed(true)}>
              後で
            </button>
          </div>
        </>
      )}
    </div>
  )
}
