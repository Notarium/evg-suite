import type {
  ConditionPredicateOperator,
  ConditionExpression,
  ConditionNode,
  ConditionType,
  EvgValueOperand
} from '../../../../../shared/evgData'
import type { ProjectVariable } from '../../../../../shared/variable'
import { PlusIcon, TrashIcon } from '../../Icons'
import { ConditionOperandEditor } from './ConditionOperandEditor'
import {
  CONDITION_OPERATOR_OPTIONS,
  createConditionForKind,
  createDefaultPredicate,
  createDefaultOperand,
  getConditionOperatorOption,
  normalizePredicateOperands
} from './conditionOperators'
import { inferExpectedLiteralKinds } from './conditionTypeInference'

export interface ConditionOption {
  key: string
  label?: string
}

interface ConditionEditorProps {
  value: ConditionType
  variables: ProjectVariable[]
  conditionOptions?: ConditionOption[]
  disabled?: boolean
  onChange: (value: ConditionType) => void
}

const NODE_KIND_LABELS: Record<ConditionNode['kind'], string> = {
  predicate: '判定',
  and: '并且',
  or: '或者',
  not: '非',
  constant: '常量'
}

/**
 * 构造谓词节点。
 *
 * operands 已经在 normalizePredicateOperands 中按 operator 调整过，
 * 这里的 cast 只是把运行时正确的数组对齐到 TS 的元组联合类型。
 */
function toPredicate(
  operator: ConditionPredicateOperator,
  operands: EvgValueOperand[]
): Extract<ConditionType, { kind: 'predicate' }> {
  return {
    kind: 'predicate',
    operator,
    operands: normalizePredicateOperands(operator, operands)
  } as Extract<ConditionType, { kind: 'predicate' }>
}

export function ConditionEditor({
  value,
  variables,
  conditionOptions = [],
  disabled = false,
  onChange
}: ConditionEditorProps) {
  return (
    <div className="condition-editor">
      <ConditionNodeEditor
        value={value}
        variables={variables}
        conditionOptions={conditionOptions}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}

interface ConditionNodeEditorProps {
  value: ConditionNode
  variables: ProjectVariable[]
  conditionOptions: ConditionOption[]
  disabled: boolean
  onChange: (value: ConditionType) => void
}

function ConditionNodeEditor({
  value,
  variables,
  conditionOptions,
  disabled,
  onChange
}: ConditionNodeEditorProps) {
  const nodeKind = value.kind

  return (
    <div className={`condition-node condition-node--${nodeKind}`}>
      <div className="condition-node__head">
        <div className="condition-node__kinds">
          <div className="segmented">
            {(['predicate', 'constant'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`segmented__item${
                  nodeKind === kind ? ' segmented__item--active' : ''
                }`}
                disabled={disabled}
                onClick={() => onChange(createConditionForKind(kind))}
              >
                {NODE_KIND_LABELS[kind]}
              </button>
            ))}
          </div>

          <div className="segmented">
            {(['not', 'and', 'or'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                className={`segmented__item${
                  nodeKind === kind ? ' segmented__item--active' : ''
                }`}
                disabled={disabled}
                onClick={() => onChange(createConditionForKind(kind))}
              >
                {NODE_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {value.kind === 'predicate' && (
        <PredicateEditor
          value={value}
          variables={variables}
          disabled={disabled}
          onChange={onChange}
        />
      )}

      {value.kind === 'constant' && (
        <button
          type="button"
          className={`value-toggle${value.value ? ' value-toggle--on' : ''}`}
          disabled={disabled}
          onClick={() => onChange({ kind: 'constant', value: !value.value })}
        >
          {value.value ? '真' : '假'}
        </button>
      )}

      {(value.kind === 'and' || value.kind === 'or') && (
        <div className="condition-children">
          {value.children.map((child, index) => (
            <ConditionExpressionEditor
              key={index}
              value={child}
              variables={variables}
              conditionOptions={conditionOptions}
              disabled={disabled}
              onChange={(nextChild) => {
                const nextChildren = [...value.children]
                nextChildren[index] = nextChild
                onChange({ kind: value.kind, children: nextChildren })
              }}
              onRemove={() => {
                const nextChildren = value.children.filter(
                  (_, childIndex) => childIndex !== index
                )
                onChange({ kind: value.kind, children: nextChildren })
              }}
            />
          ))}

          <div className="condition-children__actions">
            <button
              type="button"
              className="button button--ghost condition-add-button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  kind: value.kind,
                  children: [...value.children, createDefaultPredicate()]
                })
              }
            >
              <PlusIcon />
              添加内联条件
            </button>
            {conditionOptions.length > 0 && (
              <button
                type="button"
                className="button button--ghost condition-add-button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    kind: value.kind,
                    children: [...value.children, conditionOptions[0].key]
                  })
                }
              >
                <PlusIcon />
                添加条件引用
              </button>
            )}
          </div>
        </div>
      )}

      {value.kind === 'not' && (
        <ConditionExpressionEditor
          value={value.child}
          variables={variables}
          conditionOptions={conditionOptions}
          disabled={disabled}
          onChange={(nextChild) => onChange({ kind: 'not', child: nextChild })}
        />
      )}
    </div>
  )
}

