import { useState } from 'react'
import type { ActionRef } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import { createGuid } from '../../../../../shared/variable'
import type { ProjectVariable } from '../../../../../shared/variable'
import type { ConditionOption } from '../condition/ConditionEditor'
import { ActionEditor } from './ActionEditor'
import { ActionRefPickerDialog } from './ActionRefPickerDialog'
import { createDefaultAction } from './actionOptions'
import type { ActionOption, ActionValue } from './actionOptions'

export type EditableActionBinding = ActionValue | ActionRef

interface ActionBindingEditorProps {
  value: EditableActionBinding
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  actions?: ActionOption[]
  disabled?: boolean
  onChange: (value: EditableActionBinding) => void
}

type BindingMode = 'inline' | 'ref'

function getBindingMode(value: EditableActionBinding): BindingMode {
  return typeof value === 'string' ? 'ref' : 'inline'
}

export function ActionBindingEditor({
  value,
  variables,
  chapters = [],
  conditions = [],
  actions = [],
  disabled = false,
  onChange
}: ActionBindingEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const mode = getBindingMode(value)

  const chooseMode = (nextMode: BindingMode): void => {
    if (nextMode === 'inline') {
      onChange(
        typeof value === 'object' && value !== null
          ? value
          : createDefaultAction(createGuid())
      )
      return
    }

    if (actions.length > 0) {
      onChange(typeof value === 'string' ? value : actions[0].key)
    }
  }

  return (
    <div className="action-binding">
      <div className="segmented">
        <button
          type="button"
          className={`segmented__item${mode === 'inline' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => chooseMode('inline')}
        >
          内联动作
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'ref' ? ' segmented__item--active' : ''}`}
          disabled={disabled || (actions.length === 0 && mode !== 'ref')}
          onClick={() => chooseMode('ref')}
        >
          引用动作
        </button>
      </div>

      {mode === 'inline' && (
        <ActionEditor
          value={value as ActionValue}
          variables={variables}
          chapters={chapters}
          conditions={conditions}
          disabled={disabled}
          onChange={(next) => onChange(next)}
        />
      )}

      {mode === 'ref' && (
        <div className="action-binding__ref">
          <span className="action-binding__ref-value">
            {typeof value === 'string' && value ? value : '未选择'}
          </span>
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            选择动作
          </button>
        </div>
      )}

      {pickerOpen && (
        <ActionRefPickerDialog
          value={typeof value === 'string' ? value : null}
          options={actions}
          disabled={disabled}
          onSelect={(key) => onChange(key)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
