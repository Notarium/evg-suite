import { Fragment, useState } from 'react'
import type { DragEvent } from 'react'
import type {
  RuntimeTimeConfig,
  RuntimeTimeMode,
  RuntimeTimeSlotDef
} from '../../../../shared/runtimeConfig'
import { createRuntimeSlotId, WEEKDAY_LABELS } from '../../../../shared/runtimeConfig'
import { PlusIcon, TrashIcon } from '../Icons'

interface TimeConfigEditorProps {
  config: RuntimeTimeConfig
  disabled?: boolean
  onChange: (next: RuntimeTimeConfig) => void
}

const MODE_OPTIONS: ReadonlyArray<{ value: RuntimeTimeMode; label: string; description: string }> = [
  {
    value: 'elapsed',
    label: '累计天数',
    description: 'evg.time.day 从 1 开始逐日递增，不使用年月日。'
  },
  {
    value: 'calendar',
    label: '真实年月日',
    description: '从起始日期开始按真实历法推进，evg.time.day 同步累计。'
  }
]

/**
 * 运行数据配置 · 时间页签。
 *
 * 配置项与 Common.md 第 9.3 节的 RuntimeConfigData.time 对应：
 * 计时模式、起始日期（calendar）、星期开关与起始星期、单日时段列表。
 */
