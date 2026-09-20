import type {
  RuntimeLocationConfig,
  RuntimeMovementMode,
  RuntimeOverlayTheme
} from '../../../../shared/runtimeConfig'
import { LocationGraphEditor, type GraphLocationNode } from './LocationGraphEditor'

export type { GraphLocationNode }

/** 地点页签使用的地点候选（来自 LocationMap 行 + 章节名）。 */
export type { GraphLocationNode as LocationOption }

interface LocationConfigEditorProps {
  config: RuntimeLocationConfig
  locationOptions: GraphLocationNode[]
  disabled?: boolean
  onChange: (next: RuntimeLocationConfig) => void
}

const OVERLAY_THEME_OPTIONS: ReadonlyArray<{
  value: RuntimeOverlayTheme
  label: string
  description: string
}> = [
  {
    value: 'auto',
    label: '跟随系统',
    description: '玩家系统为深色模式时地点层用深色主题，浅色模式用浅色主题。'
  },
  {
    value: 'light',
    label: '浅色',
    description: '地点层固定使用浅色主题。'
  },
  {
    value: 'dark',
    label: '深色',
    description: '地点层固定使用深色主题。'
  }
]

const MOVEMENT_OPTIONS: ReadonlyArray<{
  value: RuntimeMovementMode
  label: string
  description: string
}> = [
  {
    value: 'free',
    label: '简单导航',
    description:
      '导航菜单列出全部启用的地点，任意互相可达。适合先跑通玩法。'
  },
  {
    value: 'graph',
    label: '连通图导航',
    description:
      '按连通图决定可移动方向，导航菜单只列出与当前地点连通的地点。'
  }
]

/**
 * 运行数据配置 · 地点页签。
 *
 * 只保存调度参数（RuntimeConfigData.location）；地点本身在“地点”页
 * 通过 LocationMap 行注册。移动动作统一走运行时槽位
 * 扩展方法 move-location（com.notarium.evg-runtime），
 * 参数 { chapterId, chapterName? }；当前位置存变量 evg.location.current。
 */
export function LocationConfigEditor({
  config,
  locationOptions,
  disabled = false,
  onChange
}: LocationConfigEditorProps) {
  const patch = (partial: Partial<RuntimeLocationConfig>): void => {
    onChange({ ...config, ...partial })
  }

  const selectable = locationOptions.filter((option) => !option.disabled)
  const currentValueIsValid =
    config.initialLocation === '' ||
    locationOptions.some((option) => option.chapterId === config.initialLocation)

  return (
    <div className="runtime-config-editor">
      <label className="field">
        <span>初始地点</span>
        <select
          className="field-input"
          value={config.initialLocation}
          disabled={disabled}
          onChange={(event) => patch({ initialLocation: event.target.value })}
        >
          <option value="">未设置（运行时回退到第一个未禁用的地点）</option>
          {(currentValueIsValid
            ? selectable
            : [
                ...selectable,
                ...locationOptions.filter(
                  (option) => option.chapterId === config.initialLocation
                )
              ]
          ).map((option) => (
            <option key={option.chapterId} value={option.chapterId}>
              {option.name}（{option.chapterId}）
            </option>
          ))}
        </select>
        <p className="field-hint">
          游戏开始时所在位置；evg.location.current 为空时用它填充。
        </p>
      </label>

      <div className="field">
        <span>导航模板</span>
        <div className="segmented">
          {MOVEMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${
                config.movement === option.value ? ' segmented__item--active' : ''
              }`}
              disabled={disabled}
              title={option.description}
              onClick={() => patch({ movement: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {MOVEMENT_OPTIONS.find((option) => option.value === config.movement)
            ?.description}
        </p>
      </div>

      <div className="field">
        <span>地点层主题</span>
        <div className="segmented">
          {OVERLAY_THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${
                (config.theme ?? 'auto') === option.value
                  ? ' segmented__item--active'
                  : ''
              }`}
              disabled={disabled}
              title={option.description}
              onClick={() => patch({ theme: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="field-hint">
          {OVERLAY_THEME_OPTIONS.find(
            (option) => (config.theme ?? 'auto') === option.value
          )?.description}
          地点层是玩家在游戏里看到的常驻界面，主题由这里的配置决定。
        </p>
      </div>

      {config.movement === 'graph' && (
        <div className="field">
          <span>连通图</span>
          <LocationGraphEditor
            nodes={locationOptions}
            connections={config.connections}
            nodePositions={config.nodePositions ?? {}}
            disabled={disabled}
            onConnectionsChange={(connections) => patch({ connections })}
            onPositionsChange={(nodePositions) => patch({ nodePositions })}
          />
        </div>
      )}
    </div>
  )
}
