/**
 * EVG Data 公共契约的结构校验。
 *
 * 职责：在写入落盘前校验每条 evg-data 记录的 data 是否符合 Common.md 定义的结构。
 *
 * 校验原则：
 * - 只做“结构合法”校验，不做“业务完整”校验。例如 SetVariable 的 variable
 *   允许暂时为空字符串，因为编辑器允许先建后填，运行时自然会忽略半成品；
 * - 引用合法性（ConditionRef / ActionRef / EventRef 是否存在）不在写入时强校验，
 *   由编辑器删除流程负责提示；
 * - 引擎保留类型 1-4 严格校验；Runtime 运行配置（type=1000，见
 *   runtimeConfig.ts）校验其设置对象结构；其它扩展自定义行类型不校验。
 *
 * 本文件只引用 ./evgData 与 ./runtimeConfig（两者均零外部依赖），
 * 可随契约一起被复制共享。
 */

import { EVG_DATA_KIND, EVG_ACTION_PURPOSE } from './evgData'
import {
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  validateRuntimeConfigData
} from './runtimeConfig'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const CONDITION_PREDICATE_OPERATORS: ReadonlySet<string> = new Set([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'exists'
])

const CONDITION_ORDERING_OPERATORS: ReadonlySet<string> = new Set([
  'gt',
  'gte',
  'lt',
  'lte'
])

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/* ==========================================================================
 * 操作数
 * ========================================================================== */

export function validateEvgValueOperand(
  value: unknown,
  where: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }

  if (value.kind === 'literal') {
    const literal = value.value
    if (
      typeof literal !== 'string' &&
      typeof literal !== 'number' &&
      typeof literal !== 'boolean' &&
      literal !== null
    ) {
      return `${where}.value 必须是 string / number / boolean / null 字面量`
    }
    return null
  }

  if (value.kind === 'variable') {
    if (typeof value.variable !== 'string') {
      return `${where}.variable 必须是字符串`
    }
    return null
  }

  if (value.kind === 'extensionMethod') {
    if (!isNonEmptyString(value.extensionId)) {
      return `${where}.extensionId 必须是非空字符串`
    }
    if (!isNonEmptyString(value.methodId)) {
      return `${where}.methodId 必须是非空字符串`
    }
    return null
  }

  return `${where}.kind 必须是 literal / variable / extensionMethod`
}

/* ==========================================================================
 * 条件
 * ========================================================================== */

export function validateConditionBinding(
  value: unknown,
  where: string
): string | null {
  if (value === true) return null
  return validateConditionExpression(value, where)
}

export function validateConditionExpression(
  value: unknown,
  where: string
): string | null {
  if (typeof value === 'string') {
    return isNonEmptyString(value) ? null : `${where} 引用 id 不能为空`
  }
  return validateConditionType(value, where)
}

export function validateConditionType(
  value: unknown,
  where: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }

  switch (value.kind) {
    case 'predicate':
      return validateConditionPredicate(value, where)
    case 'and':
    case 'or': {
      if (!Array.isArray(value.children)) {
        return `${where}.children 必须是数组`
      }
      for (const [index, child] of value.children.entries()) {
        const issue = validateConditionExpression(
          child,
          `${where}.children[${index}]`
        )
        if (issue) return issue
      }
      return null
    }
    case 'not':
      return validateConditionExpression(value.child, `${where}.child`)
    case 'constant':
      return typeof value.value === 'boolean'
        ? null
        : `${where}.value 必须是布尔值`
    default:
      return `${where}.kind 不是支持的节点类型`
  }
}

function validateConditionPredicate(
  value: Record<string, unknown>,
  where: string
): string | null {
  const operator = value.operator

  if (typeof operator !== 'string' || !CONDITION_PREDICATE_OPERATORS.has(operator)) {
    return `${where}.operator 不是支持的谓词运算符`
  }
  if (!Array.isArray(value.operands)) {
    return `${where}.operands 必须是数组`
  }

  if (operator === 'exists') {
    if (value.operands.length !== 1) {
      return `${where}.operands 的 exists 判断必须恰好有 1 个操作数`
    }
  } else if (CONDITION_ORDERING_OPERATORS.has(operator)) {
    if (value.operands.length !== 2) {
      return `${where}.operands 的大小比较必须恰好有 2 个操作数`
    }
  } else if (value.operands.length < 2) {
    return `${where}.operands 的 ${operator} 判断至少需要 2 个操作数`
  }

  for (const [index, operand] of value.operands.entries()) {
    const issue = validateEvgValueOperand(operand, `${where}.operands[${index}]`)
    if (issue) return issue
  }

  return null
}

