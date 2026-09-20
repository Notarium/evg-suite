import { Fragment, useState } from 'react'
import type { DragEvent } from 'react'
import type { ActionBinding, EventType } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { createGuid } from '../../../../../shared/variable'
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from '../../Icons'
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

  // 执行顺序 = 数组顺序（契约即语义，不做 order 包装）。
  // 拖拽中只显示插入线预览，松手一次性 splice 重排——避免改 key
  // 导致 React 销毁正在拖拽的把手。
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const moveAction = (from: number, to: number): void => {
    if (from === to) return
    const next = [...value.actions]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange({ ...value, actions: next })
  }

  const handleGripDragStart = (index: number, event: DragEvent): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    setDragIndex(index)
  }

  const handleCardDragOver = (index: number, event: DragEvent): void => {
    if (dragIndex === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? index : index + 1
    setDropIndex(
      position === dragIndex || position === dragIndex + 1 ? null : position
    )
  }

  const commitDrop = (): void => {
    if (dragIndex !== null && dropIndex !== null) {
      const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex
      moveAction(dragIndex, to)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  const clearDrag = (): void => {
    setDragIndex(null)
    setDropIndex(null)
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
          <div
            className="event-action-list"
            onDrop={(event) => {
              event.preventDefault()
              commitDrop()
            }}
            onDragLeave={(event) => {
              if (
                dragIndex !== null &&
                !event.currentTarget.contains(event.relatedTarget as Node)
              ) {
                clearDrag()
              }
            }}
          >
            {value.actions.map((action, index) => (
              <Fragment key={index}>
                {dropIndex === index && (
                  <div className="event-action-card__drop-line" aria-hidden />
                )}
                <div
                  className={`event-action-card${
                    dragIndex === index ? ' event-action-card--dragging' : ''
                  }`}
                  onDragOver={(event) => handleCardDragOver(index, event)}
                  onDrop={(event) => {
                    event.preventDefault()
                    commitDrop()
                  }}
                >
                  <div className="event-action-card__head">
                    <span
                      className="event-action-card__grip"
                      title="拖动调整顺序"
                      draggable={!disabled}
                      onDragStart={(event) => handleGripDragStart(index, event)}
                      onDragEnd={clearDrag}
                    />
                    <span className="event-action-card__index">{index + 1}</span>

                    <div className="event-action-card__order-buttons">
                      <button
                        type="button"
                        className="icon-button icon-button--ghost"
                        title="上移"
                        aria-label={`上移动作 ${index + 1}`}
                        disabled={disabled || index === 0}
                        onClick={() => moveAction(index, index - 1)}
                      >
                        <ChevronUpIcon size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--ghost"
                        title="下移"
                        aria-label={`下移动作 ${index + 1}`}
                        disabled={disabled || index === value.actions.length - 1}
                        onClick={() => moveAction(index, index + 1)}
                      >
                        <ChevronDownIcon size={13} />
                      </button>
                    </div>

                    <span className="event-action-card__title">
                      动作 {index + 1}
                    </span>

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
                    value={action as unknown as EditableActionBinding}
                    variables={variables}
                    chapters={chapters}
                    conditions={conditions}
                    actions={actions}
                    disabled={disabled}
                    onChange={(next) => updateAction(index, next)}
                  />
                </div>
              </Fragment>
            ))}
            {dropIndex === value.actions.length && (
              <div className="event-action-card__drop-line" aria-hidden />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
