import { EVG_ACTION_PURPOSE, type ActionPurpose } from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import { ConditionBindingEditor } from '../condition/ConditionBindingEditor'
import type { ConditionOption } from '../condition/ConditionEditor'
import { ActionDataEditor } from './ActionDataEditor'
import {
  CORE_ACTION_PURPOSE_OPTIONS,
  EVG_METHOD_PRESETS,
  createDataForMethodPreset,
  createActionDataForPurpose,
  getActionPurposeOption,
  matchActionMethodPreset,
  type ActionValue
} from './actionOptions'

interface ActionEditorProps {
  value: ActionValue
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  conditions?: ConditionOption[]
  disabled?: boolean
  onChange: (value: ActionValue) => void
}

export function ActionEditor({
  value,
  variables,
  chapters = [],
  conditions = [],
  disabled = false,
  onChange
}: ActionEditorProps) {
  const currentPurpose = getActionPurposeOption(value.type)

  const choosePurpose = (type: ActionPurpose): void => {
    if (type === value.type) return
    onChange({
      ...value,
      type,
      data: createActionDataForPurpose(type)
    })
  }

  return (
    <div className="action-editor">
      <div className="action-editor__section">
        <span className="action-editor__section-label">动作类型</span>
        <div className="segmented action-purpose-group">
          {CORE_ACTION_PURPOSE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              title={`${option.label}：${option.description}`}
              className={`segmented__item${
                value.type === option.value ? ' segmented__item--active' : ''
              }`}
              disabled={disabled}
              onClick={() => choosePurpose(option.value)}
            >
              {option.label}
            </button>
          ))}

          {!currentPurpose && (
            <button
              type="button"
              className="segmented__item segmented__item--active"
              disabled
              title="扩展 action 暂时没有可视化类型编辑器"
            >
              扩展 {String(value.type)}
            </button>
          )}
        </div>

        {value.type === EVG_ACTION_PURPOSE.CallExtensionMethod && (
          <div className="action-purpose-group">
            <span className="action-purpose-group__label">内置方法</span>
            <div className="segmented">
              {EVG_METHOD_PRESETS.map((preset) => {
                const active =
                  matchActionMethodPreset(
                    String(
                      (value.data as { extensionId?: unknown } | null)?.extensionId ?? ''
                    ),
                    String((value.data as { methodId?: unknown } | null)?.methodId ?? '')
                  ) === preset
                return (
                  <button
                    key={preset.methodId}
                    type="button"
                    title={`${preset.label}：${preset.description}`}
                    className={`segmented__item${active ? ' segmented__item--active' : ''}`}
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...value,
                        type: EVG_ACTION_PURPOSE.CallExtensionMethod,
                        data: createDataForMethodPreset(preset)
                      })
                    }
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <label className="field">
        <span>名称</span>
        <input
          className="field-input"
          value={value.label}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, label: event.target.value })}
        />
      </label>

      <ActionDataEditor
        value={value}
        variables={variables}
        chapters={chapters}
        disabled={disabled}
        onChange={onChange}
      />

      <div className="action-editor__section">
        <span className="action-editor__section-label">执行条件</span>
        <ConditionBindingEditor
          value={value.guard}
          variables={variables}
          conditions={conditions}
          disabled={disabled}
          onChange={(guard) => onChange({ ...value, guard })}
        />
      </div>
    </div>
  )
}
