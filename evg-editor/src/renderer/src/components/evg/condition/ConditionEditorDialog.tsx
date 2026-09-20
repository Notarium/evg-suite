import { useEffect, useState } from 'react'
import type { ConditionType } from '../../../../../shared/evgData'
import type { ProjectVariable } from '../../../../../shared/variable'
import { EditorDialog } from '../../data/EditorDialog'
import { ConditionEditor, type ConditionOption } from './ConditionEditor'

interface ConditionEditorDialogProps {
  title?: string
  value: ConditionType
  variables: ProjectVariable[]
  conditionOptions?: ConditionOption[]
  disabled?: boolean
  onApply: (value: ConditionType) => void
  onClose: () => void
}

export function ConditionEditorDialog({
  title = '编辑条件',
  value,
  variables,
  conditionOptions = [],
  disabled = false,
  onApply,
  onClose
}: ConditionEditorDialogProps) {
  const [draft, setDraft] = useState<ConditionType>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <div className="condition-dialog">
        <ConditionEditor
          value={draft}
          variables={variables}
          conditionOptions={conditionOptions}
          disabled={disabled}
          onChange={setDraft}
        />

        <div className="editor-form__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={onClose}
          >
            取消
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={disabled}
            onClick={() => onApply(draft)}
          >
            确定
          </button>
        </div>
      </div>
    </EditorDialog>
  )
}
