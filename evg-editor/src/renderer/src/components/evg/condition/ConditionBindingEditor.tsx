import { useState } from 'react'
import type {
  ConditionBinding,
  ConditionType
} from '../../../../../shared/evgData'
import type { ProjectVariable } from '../../../../../shared/variable'
import { ConditionEditor, type ConditionOption } from './ConditionEditor'
import { ConditionRefPickerDialog } from './ConditionRefPickerDialog'
import { createDefaultPredicate } from './conditionOperators'

interface ConditionBindingEditorProps {
  value: ConditionBinding
  variables: ProjectVariable[]
  conditions?: ConditionOption[]
  disabled?: boolean
  onChange: (value: ConditionBinding) => void
}

type BindingMode = 'always' | 'inline' | 'ref'

function getBindingMode(value: ConditionBinding): BindingMode {
  if (value === true) return 'always'
  if (typeof value === 'string') return 'ref'
  return 'inline'
}

export function ConditionBindingEditor({
  value,
  variables,
  conditions = [],
  disabled = false,
  onChange
}: ConditionBindingEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const mode = getBindingMode(value)

  const chooseMode = (nextMode: BindingMode): void => {
    if (nextMode === 'always') {
      onChange(true)
      return
    }

    if (nextMode === 'inline') {
      onChange(
        typeof value === 'object' && value !== null
          ? value
          : createDefaultPredicate()
      )
      return
    }

    if (conditions.length > 0) {
      onChange(typeof value === 'string' ? value : conditions[0].key)
    }
  }

  return (
    <div className="condition-binding">
      <div className="segmented">
        <button
          type="button"
          className={`segmented__item${mode === 'always' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => chooseMode('always')}
        >
          始终执行
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'inline' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => chooseMode('inline')}
        >
          内联条件
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'ref' ? ' segmented__item--active' : ''}`}
          disabled={disabled || (conditions.length === 0 && mode !== 'ref')}
          onClick={() => chooseMode('ref')}
        >
          引用条件
        </button>
      </div>

      {mode === 'always' && (
        <p className="condition-binding__hint">无条件通过。</p>
      )}

      {mode === 'inline' && (
        <ConditionEditor
          value={value as ConditionType}
          variables={variables}
          conditionOptions={conditions}
          disabled={disabled}
          onChange={(next) => onChange(next)}
        />
      )}

      {mode === 'ref' && (
        <div className="condition-binding__ref">
          <span className="condition-binding__ref-value">
            {typeof value === 'string' && value ? value : '未选择'}
          </span>
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            选择条件
          </button>
        </div>
      )}

      {pickerOpen && (
        <ConditionRefPickerDialog
          value={typeof value === 'string' ? value : null}
          options={conditions}
          disabled={disabled}
          onSelect={(key) => onChange(key)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
