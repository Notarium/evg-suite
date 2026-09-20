import type {
  AttributeType,
  AttributeValue,
  AttributeValueType
} from '../../../../shared/attribute'
import { ATTRIBUTE_VALUE_TYPE_OPTIONS } from '../../../../shared/attribute'
import { ValueEditor } from './ValueEditor'

export interface AttributePatch {
  name?: string
  type?: AttributeValueType
  defaultValue?: AttributeValue
}

interface AttributeEditorProps {
  /** 正在编辑的属性模板（草稿）。 */
  value: AttributeType
  /** 全部属性模板（草稿），用于重名提示；自身不算冲突。 */
  definitions: ReadonlyArray<AttributeType>
  disabled: boolean
  onChange: (patch: AttributePatch) => void
}

/**
 * 属性模板的实时编辑器：控件直接绑定草稿，无本地状态、无表单内保存
 * 按钮；写盘由页面右上角的「保存」统一负责。
 */
export function AttributeEditor({
  value,
  definitions,
  disabled,
  onChange
}: AttributeEditorProps) {
  const trimmedName = value.name.trim()
  const nameEmpty = trimmedName === ''
  const nameConflict = definitions.some(
    (definition) => definition.id !== value.id && definition.name === value.name
  )

  return (
    <div className="editor-form">
      <div className="editor-form__grid">
        <label className="field">
          <span>属性名</span>
          <input
            className="field-input"
            value={value.name}
            disabled={disabled}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="例如 testCharaNum"
          />
          {nameEmpty && (
            <p className="field-hint field-hint--warning">
              属性名不能为空，保存前必须填写。
            </p>
          )}
          {nameConflict && (
            <p className="field-hint field-hint--warning">
              属性名 “{value.name}” 已存在，属性名在项目内唯一。
            </p>
          )}
        </label>

        <div className="field">
          <span>类型</span>
          <div className="segmented">
            {ATTRIBUTE_VALUE_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`segmented__item${
                  value.type === option.value ? ' segmented__item--active' : ''
                }`}
                disabled={disabled}
                onClick={() => onChange({ type: option.value })}
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
            disabled={disabled}
            onChange={(next) => onChange({ defaultValue: next as AttributeValue })}
          />
        </label>
      </div>
    </div>
  )
}
