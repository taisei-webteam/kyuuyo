import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { UpdaterEvent } from '../../../shared/types'
import styles from './UpdateIndicator.module.css'

const hasApi = typeof window !== 'undefined' && 'api' in window

/**
 * 更新が見つかると右下に案内を出す。再起動はせず、今すぐ適用するかあとでにするかを選ぶ。
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

      {(status === 'available' || status === 'progress' || status === 'downloaded') && (
        <>
          <div className={styles.title}>
            新しいバージョン{event.version ? ` v${event.version}` : ''}があります
          </div>
          <div className={styles.desc}>
            {status === 'downloaded'
              ? '作業はそのまま続けられます。今すぐ適用するか、あとでアプリを終了したときに適用するかを選べます。'
              : status === 'progress'
                ? `裏でダウンロードしています（${event.percent ?? 0}%）。今すぐ適用を選ぶと、完了後に再起動します。`
                : '裏で準備しています。今すぐ適用を選ぶと、完了後に再起動します。'}
          </div>
          {status === 'progress' && (
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${event.percent ?? 0}%` }} />
            </div>
          )}
          {status === 'available' && (
            <div className={styles.bar}>
              <div className={styles.barIndeterminate} />
            </div>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={handleRestart}
              disabled={restarting}
            >
              {restarting ? '更新を適用しています…' : '今すぐ更新'}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setDismissed(true)}>
              あとで
            </button>
          </div>
        </>
      )}
    </div>
  )
}
