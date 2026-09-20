import type {
  ProjectVariable,
  VariableType
} from '../../../../shared/variable'
import {
  VARIABLE_PERSISTENCE_OPTIONS,
  VARIABLE_TYPE_OPTIONS
} from '../../../../shared/variable'
import { ValueEditor } from './ValueEditor'
import type { VariablePatch } from '../../stores/useVariableEditorStore'

interface VariableEditorProps {
  /** 正在编辑的变量（草稿）。 */
  value: ProjectVariable
  /** 全部变量（草稿），用于重名提示；自身不算冲突。 */
  variables: ReadonlyArray<ProjectVariable>
  disabled: boolean
  /** 系统变量只读：名字 / 类型 / 持久化 / 默认值均不可改。 */
  readOnly?: boolean
  onChange: (patch: VariablePatch) => void
}

/**
 * 变量的实时编辑器：控件直接绑定草稿，无本地状态、无表单内保存按钮；
 * 写盘由页面右上角的「保存」统一负责。重名 / 空名提示是展示性的，
 * 不阻塞保存——非法数据由主进程写入校验拒绝并走错误横幅。
 */
export function VariableEditor({
  value,
  variables,
  disabled,
  readOnly = false,
  onChange
}: VariableEditorProps) {
  const fieldDisabled = disabled || readOnly
  const trimmedName = value.name.trim()
  const nameEmpty = trimmedName === ''
  const nameConflict = variables.some(
    (variable) => variable.id !== value.id && variable.name === value.name
  )

  // pending 只允许保留，不允许主动改入（与原表单行为一致）。
  const typeOptions =
    value.type === 'pending'
      ? VARIABLE_TYPE_OPTIONS
      : VARIABLE_TYPE_OPTIONS.filter((option) => option.value !== 'pending')

  return (
    <div className="editor-form">
      <div className="editor-form__grid">
        <label className="field">
          <span>变量名</span>
          <input
            className="field-input"
            value={value.name}
            disabled={fieldDisabled}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="例如 player-name"
          />
          {nameEmpty && (
            <p className="field-hint field-hint--warning">
              变量名不能为空，保存前必须填写。
            </p>
          )}
          {nameConflict && (
            <p className="field-hint field-hint--warning">
              变量名 “{value.name}” 已存在，变量名在项目内唯一。
            </p>
          )}
        </label>

        <div className="field">
          <span>类型</span>
          <div className="segmented">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented__item${
                  value.type === option.value ? ' segmented__item--active' : ''
                }`}
                disabled={fieldDisabled}
                onClick={() => onChange({ type: option.value as VariableType })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>持久化</span>
          <div className="segmented">
            {VARIABLE_PERSISTENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented__item${
                  value.persistence === option.value ? ' segmented__item--active' : ''
                }`}
                disabled={fieldDisabled}
                onClick={() => onChange({ persistence: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field field--wide">
          <span>默认值</span>
          <ValueEditor
            type={value.type}
            value={value.defaultValue}
            disabled={fieldDisabled}
            onChange={(next) => onChange({ defaultValue: next })}
          />
        </label>
      </div>
    </div>
  )
}