/* ==========================================================================
 * Action
 * ========================================================================== */

function validateActionDataForPurpose(
  purpose: number,
  data: unknown,
  where: string
): string | null {
  if (!isRecord(data)) {
    return `${where} 必须是对象`
  }

  switch (purpose) {
    case EVG_ACTION_PURPOSE.SetVariable: {
      if (typeof data.variable !== 'string') {
        return `${where}.variable 必须是字符串`
      }
      // value 允许字面量 / 变量 / 扩展方法（把方法返回值写入变量），
      // 结构校验与条件操作数同口径。
      return validateEvgValueOperand(data.value, `${where}.value`)
    }
    case EVG_ACTION_PURPOSE.CallFragment:
      if (typeof data.fragmentId !== 'string') {
        return `${where}.fragmentId 必须是字符串`
      }
      if (
        data.chapterId !== undefined &&
        typeof data.chapterId !== 'string'
      ) {
        return `${where}.chapterId 必须是字符串`
      }
      return null
    case EVG_ACTION_PURPOSE.CallExtensionMethod:
      if (!isNonEmptyString(data.extensionId)) {
        return `${where}.extensionId 必须是非空字符串`
      }
      if (!isNonEmptyString(data.methodId)) {
        return `${where}.methodId 必须是非空字符串`
      }
      if (data.args !== undefined && !isRecord(data.args)) {
        return `${where}.args 必须是参数对象`
      }
      return null
    case EVG_ACTION_PURPOSE.CallSystemSlot:
      if (typeof data.slot !== 'string') {
        return `${where}.slot 必须是字符串`
      }
      return null
    default:
      // 扩展自定义 purpose 的 data 形状由扩展自己定义，不做校验。
      return null
  }
}

export function validateActionValue(
  value: unknown,
  where: string,
  expectedId?: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }
  if (!isNonEmptyString(value.id)) {
    return `${where} 缺少有效的 id`
  }
  if (expectedId !== undefined && value.id !== expectedId) {
    return `${where}.id 必须等于行 key`
  }
  if (typeof value.label !== 'string') {
    return `${where} 缺少 label`
  }

  const guardIssue = validateConditionBinding(value.guard, `${where}.guard`)
  if (guardIssue) return guardIssue

  if (typeof value.type !== 'number' || !Number.isFinite(value.type)) {
    return `${where} 的 type 必须是有效数字`
  }
  if (value.data === undefined) {
    return `${where} 缺少 data`
  }

  return validateActionDataForPurpose(value.type, value.data, where)
}

export function validateActionBinding(
  value: unknown,
  where: string
): string | null {
  if (typeof value === 'string') {
    return isNonEmptyString(value) ? null : `${where} 引用 id 不能为空`
  }
  return validateActionValue(value, where)
}

/* ==========================================================================
 * Event
 * ========================================================================== */

export function validateEventValue(
  value: unknown,
  where: string,
  expectedId?: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }
  if (!isNonEmptyString(value.id)) {
    return `${where} 缺少有效的 id`
  }
  if (expectedId !== undefined && value.id !== expectedId) {
    return `${where}.id 必须等于行 key`
  }
  if (typeof value.label !== 'string') {
    return `${where} 缺少 label`
  }

  const canExecuteIssue = validateConditionBinding(
    value.canExecute,
    `${where}.canExecute`
  )
  if (canExecuteIssue) return canExecuteIssue

  if (!Array.isArray(value.actions)) {
    return `${where}.actions 必须是数组`
  }
  for (const [index, effect] of value.actions.entries()) {
    const issue = validateActionBinding(effect, `${where}.actions[${index}]`)
    if (issue) return issue
  }

  return null
}

