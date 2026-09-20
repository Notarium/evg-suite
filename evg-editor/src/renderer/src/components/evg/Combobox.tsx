import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon } from '../Icons'

export interface ComboboxOption {
  value: string
  label: string
  meta?: string
  metaClassName?: string
  disabled?: boolean
}

interface ComboboxProps {
  value: string
  options: ComboboxOption[]
  disabled?: boolean
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  onChange: (value: string) => void
}

export function Combobox({
  value,
  options,
  disabled = false,
  placeholder = '未选择',
  searchPlaceholder = '输入以筛选',
  emptyMessage = '没有匹配的选项',
  onChange
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return

      setOpen(false)
      setFilter('')
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return

    const updatePosition = (): void => {
      const control = rootRef.current
      if (!control) return

      const rect = control.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceBelow = viewportHeight - rect.bottom
      const spaceAbove = rect.top
      const openUp = spaceBelow < 240 && spaceAbove > spaceBelow
      const maxHeight = Math.min(
        240,
        Math.max(80, (openUp ? spaceAbove : spaceBelow) - 8)
      )

      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight,
        zIndex: 1000,
        ...(openUp
          ? { bottom: viewportHeight - rect.top + 4 }
          : { top: rect.bottom + 4 })
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const selected = options.find((option) => option.value === value) ?? null
  const keyword = filter.trim().toLowerCase()
  const filtered = keyword
    ? options.filter(
        (option) =>
          option.label.toLowerCase().includes(keyword) ||
          option.value.toLowerCase().includes(keyword)
      )
    : options

  const openMenu = (): void => {
    if (disabled) return
    setFilter('')
    setOpen(true)
  }

  const closeMenu = (): void => {
    setOpen(false)
    setFilter('')
  }

  const selectOption = (option: ComboboxOption): void => {
    if (option.disabled) return
    onChange(option.value)
    closeMenu()
  }

  return (
    <div className="combobox" ref={rootRef}>
      <div className="combobox__control">
        <input
          className="field-input"
          value={open ? filter : selected?.label ?? value}
          placeholder={open ? searchPlaceholder : placeholder}
          disabled={disabled}
          onFocus={openMenu}
          onChange={(event) => {
            setFilter(event.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={(event) => {
            const firstEnabled = filtered.find((option) => !option.disabled)
            if (event.key === 'Enter' && firstEnabled) {
              event.preventDefault()
              selectOption(firstEnabled)
            }
            if (event.key === 'Escape') {
              closeMenu()
            }
          }}
        />
        <button
          type="button"
          className="icon-button icon-button--ghost combobox__toggle"
          disabled={disabled}
          aria-label="列出全部选项"
          onClick={() => {
            if (!open) {
              openMenu()
              return
            }

            if (filter) {
              setFilter('')
              return
            }

            closeMenu()
          }}
        >
          <ChevronDownIcon />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="combobox__menu combobox__menu--floating"
            style={menuStyle}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="combobox__empty">{emptyMessage}</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  className={`combobox__option${
                    option.value === value ? ' combobox__option--active' : ''
                  }${option.disabled ? ' combobox__option--disabled' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <span className="combobox__label">{option.label}</span>
                  {option.meta && (
                    <span className={option.metaClassName ?? 'combobox__meta'}>
                      {option.meta}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
