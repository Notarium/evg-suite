/**
 * project.variables.json 的公共数据模型。
 *
 * 这个文件描述变量模板本身，不负责文件读写。
 * 文件读写和原子落盘在 src/main/services/projectVariablesStore.ts。
 */

/* ==========================================================================
 * 1. 变量类型
 * ========================================================================== */

export const VARIABLE_TYPES = ['string', 'number', 'bool', 'pending'] as const

/**
 * 变量类型。
 *
 * - string  : 字符串
 * - number  : 数字
 * - bool    : 布尔
 * - pending : 尚未确定类型；编辑器需要识别并允许，但不会主动创建
 */
export type VariableType = (typeof VARIABLE_TYPES)[number]

export const VARIABLE_TYPE_OPTIONS: ReadonlyArray<{
  value: VariableType
  label: string
}> = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'bool', label: '布尔' },
  { value: 'pending', label: '待定' }
]

/* ==========================================================================
 * 2. 持久化范围
 * ========================================================================== */

export const VARIABLE_PERSISTENCE = ['slot', 'shared'] as const

/**
 * 变量持久化范围。
 *
 * - slot   : 当前存档
 * - shared : 跨存档
 */
export type VariablePersistence = (typeof VARIABLE_PERSISTENCE)[number]

export const VARIABLE_PERSISTENCE_OPTIONS: ReadonlyArray<{
  value: VariablePersistence
  label: string
}> = [
  { value: 'slot', label: '当前存档' },
  { value: 'shared', label: '跨存档' }
]

/* ==========================================================================
 * 3. 常量
 * ========================================================================== */

export const PROJECT_VARIABLES_FILENAME = 'project.variables.json'
export const PROJECT_VARIABLES_VERSION = 2
export const DEFAULT_VARIABLE_KIND = 'project'

/**
 * Runtime 系统变量的名字前缀（evg.<system>.<name>）。
 *
 * 系统变量的判定依据是名字前缀而不是 kind——kind 必须一律是 'project'
 * （'system' 是 AVG 引擎自己内部使用的保留值，写了引擎无法识别，
 * 剧本编辑器也不会把这些变量列为可引用候选）。
 */
export const RUNTIME_VARIABLE_NAME_PREFIX = 'evg.'

export function isRuntimeVariableName(name: string): boolean {
  return name.startsWith(RUNTIME_VARIABLE_NAME_PREFIX)
}

/* ==========================================================================
 * 4. 变量记录
 * ========================================================================== */

/** 变量默认值的基础类型；pending 允许 null。 */
export type VariableValue = string | number | boolean | null

export interface ProjectVariableBase {
  /** 唯一 id，创建时使用 UUID v4 / GUID。 */
  id: string
  /** 变量名；项目内作为稳定 key 使用，应当唯一。 */
  name: string
  /** 作用域；当前项目文件里都是 project，保留为开放字符串。 */
  kind: string
  /** 创建时间，毫秒时间戳。 */
  createdAt: number
  /** 持久化范围。 */
  persistence: VariablePersistence
  /** 允许未来追加字段而不丢失。 */
  [key: string]: unknown
}

export interface ProjectStringVariable extends ProjectVariableBase {
  type: 'string'
  defaultValue: string
}

export interface ProjectNumberVariable extends ProjectVariableBase {
  type: 'number'
  defaultValue: number
}

export interface ProjectBoolVariable extends ProjectVariableBase {
  type: 'bool'
  defaultValue: boolean
}

export interface ProjectPendingVariable extends ProjectVariableBase {
  type: 'pending'
  /** pending 类型未被实际使用，但允许保存任意默认值。 */
  defaultValue: unknown
}

export type ProjectVariable =
  | ProjectStringVariable
  | ProjectNumberVariable
  | ProjectBoolVariable
  | ProjectPendingVariable

export interface ProjectVariablesFile {
  version: number
  variables: ProjectVariable[]
  [key: string]: unknown
}

/**
 * project.variables.json 的读取结果。
 * 文件由引擎在用户设置变量时创建；不存在时 variables 为空清单、
 * fileExists 为 false（UI 据此提示去引擎端设置变量）。
 */
export interface ProjectVariablesSnapshot {
  variables: ProjectVariable[]
  fileExists: boolean
}

/* ==========================================================================
 * 5. 新建变量输入
 * ========================================================================== */

export interface NewProjectVariableInput {
  name: string
  type: VariableType
  /** 省略时按 type 生成默认值。 */
  defaultValue?: unknown
  persistence: VariablePersistence
  /** 省略时使用 DEFAULT_VARIABLE_KIND。 */
  kind?: string
}

/* ==========================================================================
 * 6. 类型守卫
 * ========================================================================== */

export function isVariableType(value: unknown): value is VariableType {
  return (
    typeof value === 'string' &&
    (VARIABLE_TYPES as readonly string[]).includes(value)
  )
}

export function isVariablePersistence(
  value: unknown
): value is VariablePersistence {
  return (
    typeof value === 'string' &&
    (VARIABLE_PERSISTENCE as readonly string[]).includes(value)
  )
}

/** 默认值是否匹配变量类型。pending 不限制。 */
export function isVariableValue(
  type: VariableType,
  value: unknown
): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'bool':
      return typeof value === 'boolean'
    case 'pending':
      return true
  }
}

/* ==========================================================================
 * 7. 创建工具
 * ========================================================================== */

/** 生成 UUID v4 / GUID；优先用运行时提供的 randomUUID。 */
export function createGuid(): string {
  const cryptoApi = (
    globalThis as {
      crypto?: { randomUUID?: () => string }
    }
  ).crypto

  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16)
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

/** 按变量类型生成默认值。 */
export function getDefaultVariableValue(type: VariableType): VariableValue {
  switch (type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'bool':
      return false
    case 'pending':
      return null
  }
}

/**
 * 创建一个新的变量模板。
 *
 * - id 使用 createGuid()
 * - createdAt 使用创建瞬间的毫秒时间戳
 * - defaultValue 省略时按 type 生成
 */
export function createProjectVariable(
  input: NewProjectVariableInput
): ProjectVariable {
  if (!isVariableType(input.type)) {
    throw new Error(`未知的变量类型：${String(input.type)}`)
  }
  if (!isVariablePersistence(input.persistence)) {
    throw new Error(`未知的变量持久化范围：${String(input.persistence)}`)
  }
  if (typeof input.name !== 'string' || input.name.length === 0) {
    throw new Error('变量名必须是非空字符串')
  }

  const defaultValue =
    input.defaultValue === undefined
      ? getDefaultVariableValue(input.type)
      : input.defaultValue

  if (!isVariableValue(input.type, defaultValue)) {
    throw new Error(`变量 ${input.name} 的 defaultValue 与类型 ${input.type} 不匹配`)
  }

  const base = {
    id: createGuid(),
    name: input.name,
    kind: input.kind ?? DEFAULT_VARIABLE_KIND,
    createdAt: Date.now(),
    persistence: input.persistence
  }

  switch (input.type) {
    case 'string':
      return { ...base, type: 'string', defaultValue: defaultValue as string }
    case 'number':
      return { ...base, type: 'number', defaultValue: defaultValue as number }
    case 'bool':
      return { ...base, type: 'bool', defaultValue: defaultValue as boolean }
    case 'pending':
      return { ...base, type: 'pending', defaultValue }
  }
}