/* ==========================================================================
 * LocationMap
 * ========================================================================== */

function validateSceneHotspotShape(
  value: unknown,
  where: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }

  const isFiniteNumber = (input: unknown): input is number =>
    typeof input === 'number' && Number.isFinite(input)

  if (value.kind === 'circle') {
    for (const field of ['x', 'y', 'radius'] as const) {
      if (!isFiniteNumber(value[field])) {
        return `${where}.${field} 必须是有效数字`
      }
    }
    return null
  }

  if (value.kind === 'rect') {
    for (const field of ['x', 'y', 'width', 'height'] as const) {
      if (!isFiniteNumber(value[field])) {
        return `${where}.${field} 必须是有效数字`
      }
    }
    return null
  }

  return `${where}.kind 必须是 circle 或 rect`
}

export function validateSceneHotspot(
  value: unknown,
  where: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }
  if (!isNonEmptyString(value.id)) {
    return `${where} 缺少有效的 id`
  }
  if (typeof value.label !== 'string') {
    return `${where} 缺少 label`
  }
  if (typeof value.enabled !== 'boolean') {
    return `${where}.enabled 必须是布尔值`
  }

  const shapeIssue = validateSceneHotspotShape(value.shape, `${where}.shape`)
  if (shapeIssue) return shapeIssue

  if (value.event !== undefined) {
    if (typeof value.event === 'string') {
      if (!isNonEmptyString(value.event)) {
        return `${where}.event 引用 id 不能为空`
      }
    } else {
      const eventIssue = validateEventValue(value.event, `${where}.event`)
      if (eventIssue) return eventIssue
    }
  }

  return null
}

export function validateLocationMap(
  value: unknown,
  where: string,
  expectedChapterId: string
): string | null {
  if (!isRecord(value)) {
    return `${where} 必须是对象`
  }
  if (!isNonEmptyString(value.chapterId)) {
    return `${where} 缺少有效的 chapterId`
  }
  if (value.chapterId !== expectedChapterId) {
    return `${where}.chapterId 必须等于行 key`
  }
  if (!isNonEmptyString(value.sceneId)) {
    return `${where} 缺少有效的 sceneId`
  }
  if (value.label !== undefined && typeof value.label !== 'string') {
    return `${where}.label 必须是字符串`
  }
  // disabled 缺省视为 false（兼容旧数据）；有值时必须是布尔。
  if (value.disabled !== undefined && typeof value.disabled !== 'boolean') {
    return `${where}.disabled 必须是布尔值`
  }
  if (!Array.isArray(value.hotspots)) {
    return `${where}.hotspots 必须是数组`
  }
  for (const [index, hotspot] of value.hotspots.entries()) {
    const issue = validateSceneHotspot(hotspot, `${where}.hotspots[${index}]`)
    if (issue) return issue
  }
  return null
}

/* ==========================================================================
 * 行级入口
 * ========================================================================== */

/**
 * 校验一条 evg-data 记录是否符合公共契约。
 *
 * @param key  行 key（业务 id）
 * @param type 行类型（EVG_DATA_KIND）
 * @param data 已解析的业务正文
 * @returns 第一个结构错误；合法时返回 null
 */
export function findEvgDataRecordContractIssue(
  key: string,
  type: number,
  data: unknown
): string | null {
  switch (type) {
    case EVG_DATA_KIND.Event:
      return validateEventValue(data, 'data', key)
    case EVG_DATA_KIND.Action:
      return validateActionValue(data, 'data', key)
    case EVG_DATA_KIND.Condition:
      return validateConditionType(data, 'data')
    case EVG_DATA_KIND.LocationMap:
      return validateLocationMap(data, 'data', key)
    case RUNTIME_CONFIG_DATA_TYPE:
      // Runtime 运行配置（扩展区间 type=1000），结构约定见 runtimeConfig.ts。
      if (key !== RUNTIME_CONFIG_ROW_KEY) {
        return `Runtime 配置行的 key 必须为 ${RUNTIME_CONFIG_ROW_KEY}`
      }
      return validateRuntimeConfigData(data)
    default:
      // 引擎保留 1-999 之外（其它扩展自定义行类型）不校验 data 形状。
      return null
  }
}
