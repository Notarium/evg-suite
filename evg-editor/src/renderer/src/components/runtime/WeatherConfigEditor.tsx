import { useState } from 'react'
import type {
  RuntimeWeatherConfig,
  RuntimeWeatherDef
} from '../../../../shared/runtimeConfig'
import { createRuntimeWeatherId } from '../../../../shared/runtimeConfig'
import { PlusIcon, TrashIcon } from '../Icons'

interface WeatherConfigEditorProps {
  config: RuntimeWeatherConfig
  disabled?: boolean
  onChange: (next: RuntimeWeatherConfig) => void
}

/**
 * 运行数据配置 · 天气页签。
 *
 * 天气类型 + 权重的行列表（沿用 runtime-config-row 模板）；空清单 =
 * 项目不使用天气系统（不声明 evg.weather.current、时间推进不 roll）。
 * 权重是相对值，roll 概率 = weight / 总权重；0 = 保留条目但暂不出现。
 * 选中态按数组下标追踪（id 是可编辑字段，同物品页签的理由）。
 */
export function WeatherConfigEditor({
  config,
  disabled = false,
  onChange
}: WeatherConfigEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const updateWeather = (index: number, patch: Partial<RuntimeWeatherDef>): void => {
    onChange({
      weathers: config.weathers.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry
      )
    })
  }

  const updateSelected = (patch: Partial<RuntimeWeatherDef>): void => {
    if (selectedIndex === null) return
    updateWeather(selectedIndex, patch)
  }

  /** 天气 id 的即时提示：为空 / 与其它天气重复（保存会被主进程拒绝）。 */
  const idWarningFor = (entry: RuntimeWeatherDef): string | null => {
    if (entry.id.trim().length === 0) return '天气 id 不能为空，保存前必须填写。'
    const sameId = config.weathers.filter((item) => item.id === entry.id)
    return sameId.length > 1 ? '存在相同 id 的天气，保存会被拒绝。' : null
  }

  const removeWeather = (index: number): void => {
    onChange({ weathers: config.weathers.filter((_, i) => i !== index) })
    if (selectedIndex === index) setSelectedIndex(null)
    else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const addWeather = (): void => {
    const entry: RuntimeWeatherDef = {
      id: createRuntimeWeatherId(),
      name: '新天气',
      weight: 1
    }
    onChange({ weathers: [...config.weathers, entry] })
    setSelectedIndex(config.weathers.length)
  }

  const editingEntry =
    selectedIndex !== null ? (config.weathers[selectedIndex] ?? null) : null

  const totalWeight = config.weathers.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.weight) ? Math.max(0, entry.weight) : 0),
    0
  )

  const renderWeatherRow = (entry: RuntimeWeatherDef, index: number) => {
    const probability =
      totalWeight > 0 && entry.weight > 0
        ? ` · ${(Math.max(0, entry.weight) / totalWeight * 100).toFixed(0)}%`
        : ''

    return (
      <article
        key={`${entry.id}-${index}`}
        className={`data-item data-item--selectable${
          selectedIndex === index ? ' data-item--active' : ''
        }`}
        onClick={() => setSelectedIndex(index)}
      >
        <div className="data-item__body">
          <div className="data-item__title">
            <strong>{entry.name}</strong>
            {entry.weight <= 0 && (
              <span className="badge badge--muted">不出现</span>
            )}
          </div>
          <div className="data-item__meta">
            <span className="runtime-item-tag">{entry.id}</span>
            <span>权重 {entry.weight}{probability}</span>
          </div>
        </div>

        <div className="data-item__actions">
          <button
            type="button"
            className="icon-button icon-button--danger"
            title="删除"
            aria-label={`删除天气 ${entry.name}`}
            onClick={(event) => {
              event.stopPropagation()
              removeWeather(index)
            }}
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="master-detail-layout">
      <section className="section-card master-detail-list-panel">
        <div className="section-card__head">
          <div>
            <h2>天气清单（{config.weathers.length} 项）</h2>
            <p>空清单 = 不使用天气系统。</p>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={disabled}
            onClick={addWeather}
          >
            <PlusIcon />
            添加
          </button>
        </div>

        {config.weathers.length === 0 ? (
          <div className="data-empty">
            还没有天气。不配置即不启用天气系统；添加后时间推进时会按权重 roll。
          </div>
        ) : (
          <div className="master-detail-list">
            {config.weathers.map(renderWeatherRow)}
          </div>
        )}
      </section>

      <section className="section-card master-detail-editor-panel">
        {editingEntry ? (
          <>
            <div className="section-card__head">
              <div>
                <h2>编辑天气</h2>
                <p>修改会暂存为草稿，点击右上角“保存”写盘。</p>
              </div>
            </div>

            <label className="field">
              <span>天气 ID</span>
              <input
                className="field-input"
                value={editingEntry.id}
                disabled={disabled}
                spellCheck={false}
                onChange={(event) =>
                  updateSelected({ id: event.target.value })
                }
              />
              {idWarningFor(editingEntry) && (
                <p className="field-hint field-hint--warning">
                  {idWarningFor(editingEntry)}
                </p>
              )}
              <p className="field-hint">
                剧本条件按 id 判断（evg.weather.current = ...），建议用可读的
                语义 id（如 sunny / rain）；修改 id 会使已写入剧本的条件失效。
              </p>
            </label>

            <label className="field">
              <span>名称</span>
              <input
                className="field-input"
                value={editingEntry.name}
                disabled={disabled}
                placeholder="overlay 展示用（如 晴 / 雨）"
                onChange={(event) =>
                  updateSelected({ name: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>权重</span>
              <input
                className="field-input"
                type="number"
                min={0}
                max={999999}
                value={editingEntry.weight}
                disabled={disabled}
                onChange={(event) => {
                  const weight = Number(event.target.value)
                  if (!Number.isFinite(weight)) return
                  updateSelected({ weight })
                }}
              />
              <p className="field-hint">
                相对权重，roll 概率 = 权重 ÷ 总权重；0 = 暂不出现（条目保留）。
              </p>
            </label>
          </>
        ) : (
          <div className="data-empty">
            从左侧选择一个天气，或点击“添加”。
          </div>
        )}
      </section>
    </div>
  )
}