interface PredicateEditorProps {
  value: Extract<ConditionType, { kind: 'predicate' }>
  variables: ProjectVariable[]
  disabled: boolean
  onChange: (value: ConditionType) => void
}

function PredicateEditor({
  value,
  variables,
  disabled,
  onChange
}: PredicateEditorProps) {
  const option = getConditionOperatorOption(value.operator)
  const min = option?.minOperands ?? 2
  const max = option?.maxOperands ?? null
  const canAdd = max === null || value.operands.length < max

  const valueOptions = CONDITION_OPERATOR_OPTIONS.filter(
    (operator) => operator.value !== 'exists'
  )
  const existenceOptions = CONDITION_OPERATOR_OPTIONS.filter(
    (operator) => operator.value === 'exists'
  )

  return (
    <div className="condition-predicate">
      <div className="condition-operator-groups">
        <div className="segmented">
          {valueOptions.map((operator) => (
            <button
              key={operator.value}
              type="button"
              title={`${operator.label}：${operator.description}`}
              className={`segmented__item${
                value.operator === operator.value
                  ? ' segmented__item--active'
                  : ''
              }`}
              disabled={disabled}
              onClick={() =>
                onChange(toPredicate(operator.value, value.operands))
              }
            >
              {operator.symbol}
            </button>
          ))}
        </div>

        <div className="segmented">
          {existenceOptions.map((operator) => (
            <button
              key={operator.value}
              type="button"
              title={`${operator.label}：${operator.description}`}
              className={`segmented__item${
                value.operator === operator.value
                  ? ' segmented__item--active'
                  : ''
              }`}
              disabled={disabled}
              onClick={() =>
                onChange(toPredicate(operator.value, value.operands))
              }
            >
              {operator.symbol}
            </button>
          ))}
        </div>
      </div>

      <div className="condition-operands">
        {value.operands.map((operand, index) => (
          <ConditionOperandEditor
            key={index}
            value={operand}
            variables={variables}
            expectedLiteralKinds={inferExpectedLiteralKinds(
              value.operator,
              value.operands,
              index,
              variables
            )}
            disabled={disabled}
            onChange={(nextOperand) => {
              const operands = [...value.operands]
              operands[index] = nextOperand
              onChange(toPredicate(value.operator, operands))
            }}
            onRemove={
              value.operands.length > min
                ? () => {
                    onChange(
                      toPredicate(
                        value.operator,
                        value.operands.filter(
                          (_, operandIndex) => operandIndex !== index
                        )
                      )
                    )
                  }
                : undefined
            }
          />
        ))}
      </div>

      {canAdd && (
        <button
          type="button"
          className="button button--ghost condition-add-button"
          disabled={disabled}
          onClick={() =>
            onChange(
              toPredicate(value.operator, [
                ...value.operands,
                createDefaultOperand()
              ])
            )
          }
        >
          <PlusIcon />
          添加操作数
        </button>
      )}
    </div>
  )
}

interface ConditionExpressionEditorProps {
  value: ConditionExpression
  variables: ProjectVariable[]
  conditionOptions: ConditionOption[]
  disabled: boolean
  onChange: (value: ConditionExpression) => void
  onRemove?: () => void
}

function ConditionExpressionEditor({
  value,
  variables,
  conditionOptions,
  disabled,
  onChange,
  onRemove
}: ConditionExpressionEditorProps) {
  if (typeof value === 'string') {
    return (
      <div className="condition-expression">
        <div className="condition-expression__head">
          <span className="condition-expression__label">引用条件</span>
          <div className="condition-expression__actions">
            <button
              type="button"
              className="button button--ghost"
              disabled={disabled}
              onClick={() => onChange(createDefaultPredicate())}
            >
              转为内联
            </button>
            {onRemove && (
              <button
                type="button"
                className="icon-button icon-button--danger"
                disabled={disabled}
                aria-label="移除条件"
                onClick={onRemove}
              >
                <TrashIcon size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="condition-expression__body">
          <select
            className="field-input"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          >
            {conditionOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label ?? option.key}
              </option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="condition-expression">
      <div className="condition-expression__head">
        <span className="condition-expression__label">内联条件</span>
        <div className="condition-expression__actions">
          {conditionOptions.length > 0 && (
            <button
              type="button"
              className="button button--ghost"
              disabled={disabled}
              onClick={() => onChange(conditionOptions[0].key)}
            >
              转为引用
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              className="icon-button icon-button--danger"
              disabled={disabled}
              aria-label="移除条件"
              onClick={onRemove}
            >
              <TrashIcon size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="condition-expression__body">
        <ConditionNodeEditor
          value={value}
          variables={variables}
          conditionOptions={conditionOptions}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
