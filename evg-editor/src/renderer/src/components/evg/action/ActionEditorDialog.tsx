import { useEffect, useState } from 'react'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { EditorDialog } from '../../data/EditorDialog'
import { ActionEditor } from './ActionEditor'
import type { ConditionOption } from '../condition/ConditionEditor'
import type { ActionValue } from './actionOptions'

interface ActionEditorDialogProps {
  title?: string
  value: ActionValue
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  disabled?: boolean
  onApply: (value: ActionValue) => void
  onClose: () => void
}

export function ActionEditorDialog({
  title = '编辑动作',
  value,
  variables,
  chapters = [],
  conditions = [],
  disabled = false,
  onApply,
  onClose
}: ActionEditorDialogProps) {
  const [draft, setDraft] = useState<ActionValue>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <div className="action-dialog">
        <ActionEditor
          value={draft}
          variables={variables}
          chapters={chapters}
          conditions={conditions}
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
