import { useEffect, useState } from 'react'
import type { AttributeValueType } from '../../../../shared/attribute'
import type { VariableType } from '../../../../shared/variable'

type ValueType = VariableType | AttributeValueType

interface ValueEditorProps {
  type: ValueType
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  placeholder?: string
}

function toDraft(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
  }
  return ''
}

export function ValueEditor({
  type,
  value,
  onChange,
  disabled = false,
  placeholder
}: ValueEditorProps) {
  const [draft, setDraft] = useState(() => toDraft(value))

  useEffect(() => {
    setDraft(toDraft(value))
  }, [value])

  if (type === 'pending') {
    return (
      <input
        className="field-input"
        value="pending 类型不使用默认值"
        disabled
        readOnly
      />
    )
  }

  if (type === 'bool') {
    const checked = value === true
    return (
      <button
        type="button"
        className={`value-toggle${checked ? ' value-toggle--on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        {checked ? '真' : '假'}
      </button>
    )
  }

  const commit = (): void => {
    if (type === 'number') {
      const text = draft.trim()
      if (text === '') {
        onChange(0)
        return
      }

      const nextValue = Number(text)
      if (Number.isFinite(nextValue)) {
        onChange(nextValue)
      } else {
        setDraft(toDraft(value))
      }
      return
    }

    onChange(draft)
  }

  return (
    <input
      className="field-input"
      type={type === 'number' ? 'number' : 'text'}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}
