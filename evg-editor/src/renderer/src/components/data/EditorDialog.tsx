import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { CloseIcon } from '../Icons'

interface EditorDialogProps {
  title: string
  closeDisabled?: boolean
  onClose: () => void
  children: ReactNode
}

export function EditorDialog({
  title,
  closeDisabled = false,
  onClose,
  children
}: EditorDialogProps) {
  useEffect(() => {
    if (closeDisabled) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeDisabled, onClose])

  return (
    <div
      className="editor-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (closeDisabled) return
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="editor-dialog__head">
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button icon-button--ghost"
            aria-label="关闭"
            disabled={closeDisabled}
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="editor-dialog__body">{children}</div>
      </section>
    </div>
  )
}
