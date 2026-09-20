import { useEffect } from 'react'
import type {
  EvgLiteralValue,
  EvgValueOperand
} from '../../../../../shared/evgData'
import {
  EVG_RUNTIME_EXTENSION_ID,
  defaultRuntimeMethodId
} from '../../../../../shared/runtimeMethods'
import type { ProjectVariable } from '../../../../../shared/variable'
import { VariableCombobox } from '../VariableCombobox'
import { ExtensionMethodEditor } from '../ExtensionMethodEditor'
import {
  convertLiteralValue,
  defaultValueForKind,
  getLiteralKind,
  type LiteralKind
} from './conditionTypeInference'

interface ConditionOperandEditorProps {
  value: EvgValueOperand
  variables: ProjectVariable[]
  expectedLiteralKinds?: LiteralKind[] | null
  /** 是否允许“扩展方法”操作数（默认允许）。 */
  allowExtensionMethod?: boolean
  disabled?: boolean
  onChange: (value: EvgValueOperand) => void
  onRemove?: () => void
}

export function ConditionOperandEditor({
  value,
  variables,
  expectedLiteralKinds = null,
  allowExtensionMethod = true,
  disabled = false,
  onChange,
  onRemove
}: ConditionOperandEditorProps) {
  useEffect(() => {
    if (value.kind !== 'literal') return
    if (!expectedLiteralKinds || expectedLiteralKinds.length !== 1) return

    const targetKind = expectedLiteralKinds[0]
    if (getLiteralKind(value.value) === targetKind) return

    onChange({
      kind: 'literal',
      value: convertLiteralValue(value.value, targetKind)
    })
  }, [expectedLiteralKinds, value, onChange])

  return (
    <div className="condition-operand">
      <div className="condition-operand__kind">
        <button
          type="button"
          className={`segmented__item${value.kind === 'literal' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() =>
            onChange({ kind: 'literal', value: defaultValueForKind('string') })
          }
        >
          字面量
        </button>
        <button
          type="button"
          className={`segmented__item${value.kind === 'variable' ? ' segmented__item--active' : ''}`}
          disabled={disabled}
          onClick={() => onChange({ kind: 'variable', variable: '' })}
        >
          变量
        </button>
        {allowExtensionMethod && (
          <button
            type="button"
            className={`segmented__item${value.kind === 'extensionMethod' ? ' segmented__item--active' : ''}`}
            disabled={disabled}
            title="调用扩展方法的返回值（canExecute / guard 判断层）"
            onClick={() =>
              onChange({
                kind: 'extensionMethod',
                extensionId: EVG_RUNTIME_EXTENSION_ID,
                methodId: defaultRuntimeMethodId(EVG_RUNTIME_EXTENSION_ID)
              })
            }
          >
            扩展方法
          </button>
        )}
      </div>

      {value.kind === 'variable' ? (
        <VariableCombobox
          value={value.variable}
          variables={variables}
          disabled={disabled}
          onChange={(variable) => onChange({ kind: 'variable', variable })}
        />
      ) : value.kind === 'extensionMethod' && !allowExtensionMethod ? (
        <p className="field-hint field-hint--warning">
          扩展方法操作数不能用作设置变量的值，请改用字面量或变量。
        </p>
      ) : value.kind === 'extensionMethod' ? (
        <ExtensionMethodEditor
          value={{
            extensionId: value.extensionId,
            methodId: value.methodId,
            args: value.args
          }}
          disabled={disabled}
          onChange={({ extensionId, methodId, args }) =>
            onChange(
              args === undefined
                ? { kind: 'extensionMethod', extensionId, methodId }
                : { kind: 'extensionMethod', extensionId, methodId, args }
            )
          }
        />
      ) : (
        <LiteralValueEditor
          value={value.value}
          forcedKind={
            expectedLiteralKinds && expectedLiteralKinds.length === 1
              ? expectedLiteralKinds[0]
              : undefined
          }
          disabled={disabled}
          onChange={(next) => onChange({ kind: 'literal', value: next })}
        />
      )}

      {onRemove && (
        <button
          type="button"
          className="icon-button icon-button--danger condition-operand__remove"
          disabled={disabled}
          aria-label="移除操作数"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  )
}

interface LiteralValueEditorProps {
  value: EvgLiteralValue
  forcedKind?: LiteralKind
  disabled: boolean
  onChange: (value: EvgLiteralValue) => void
}

function LiteralValueEditor({
  value,
  forcedKind,
  disabled,
  onChange
}: LiteralValueEditorProps) {
  const kind = forcedKind ?? getLiteralKind(value)

  return (
    <div className="literal-value">
      {!forcedKind && (
        <select
          className="field-input literal-value__type"
          value={kind}
          disabled={disabled}
          onChange={(event) => {
            const nextKind = event.target.value as LiteralKind
            onChange(defaultValueForKind(nextKind))
          }}
        >
          <option value="string">文本</option>
          <option value="number">数字</option>
          <option value="bool">布尔</option>
          <option value="null">空</option>
        </select>
      )}

      {kind === 'string' && (
        <input
          className="field-input"
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {kind === 'number' && (
        <input
          className="field-input"
          type="number"
          value={typeof value === 'number' ? String(value) : '0'}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (Number.isFinite(next)) onChange(next)
          }}
        />
      )}

      {kind === 'bool' && (
        <button
          type="button"
          className={`value-toggle${value === true ? ' value-toggle--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange(!(value === true))}
        >
          {value === true ? '真' : '假'}
        </button>
      )}

      {kind === 'null' && (
        <input className="field-input" value="null" disabled readOnly />
      )}

    </div>
  )
}
