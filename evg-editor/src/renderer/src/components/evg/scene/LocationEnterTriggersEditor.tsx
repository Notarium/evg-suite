import type { EventBinding } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import { createGuid, type ProjectVariable } from '../../../../../shared/variable'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon
} from '../../Icons'
import type { ConditionOption } from '../condition/ConditionEditor'
import { EventBindingEditor } from '../event/EventBindingEditor'
import { createDefaultEvent } from '../event/eventOptions'
import type { ActionOption } from '../action/actionOptions'
import type { EventOption } from '../event/eventOptions'

interface LocationEnterTriggersEditorProps {
  value?: EventBinding[]
  variables: ProjectVariable[]
  chapters: ChapterSummary[]
  conditions: ConditionOption[]
  actions: ActionOption[]
  events: EventOption[]
  disabled?: boolean
  onChange: (value: EventBinding[] | undefined) => void
}

/** 替换 / 移除指定项；清空后返回 undefined（写盘时省略 onEnter 字段）。 */
function withReplaced(
  items: EventBinding[],
  index: number,
  next: EventBinding | undefined
): EventBinding[] | undefined {
  if (next === undefined) {
    const rest = items.filter((_, i) => i !== index)
    return rest.length > 0 ? rest : undefined
  }
  return items.map((item, i) => (i === index ? next : item))
}

function withMoved(
  items: EventBinding[],
  index: number,
  offset: -1 | 1
): EventBinding[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/**
 * 地点「进入触发」事件链编辑器：每次到达该地点（章节主 fragment 播完、
 * 地点层出现前）按序尝试执行，每项独立 canExecute 判定。
 * 每项复用 EventBindingEditor（内联事件或引用 type=Event 行）。
 */
export function LocationEnterTriggersEditor({
  value,
  variables,
  chapters,
  conditions,
  actions,
  events,
  disabled = false,
  onChange
}: LocationEnterTriggersEditorProps) {
  const items = value ?? []

  return (
    <div className="location-enter-triggers">
      <span className="event-editor__section-label">进入触发</span>
      <p className="field-hint">
        每次到达该地点（章节主 fragment 播完、地点层出现前）按序尝试执行；
        每个触发自己的 canExecute 就是开关，未通过则跳过。
      </p>

      {items.map((binding, index) => (
        <div className="location-enter-triggers__row" key={index}>
          <EventBindingEditor
            value={binding}
            variables={variables}
            chapters={chapters}
            conditions={conditions}
            actions={actions}
            events={events}
            disabled={disabled}
            onChange={(next) => onChange(withReplaced(items, index, next))}
          />
          <div className="location-enter-triggers__buttons">
            <button
              type="button"
              className="icon-button icon-button--ghost"
              disabled={disabled || index === 0}
              aria-label="上移"
              title="上移"
              onClick={() => onChange(withMoved(items, index, -1))}
            >
              <ChevronUpIcon size={14} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--ghost"
              disabled={disabled || index === items.length - 1}
              aria-label="下移"
              title="下移"
              onClick={() => onChange(withMoved(items, index, 1))}
            >
              <ChevronDownIcon size={14} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--ghost"
              disabled={disabled}
              aria-label="删除触发"
              title="删除触发"
              onClick={() => onChange(withReplaced(items, index, undefined))}
            >
              <TrashIcon size={14} />
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="button"
        disabled={disabled}
        onClick={() => onChange([...items, createDefaultEvent(createGuid())])}
      >
        <PlusIcon size={14} />
        添加触发
      </button>
    </div>
  )
}