export function TimeConfigEditor({ config, disabled = false, onChange }: TimeConfigEditorProps) {
  const patch = (partial: Partial<RuntimeTimeConfig>): void => {
    onChange({ ...config, ...partial })
  }

  const updateSlot = (index: number, partial: Partial<RuntimeTimeSlotDef>): void => {
    patch({
      slots: config.slots.map((slot, i) =>
        i === index ? { ...slot, ...partial } : slot
      )
    })
  }

  /** 时段 id 的即时提示：为空 / 与其它时段重复（保存会被主进程拒绝）。 */
  const idWarningFor = (slot: RuntimeTimeSlotDef): string | null => {
    if (slot.id.trim().length === 0) return '时段 id 不能为空，保存前必须填写。'
    const sameId = config.slots.filter((entry) => entry.id === slot.id)
    return sameId.length > 1 ? '存在相同 id 的时段，保存会被拒绝。' : null
  }

  const removeSlot = (index: number): void => {
    patch({ slots: config.slots.filter((_, i) => i !== index) })
  }

  const addSlot = (): void => {
    const slot: RuntimeTimeSlotDef = { id: createRuntimeSlotId(), label: '新时段' }
    patch({ slots: [...config.slots, slot] })
  }

  // 拖拽调整顺序：把手按下开始拖，悬停行时显示插入线，松手提交移动。
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const moveSlot = (from: number, to: number): void => {
    if (from === to) return
    const next = [...config.slots]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patch({ slots: next })
  }

  const handleGripDragStart = (index: number, event: DragEvent): void => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    setDragIndex(index)
  }

  const handleRowDragOver = (index: number, event: DragEvent): void => {
    if (dragIndex === null) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < rect.top + rect.height / 2 ? index : index + 1
    // 指示线落在本来的位置附近时没有意义，不显示
    setDropIndex(position === dragIndex || position === dragIndex + 1 ? null : position)
  }

  const commitDrop = (): void => {
    if (dragIndex !== null && dropIndex !== null) {
      const to = dropIndex > dragIndex ? dropIndex - 1 : dropIndex
      moveSlot(dragIndex, to)
    }
    setDragIndex(null)
    setDropIndex(null)
  }

  const clearDrag = (): void => {
    setDragIndex(null)
    setDropIndex(null)
  }

  return (
    <div className="runtime-config-editor">
      <div className="field">
        <span>计时模式</span>
        <div className="segmented">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${
                config.mode === option.value ? ' segmented__item--active' : ''
              }`}
              disabled={disabled}
              title={option.description}
              onClick={() => patch({ mode: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {MODE_OPTIONS.find((option) => option.value === config.mode)?.description}
        </p>
      </div>

      {config.mode === 'calendar' && (
        <div className="field">
          <span>起始日期</span>
          <div className="runtime-config-inline-fields">
            <label className="runtime-config-inline-field">
              <span>年</span>
              <input
                className="field-input"
                type="number"
                min={1}
                max={9999}
                value={config.startDate?.year ?? 2026}
                disabled={disabled}
                onChange={(event) => {
                  const year = Number(event.target.value)
                  if (!Number.isFinite(year)) return
                  patch({ startDate: { ...(config.startDate ?? { month: 1, day: 1 }), year, month: config.startDate?.month ?? 1, day: config.startDate?.day ?? 1 } })
                }}
              />
            </label>
            <label className="runtime-config-inline-field">
              <span>月</span>
              <input
                className="field-input"
                type="number"
                min={1}
                max={12}
                value={config.startDate?.month ?? 1}
                disabled={disabled}
                onChange={(event) => {
                  const month = Number(event.target.value)
                  if (!Number.isFinite(month)) return
                  patch({ startDate: { year: config.startDate?.year ?? 2026, month, day: config.startDate?.day ?? 1 } })
                }}
              />
            </label>
            <label className="runtime-config-inline-field">
              <span>日</span>
              <input
                className="field-input"
                type="number"
                min={1}
                max={31}
                value={config.startDate?.day ?? 1}
                disabled={disabled}
                onChange={(event) => {
                  const day = Number(event.target.value)
                  if (!Number.isFinite(day)) return
                  patch({ startDate: { year: config.startDate?.year ?? 2026, month: config.startDate?.month ?? 1, day } })
                }}
              />
            </label>
          </div>
        </div>
      )}

      <div className="field">
        <span>星期</span>
        <div className="runtime-config-inline-fields">
          <button
            type="button"
            className={`value-toggle${config.weekdayEnabled ? ' value-toggle--on' : ''}`}
            disabled={disabled}
            onClick={() => patch({ weekdayEnabled: !config.weekdayEnabled })}
          >
            {config.weekdayEnabled ? '启用星期' : '不启用星期'}
          </button>

          {config.weekdayEnabled && (
            <label className="runtime-config-inline-field">
              <span>起始星期（第 1 天）</span>
              <select
                className="field-input"
                value={config.startWeekday}
                disabled={disabled}
                onChange={(event) => {
                  const startWeekday = Number(event.target.value)
                  if (Number.isInteger(startWeekday) && startWeekday >= 1 && startWeekday <= 7) {
                    patch({ startWeekday })
                  }
                }}
              >
                {WEEKDAY_LABELS.map((label, index) => (
                  <option key={label} value={index + 1}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="field-hint">
          启用后由起始星期逐日推算；星期只用于展示与条件判断，不影响时间推进。
        </p>
      </div>

      <div className="field">
        <span>单日时段（{config.slots.length} 个）</span>
        <p className="field-hint">
          按列表顺序在一天内循环推进。时段名称用于展示；时段 id 是运行时
          引用的标识（evg.time.slot 的取值），可编辑为语义化 id，修改后
          剧本中已按旧 id 写的条件会失效。
        </p>

        <div
          className="runtime-config-rows"
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
          {config.slots.map((slot, index) => (
            <Fragment key={`${slot.id}-${index}`}>
              {dropIndex === index && (
                <div className="runtime-config-row__drop-line" aria-hidden />
              )}
              <div
                className={`runtime-config-row${
                  dragIndex === index ? ' runtime-config-row--dragging' : ''
                }`}
                onDragOver={(event) => handleRowDragOver(index, event)}
                onDrop={(event) => {
                  event.preventDefault()
                  commitDrop()
                }}
              >
                <span
                  className="runtime-config-row__grip"
                  title="拖动调整顺序"
                  draggable={!disabled}
                  onDragStart={(event) => handleGripDragStart(index, event)}
                  onDragEnd={clearDrag}
                />
                <span className="runtime-config-row__index" aria-hidden>
                  {index + 1}
                </span>

                <label className="runtime-config-row__id-field">
                  <span>时段 ID</span>
                  <input
                    className="field-input"
                    value={slot.id}
                    disabled={disabled}
                    spellCheck={false}
                    onChange={(event) =>
                      updateSlot(index, { id: event.target.value })
                    }
                  />
                </label>

                <label className="runtime-config-row__main">
                  <span>时段名称</span>
                  <input
                    className="field-input"
                    value={slot.label}
                    disabled={disabled}
                    onChange={(event) =>
                      updateSlot(index, { label: event.target.value })
                    }
                  />
                </label>

                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`删除时段 ${slot.label}`}
                  disabled={disabled || config.slots.length <= 1}
                  onClick={() => removeSlot(index)}
                >
                  <TrashIcon size={15} />
                </button>

                {idWarningFor(slot) && (
                  <p className="field-hint field-hint--warning runtime-config-row__warning">
                    {idWarningFor(slot)}
                  </p>
                )}
              </div>
            </Fragment>
          ))}
          {dropIndex === config.slots.length && (
            <div className="runtime-config-row__drop-line" aria-hidden />
          )}
        </div>

        <button
          type="button"
          className="button button--ghost runtime-config-add-button"
          disabled={disabled}
          onClick={addSlot}
        >
          <PlusIcon />
          添加时段
        </button>
      </div>
    </div>
  )
}
