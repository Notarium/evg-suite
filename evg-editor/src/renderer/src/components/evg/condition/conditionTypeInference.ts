import type {
  ConditionPredicateOperator,
  EvgLiteralValue,
  EvgValueOperand
} from '../../../../../shared/evgData'
import { findRuntimeMethodSpec } from '../../../../../shared/runtimeMethods'
import type { ProjectVariable, VariableType } from '../../../../../shared/variable'

export type LiteralKind = 'string' | 'number' | 'bool' | 'null'

export type InferredValueType = 'string' | 'number' | 'bool' | 'unknown'

export function getLiteralKind(value: EvgLiteralValue): LiteralKind {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'bool'
  return 'null'
}

export function defaultValueForKind(kind: LiteralKind): EvgLiteralValue {
  switch (kind) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'bool':
      return false
    case 'null':
      return null
  }
}

function variableTypeToInferred(type: VariableType): InferredValueType {
  switch (type) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'bool':
      return 'bool'
    case 'pending':
      return 'unknown'
  }
}

export function getOperandInferredType(
  operand: EvgValueOperand,
  variables: ProjectVariable[]
): InferredValueType {
  if (operand.kind === 'variable') {
    const variable = variables.find((item) => item.name === operand.variable)
    return variable ? variableTypeToInferred(variable.type) : 'unknown'
  }

  // extensionMethod 的返回类型取自内置方法清单（runtimeMethods.ts）；
  // 清单未登记的方法不做推断。
  if (operand.kind === 'extensionMethod') {
    const returns = findRuntimeMethodSpec(
      operand.extensionId,
      operand.methodId
    )?.returns
    if (returns === 'boolean') return 'bool'
    if (returns === 'number') return 'number'
    if (returns === 'string') return 'string'
    return 'unknown'
  }

  const literalKind = getLiteralKind(operand.value)
  return literalKind === 'null' ? 'unknown' : literalKind
}

/**
 * 根据 operator、操作数位置和另一侧的类型，推导当前字面量应该是什么类型。
 *
 * 返回 null 表示不做限制。
 */
export function inferExpectedLiteralKinds(
  operator: ConditionPredicateOperator,
  operands: EvgValueOperand[],
  index: number,
  variables: ProjectVariable[]
): LiteralKind[] | null {
  const sibling = operands[index === 0 ? 1 : 0]
  if (!sibling) return null

  const siblingType = getOperandInferredType(sibling, variables)

  switch (operator) {
    case 'eq':
    case 'ne':
      if (siblingType === 'string') return ['string']
      if (siblingType === 'number') return ['number']
      if (siblingType === 'bool') return ['bool']
      return null

    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      if (siblingType === 'string') return ['string']
      if (siblingType === 'number') return ['number']
      return null

    case 'exists':
      return null
  }
}

/** 在保持尽可能多信息的前提下，把字面量转换成目标类型。 */
export function convertLiteralValue(
  value: EvgLiteralValue,
  targetKind: LiteralKind
): EvgLiteralValue {
  switch (targetKind) {
    case 'string':
      if (typeof value === 'string') return value
      if (value === null) return ''
      return String(value)

    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
      ) {
        return Number(value)
      }
      if (typeof value === 'boolean') return value ? 1 : 0
      return 0

    case 'bool':
      return Boolean(value)

    case 'null':
      return null
  }
}
