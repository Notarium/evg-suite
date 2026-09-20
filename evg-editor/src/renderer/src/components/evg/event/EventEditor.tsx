import type { ActionBinding, EventType } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { createGuid } from '../../../../../shared/variable'
import { TrashIcon } from '../../Icons'
import { ConditionBindingEditor } from '../condition/ConditionBindingEditor'
import type { ConditionOption } from '../condition/ConditionEditor'
import {
  ActionBindingEditor,
  type EditableActionBinding
} from '../action/ActionBindingEditor'
import { createDefaultAction, type ActionOption } from '../action/actionOptions'

interface EventEditorProps {
  value: EventType
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  actions?: ActionOption[]
  disabled?: boolean
  onChange: (value: EventType) => void
}

export function EventEditor({
  value,
  variables,
  chapters = [],
  conditions = [],
  actions = [],
  disabled = false,
  onChange
}: EventEditorProps) {
  const updateAction = (index: number, next: EditableActionBinding): void => {
    const nextActions = [...value.actions]
    nextActions[index] = next as unknown as ActionBinding
    onChange({ ...value, actions: nextActions })
  }

  const removeAction = (index: number): void => {
    onChange({
      ...value,
      actions: value.actions.filter((_, effectIndex) => effectIndex !== index)
    })
  }

  const addAction = (): void => {
    onChange({
      ...value,
      actions: [
        ...value.actions,
        createDefaultAction(createGuid()) as unknown as ActionBinding
      ]
    })
  }

  return (
    <div className="event-editor">
      <label className="field">
        <span>事件名称</span>
        <input
          className="field-input"
          value={value.label}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
      </label>

      <div className="event-editor__section">
        <span className="event-editor__section-label">执行条件</span>
        <ConditionBindingEditor
          value={value.canExecute}
          variables={variables}
          conditions={conditions}
          disabled={disabled}
          onChange={(canExecute) => onChange({ ...value, canExecute })}
        />
      </div>

      <div className="event-editor__section">
        <div className="event-editor__section-head">
          <span className="event-editor__section-label">动作列表</span>
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={addAction}
          >
            添加动作
          </button>
        </div>

        {value.actions.length === 0 ? (
          <div className="data-empty">还没有动作，点击“添加动作”开始。</div>
        ) : (
          <div className="event-action-list">
            {value.actions.map((effect, index) => (
              <div className="event-action-card" key={index}>
                <div className="event-action-card__head">
                  <span>动作 {index + 1}</span>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    disabled={disabled}
                    aria-label={`移除动作 ${index + 1}`}
                    onClick={() => removeAction(index)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>

                <ActionBindingEditor
                  value={effect as unknown as EditableActionBinding}
                  variables={variables}
                  chapters={chapters}
                  conditions={conditions}
                  actions={actions}
                  disabled={disabled}
                  onChange={(next) => updateAction(index, next)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
