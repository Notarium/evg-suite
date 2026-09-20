import { useState } from 'react'
import type { ActionOption } from './actionOptions'

interface ActionRefPickerProps {
  value: string | null
  options: ActionOption[]
  disabled?: boolean
  onSelect: (key: string) => void
}

export function ActionRefPicker({
  value,
  options,
  disabled = false,
  onSelect
}: ActionRefPickerProps) {
  const [search, setSearch] = useState('')
  const keyword = search.trim().toLowerCase()

  const filtered = keyword
    ? options.filter((option) => {
        const label = option.label ?? option.key
        return (
          option.key.toLowerCase().includes(keyword) ||
          label.toLowerCase().includes(keyword)
        )
      })
    : options

  return (
    <div className="condition-ref-picker">
      <input
        className="field-input"
        value={search}
        disabled={disabled}
        placeholder="搜索动作"
        onChange={(event) => setSearch(event.target.value)}
      />

      {filtered.length === 0 ? (
        <div className="data-empty">没有匹配的动作定义。</div>
      ) : (
        <div className="condition-ref-picker__list">
          {filtered.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`condition-ref-picker__item${
                option.key === value ? ' condition-ref-picker__item--active' : ''
              }`}
              disabled={disabled}
              onClick={() => onSelect(option.key)}
            >
              <strong>{option.label ?? option.key}</strong>
              <span>{option.key}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
