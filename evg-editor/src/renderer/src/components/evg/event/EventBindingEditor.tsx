import { useState } from 'react'
import type { EventBinding } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import { createGuid } from '../../../../../shared/variable'
import type { ProjectVariable } from '../../../../../shared/variable'
import type { ConditionOption } from '../condition/ConditionEditor'
import type { ActionOption } from '../action/actionOptions'
import { EventEditorDialog } from './EventEditorDialog'
import { EventRefPickerDialog } from './EventRefPickerDialog'
import { createDefaultEvent, getEventSummary } from './eventOptions'
import type { EventOption } from './eventOptions'

interface EventBindingEditorProps {
  value?: EventBinding
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  actions?: ActionOption[]
  events?: EventOption[]
  disabled?: boolean
  onChange: (value: EventBinding | undefined) => void
}

type BindingMode = 'none' | 'inline' | 'ref'

function getBindingMode(value?: EventBinding): BindingMode {
  if (!value) return 'none'
  if (typeof value === 'string') return 'ref'
  return 'inline'
}

export function EventBindingEditor({
  value,
  variables,
  chapters = [],
  conditions = [],
  actions = [],
  events = [],
  disabled = false,
  onChange
}: EventBindingEditorProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const mode = getBindingMode(value)

  const chooseMode = (nextMode: BindingMode): void => {
    if (nextMode === 'none') {
      onChange(undefined)
      return
    }

    if (nextMode === 'inline') {
      onChange(
        typeof value === 'object' && value !== null
          ? value
          : createDefaultEvent(createGuid())
      )
      return
    }

    if (events.length > 0) {
      onChange(typeof value === 'string' ? value : events[0].key)
    }
  }

  return (
    <div className="event-binding">
      <div className="segmented">
        <button
          type="button"
          className={`segmented__item${mode === 'none' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => chooseMode('none')}
        >
          不绑定
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'inline' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => chooseMode('inline')}
        >
          内联事件
        </button>
        <button
          type="button"
          className={`segmented__item${mode === 'ref' ? ' segmented__item--active' : ''}`}
          disabled={disabled || (events.length === 0 && mode !== 'ref')}
          onClick={() => chooseMode('ref')}
        >
          引用事件
        </button>
      </div>

      {mode === 'none' && (
        <p className="event-binding__hint">当前热点不绑定事件。</p>
      )}

      {mode === 'inline' && typeof value === 'object' && value !== null && (
        <div className="event-binding__row">
          <span className="event-binding__summary">{getEventSummary(value)}</span>
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={() => setEditorOpen(true)}
          >
            编辑内联事件
          </button>
        </div>
      )}

      {mode === 'ref' && (
        <div className="event-binding__row">
          <span className="event-binding__ref-value">
            {typeof value === 'string' && value ? value : '未选择'}
          </span>
          <button
            type="button"
            className="button button--ghost"
            disabled={disabled}
            onClick={() => setPickerOpen(true)}
          >
            选择事件
          </button>
        </div>
      )}

      {editorOpen && typeof value === 'object' && value !== null && (
        <EventEditorDialog
          value={value}
          variables={variables}
          chapters={chapters}
          conditions={conditions}
          actions={actions}
          disabled={disabled}
          onApply={(next) => {
            onChange(next)
            setEditorOpen(false)
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {pickerOpen && (
        <EventRefPickerDialog
          value={typeof value === 'string' ? value : null}
          options={events}
          disabled={disabled}
          onSelect={(key) => onChange(key)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
