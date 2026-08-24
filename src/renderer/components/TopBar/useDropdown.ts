import { useEffect, useRef, useState } from 'react'

interface UseDropdownOptions {
  /** 外部控制展开状态（受控模式） */
  open?: boolean
  /** 关闭回调（点击外部时触发） */
  onOutsideClose?: () => void
}

/**
 * 下拉菜单状态管理 hook。
 * 管理展开状态，并在点击菜单外部时关闭（监听 document mousedown）。
 */
export function useDropdown(options: UseDropdownOptions = {}): {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  ref: React.RefObject<HTMLDivElement>
} {
  const [internalOpen, setInternalOpen] = useState(false)
  // 受控模式：open 由外部传入，否则使用内部状态
  const open = options.open !== undefined ? options.open : internalOpen
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleOutside = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        if (options.open !== undefined) {
          options.onOutsideClose?.()
        } else {
          setInternalOpen(false)
        }
      }
    }
    const handleEsc = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (options.open !== undefined) {
          options.onOutsideClose?.()
        } else {
          setInternalOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [open, options])

  return {
    open,
    setOpen: setInternalOpen,
    toggle: () => setInternalOpen((v) => !v),
    ref
  }
}
