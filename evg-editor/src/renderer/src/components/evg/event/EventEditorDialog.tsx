import { useEffect, useState } from 'react'
import type { EventType } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { EditorDialog } from '../../data/EditorDialog'
import { EventEditor } from './EventEditor'
import type { ConditionOption } from '../condition/ConditionEditor'
import type { ActionOption } from '../action/actionOptions'

interface EventEditorDialogProps {
  title?: string
  value: EventType
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  actions?: ActionOption[]
  disabled?: boolean
  onApply: (value: EventType) => void
  onClose: () => void
}

export function EventEditorDialog({
  title = '编辑事件',
  value,
  variables,
  chapters = [],
  conditions = [],
  actions = [],
  disabled = false,
  onApply,
  onClose
}: EventEditorDialogProps) {
  const [draft, setDraft] = useState<EventType>(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <EditorDialog title={title} closeDisabled={disabled} onClose={onClose}>
      <div className="event-dialog">
        <EventEditor
          value={draft}
          variables={variables}
          chapters={chapters}
          conditions={conditions}
          actions={actions}
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
