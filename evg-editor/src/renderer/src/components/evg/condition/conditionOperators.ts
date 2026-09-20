import type {
  ConditionPredicate,
  ConditionPredicateOperator,
  ConditionNode,
  ConditionType,
  EvgValueOperand
} from '../../../../../shared/evgData'

export interface ConditionOperatorOption {
  value: ConditionPredicateOperator
  label: string
  group: '基础比较' | '存在性'
  minOperands: number
  maxOperands: number | null
  symbol: string
  description: string
}

export const CONDITION_OPERATOR_OPTIONS: readonly ConditionOperatorOption[] = [
  { value: 'eq', label: '等于', group: '基础比较', minOperands: 2, maxOperands: null, symbol: '=', description: '全部操作数相等' },
  { value: 'ne', label: '不等于', group: '基础比较', minOperands: 2, maxOperands: null, symbol: '≠', description: '操作数两两不相等' },
  { value: 'gt', label: '大于', group: '基础比较', minOperands: 2, maxOperands: 2, symbol: '>', description: '二元比较' },
  { value: 'gte', label: '大于等于', group: '基础比较', minOperands: 2, maxOperands: 2, symbol: '≥', description: '二元比较' },
  { value: 'lt', label: '小于', group: '基础比较', minOperands: 2, maxOperands: 2, symbol: '<', description: '二元比较' },
  { value: 'lte', label: '小于等于', group: '基础比较', minOperands: 2, maxOperands: 2, symbol: '≤', description: '二元比较' },
  { value: 'exists', label: '存在', group: '存在性', minOperands: 1, maxOperands: 1, symbol: '存在', description: '变量是否存在' }
]

export function getConditionOperatorOption(
  operator: ConditionPredicateOperator
): ConditionOperatorOption | undefined {
  return (CONDITION_OPERATOR_OPTIONS as readonly ConditionOperatorOption[]).find(
    (option) => option.value === operator
  )
}

export function createDefaultOperand(): EvgValueOperand {
  return { kind: 'literal', value: '' }
}

export function createDefaultPredicate(): ConditionPredicate {
  return {
    kind: 'predicate',
    operator: 'eq',
    operands: [createDefaultOperand(), createDefaultOperand()]
  }
}

export function createDefaultCondition(): ConditionType {
  return createDefaultPredicate()
}

export function createConditionForKind(
  kind: ConditionNode['kind']
): ConditionType {
  switch (kind) {
    case 'predicate':
      return createDefaultPredicate()
    case 'and':
      return { kind: 'and', children: [createDefaultPredicate()] }
    case 'or':
      return { kind: 'or', children: [createDefaultPredicate()] }
    case 'not':
      return { kind: 'not', child: createDefaultPredicate() }
    case 'constant':
      return { kind: 'constant', value: true }
  }
}

/**
 * 根据 operator 的 arity 调整 operands。
 *
 * eq / ne 保持“至少 2 个”，其它 operator 按 min/max 收窄或补齐。
 */
export function normalizePredicateOperands(
  operator: ConditionPredicateOperator,
  operands: EvgValueOperand[]
): EvgValueOperand[] {
  const option = getConditionOperatorOption(operator)
  const min = option?.minOperands ?? 2
  const max = option?.maxOperands ?? null

  const next = [...operands]

  while (next.length < min) {
    next.push(createDefaultOperand())
  }

  if (max !== null && next.length > max) {
    next.length = max
  }

  return next
}