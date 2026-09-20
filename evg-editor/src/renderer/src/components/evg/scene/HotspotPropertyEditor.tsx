import type { SceneHotspot } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { TrashIcon } from '../../Icons'
import type { ConditionOption } from '../condition/ConditionEditor'
import { EventBindingEditor } from '../event/EventBindingEditor'
import type { ActionOption } from '../action/actionOptions'
import type { EventOption } from '../event/eventOptions'

interface HotspotPropertyEditorProps {
  hotspot: SceneHotspot
  resolution: { width: number; height: number }
  variables: ProjectVariable[]
  chapters: ChapterSummary[]
  conditions: ConditionOption[]
  actions: ActionOption[]
  events: EventOption[]
  /** 事件动作链中 CallFragment 的章节静态检查结果（由页面计算传入）。 */
  fragmentIssues?: readonly string[]
  disabled?: boolean
  onChange: (patch: Partial<SceneHotspot>) => void
  onRemove: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundPx(value: number): number {
  return Math.round(value * 10) / 10
}

function toPxX(value: number, resolution: { width: number; height: number }): number {
  return roundPx(value * resolution.width)
}

function toPxY(value: number, resolution: { width: number; height: number }): number {
  return roundPx(value * resolution.height)
}

function toPxRadius(
  value: number,
  resolution: { width: number; height: number }
): number {
  return roundPx(value * Math.min(resolution.width, resolution.height))
}

function toPxWidth(value: number, resolution: { width: number; height: number }): number {
  return roundPx(value * resolution.width)
}

function toPxHeight(value: number, resolution: { width: number; height: number }): number {
  return roundPx(value * resolution.height)
}

export function HotspotPropertyEditor({
  hotspot,
  resolution,
  variables,
  chapters,
  conditions,
  actions,
  events,
  fragmentIssues,
  disabled = false,
  onChange,
  onRemove
}: HotspotPropertyEditorProps) {
  const { shape } = hotspot
  const shortSide = Math.min(resolution.width, resolution.height)

  const setShapeX = (px: number): void => {
    const x = clamp(px / resolution.width, 0, 1)
    onChange({
      shape:
        shape.kind === 'circle'
          ? { ...shape, x }
          : { ...shape, x: clamp(x, 0, 1 - shape.width) }
    })
  }

  const setShapeY = (px: number): void => {
    const y = clamp(px / resolution.height, 0, 1)
    onChange({
      shape:
        shape.kind === 'circle'
          ? { ...shape, y }
          : { ...shape, y: clamp(y, 0, 1 - shape.height) }
    })
  }

  const setCircleRadius = (px: number): void => {
    if (shape.kind !== 'circle') return
    onChange({
      shape: {
        ...shape,
        radius: clamp(px / shortSide, 0.01, 0.5)
      }
    })
  }

  const setRectWidth = (px: number): void => {
    if (shape.kind !== 'rect') return
    const width = clamp(px / resolution.width, 0.01, 1)
    onChange({
      shape: {
        ...shape,
        width,
        x: clamp(shape.x, 0, 1 - width)
      }
    })
  }

  const setRectHeight = (px: number): void => {
    if (shape.kind !== 'rect') return
    const height = clamp(px / resolution.height, 0.01, 1)
    onChange({
      shape: {
        ...shape,
        height,
        y: clamp(shape.y, 0, 1 - height)
      }
    })
  }

  return (
    <div className="hotspot-property-editor">
      <label className="field">
        <span>名称</span>
        <input
          className="field-input"
          value={hotspot.label}
          disabled={disabled}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </label>

      <div className="field">
        <span>状态</span>
        <button
          type="button"
          className={`value-toggle${hotspot.enabled ? ' value-toggle--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange({ enabled: !hotspot.enabled })}
        >
          {hotspot.enabled ? '启用' : '禁用'}
        </button>
      </div>

      <label className="field">
        <span>X 位置（px）</span>
        <input
          className="field-input"
          type="number"
          min={0}
          max={resolution.width}
          step={1}
          value={toPxX(shape.x, resolution)}
          disabled={disabled}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (!Number.isFinite(value)) return
            setShapeX(value)
          }}
        />
      </label>

      <label className="field">
        <span>Y 位置（px）</span>
        <input
          className="field-input"
          type="number"
          min={0}
          max={resolution.height}
          step={1}
          value={toPxY(shape.y, resolution)}
          disabled={disabled}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (!Number.isFinite(value)) return
            setShapeY(value)
          }}
        />
      </label>

      {shape.kind === 'circle' ? (
        <label className="field">
          <span>半径（px）</span>
          <input
            className="field-input"
            type="number"
            min={1}
            max={Math.round(shortSide / 2)}
            step={1}
            value={toPxRadius(shape.radius, resolution)}
            disabled={disabled}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isFinite(value)) return
              setCircleRadius(value)
            }}
          />
        </label>
      ) : (
        <>
          <label className="field">
            <span>宽度（px）</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={resolution.width}
              step={1}
              value={toPxWidth(shape.width, resolution)}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                setRectWidth(value)
              }}
            />
          </label>

          <label className="field">
            <span>高度（px）</span>
            <input
              className="field-input"
              type="number"
              min={1}
              max={resolution.height}
              step={1}
              value={toPxHeight(shape.height, resolution)}
              disabled={disabled}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (!Number.isFinite(value)) return
                setRectHeight(value)
              }}
            />
          </label>
        </>
      )}

      <div className="event-editor__section">
        <span className="event-editor__section-label">点击事件</span>
        <EventBindingEditor
          value={hotspot.event}
          variables={variables}
          chapters={chapters}
          conditions={conditions}
          actions={actions}
          events={events}
          disabled={disabled}
          onChange={(event) => onChange({ event })}
        />

        {fragmentIssues && fragmentIssues.length > 0 && (
          <div className="field">
            <span>片段检查</span>
            {fragmentIssues.map((issue) => (
              <p
                key={issue}
                className="field-hint field-hint--warning"
              >
                {issue}
              </p>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="button button--danger"
        disabled={disabled}
        onClick={onRemove}
      >
        <TrashIcon size={15} />
        删除热点
      </button>
    </div>
  )
}
