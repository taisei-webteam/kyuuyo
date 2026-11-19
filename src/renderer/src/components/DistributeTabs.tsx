import { useCallback, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from 'react'
import styles from './DistributeTabs.module.css'

export type DistributeMode = 'pdf' | 'email'

const MODES: { mode: DistributeMode; label: string }[] = [
  { mode: 'pdf', label: 'PDF印刷' },
  { mode: 'email', label: 'メール送信' },
]

interface DistributeTabsProps {
  mode: DistributeMode
  onModeChange: (mode: DistributeMode) => void
  /** 一覧で選んでいる人の名前。未選択のときは null */
  personName: string | null
  /** 選んでいる1名に対する操作（印刷・個別送信など） */
  personActions: ReactNode
  /** この月・この期の全員に対する操作（一括印刷・一括送信など） */
  everyoneActions: ReactNode
}

/**
 * 明細の渡し方（PDF印刷 / メール送信）のタブ。
 * タブの下に、そのタブで使うボタンだけを入れた枠がつながる。
 */
export function DistributeTabs({
  mode,
  onModeChange,
  personName,
  personActions,
  everyoneActions,
}: DistributeTabsProps): ReactElement {
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const tabRefs = useRef<Record<DistributeMode, HTMLButtonElement | null>>({ pdf: null, email: null })

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
      event.preventDefault()
      const next: DistributeMode = mode === 'pdf' ? 'email' : 'pdf'
      onModeChange(next)
      tabRefs.current[next]?.focus()
    },
    [mode, onModeChange],
  )

  return (
    <div className={styles.area}>
      <div className={styles.tabs} role="tablist" aria-label="明細の渡し方">
        {MODES.map((item) => {
          const active = item.mode === mode
          return (
            <button
              key={item.mode}
              ref={(el) => {
                tabRefs.current[item.mode] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.mode}`}
              aria-selected={active}
              aria-controls={panelId}
              tabIndex={active ? 0 : -1}
              className={`${styles.tab} ${active ? styles.tabActive : ''}`}
              onClick={() => onModeChange(item.mode)}
              onKeyDown={handleKeyDown}
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <div className={styles.panel} role="tabpanel" id={panelId} aria-labelledby={`${baseId}-tab-${mode}`}>
        <div className={styles.scope}>
          <span className={styles.scopeLabel}>
            {personName ? (
              <>
                <strong>{personName}</strong> さん
              </>
            ) : (
              '従業員を選択してください'
            )}
          </span>
          {personActions}
        </div>
        <span className={styles.scopeDivider} aria-hidden="true" />
        <div className={styles.scope}>
          <span className={styles.scopeLabel}>全員</span>
          {everyoneActions}
        </div>
      </div>
    </div>
  )
}

interface DistributeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** そのタブの主な操作（青い塗り） */
  primary?: boolean
}

export function DistributeButton({ primary = false, className, ...rest }: DistributeButtonProps): ReactElement {
  const classes = [styles.button, primary ? styles.buttonPrimary : '', className ?? ''].filter(Boolean).join(' ')
  return <button type="button" {...rest} className={classes} />
}
