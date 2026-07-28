import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import styles from './ActionMenu.module.css'

export interface ActionMenuItem {
  /** メニュー内の表示名。省略せず正式名称を書く */
  label: string
  /** その操作が何をするかの一行説明 */
  description?: string
  disabled?: boolean
  onSelect: () => void
}

/**
 * ボタンを種類ごとに畳むためのドロップダウンメニュー。
 * ヘッダーに並ぶボタンが増えて名前を省略せざるを得なくなるのを避ける。
 */
export function ActionMenu({
  label,
  items,
}: {
  label: string
  items: ActionMenuItem[]
}): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const close = useCallback((focusTrigger: boolean): void => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent): void {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  // 開いたら先頭の有効な項目へフォーカスを移す
  useEffect(() => {
    if (!open) return
    const first = itemRefs.current.find((el) => el && !el.disabled)
    first?.focus()
  }, [open])

  /** 上下キーで有効な項目を巡回する。 */
  const moveFocus = useCallback(
    (from: number, step: number): void => {
      const count = items.length
      for (let i = 1; i <= count; i++) {
        const next = (from + step * i + count * count) % count
        const el = itemRefs.current[next]
        if (el && !el.disabled) {
          el.focus()
          return
        }
      }
    },
    [items.length],
  )

  return (
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close(true)
        }
      }}
    >
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
      >
        {label}
        <span className={styles.caret} aria-hidden="true">
          ▼
        </span>
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label={label}>
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={item.disabled}
              ref={(el) => {
                itemRefs.current[index] = el
              }}
              onClick={() => {
                close(false)
                item.onSelect()
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  moveFocus(index, 1)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  moveFocus(index, -1)
                }
              }}
            >
              <span className={styles.itemLabel}>{item.label}</span>
              {item.description && (
                <span className={styles.itemDescription}>{item.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
