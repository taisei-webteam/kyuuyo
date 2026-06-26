import { useCallback, useRef } from 'react'
import type { MouseEvent } from 'react'

interface OverlayDismissProps {
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void
  onClick: (e: MouseEvent<HTMLDivElement>) => void
}

/**
 * モーダル背景（オーバーレイ）クリックで閉じる際の誤クローズを防ぐフック。
 * mousedown もオーバーレイ自身で始まった場合のみ閉じる。
 * これにより input/select 内から始めたテキスト選択ドラッグが
 * 枠外で終わってもモーダルが閉じない。
 */
export function useOverlayDismiss(onDismiss: () => void): OverlayDismissProps {
  const pointerDownOnOverlay = useRef(false)

  const onMouseDown = useCallback((e: MouseEvent<HTMLDivElement>): void => {
    pointerDownOnOverlay.current = e.target === e.currentTarget
  }, [])

  const onClick = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (e.target === e.currentTarget && pointerDownOnOverlay.current) {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return { onMouseDown, onClick }
}
