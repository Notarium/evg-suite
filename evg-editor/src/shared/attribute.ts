/**
 * characters.json 中角色属性相关的公共数据模型。
 *
 * 角色属性模板定义在 `attributeTemplate` 中；
 * 每个角色对属性模板的初始值定义在该角色的 `attributeValues` 中，
 * key 是 attributeTemplate[].name，value 是对应类型的初始值。
 */

import { createGuid } from './variable'

/* ==========================================================================
 * 1. 属性值类型
 * ========================================================================== */

export const ATTRIBUTE_VALUE_TYPES = ['string', 'number', 'bool'] as const

/**
 * 角色属性值类型。
 *
 * 和变量类型相比少一个 pending。
 */
export type AttributeValueType = (typeof ATTRIBUTE_VALUE_TYPES)[number]

export type AttributeValue = string | number | boolean

export const ATTRIBUTE_VALUE_TYPE_OPTIONS: ReadonlyArray<{
  value: AttributeValueType
  label: string
}> = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'bool', label: '布尔' }
]

/* ==========================================================================
 * 2. 属性模板
 * ========================================================================== */

export interface AttributeTypeBase {
  /** 唯一 id，创建时使用 UUID v4 / GUID。 */
  id: string
  /** 属性名；在项目内作为稳定 key 使用，应当唯一。 */
  name: string
  /** 创建时间，毫秒时间戳。 */
  createdAt: number
  /** 允许未来追加字段而不丢失。 */
  [key: string]: unknown
}

export interface StringAttributeType extends AttributeTypeBase {
  type: 'string'
  defaultValue: string
}

export interface NumberAttributeType extends AttributeTypeBase {
  type: 'number'
  defaultValue: number
}

export interface BoolAttributeType extends AttributeTypeBase {
  type: 'bool'
  defaultValue: boolean
}

/** attributeTemplate 中的单个属性模板。 */
export type AttributeType =
  | StringAttributeType
  | NumberAttributeType
  | BoolAttributeType

/* ==========================================================================
 * 3. 角色上的属性值
 * ========================================================================== */

/**
 * 一个角色对属性模板的显式初始值。
 *
 * 没有出现的 key 表示使用该属性模板的 defaultValue。
 */
export type CharacterAttributeValues = Record<string, AttributeValue>

export interface CharacterAttributeEntry {
  id: string
  name: string
  attributeValues: CharacterAttributeValues
}

/** 变量 / 属性编辑页需要的完整角色属性状态。 */
export interface CharacterAttributeState {
  definitions: AttributeType[]
  characters: CharacterAttributeEntry[]
}

/* ==========================================================================
 * 4. 新建属性模板输入
 * ========================================================================== */

export interface NewAttributeTypeInput {
  name: string
  type: AttributeValueType
  /** 省略时按 type 生成默认值。 */
  defaultValue?: AttributeValue
}

/* ==========================================================================
 * 5. 类型守卫
 * ========================================================================== */

export function isAttributeValueType(
  value: unknown
): value is AttributeValueType {
  return (
    typeof value === 'string' &&
    (ATTRIBUTE_VALUE_TYPES as readonly string[]).includes(value)
  )
}

/** 值是否匹配属性类型。 */
export function isAttributeValue(
  type: AttributeValueType,
  value: unknown
): value is AttributeValue {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'bool':
      return typeof value === 'boolean'
  }
}

/* ==========================================================================
 * 6. 创建工具
 * ========================================================================== */

/** 按属性类型生成默认值。 */
export function getDefaultAttributeValue(
  type: AttributeValueType
): AttributeValue {
  switch (type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'bool':
      return false
  }
}

/**
 * 创建一个新的属性模板。
 *
 * - id 使用 createGuid()
 * - createdAt 使用创建瞬间的毫秒时间戳
 * - defaultValue 省略时按 type 生成
 */
export function createAttributeType(
  input: NewAttributeTypeInput
): AttributeType {
  if (!isAttributeValueType(input.type)) {
    throw new Error(`未知的角色属性类型：${String(input.type)}`)
  }
  if (typeof input.name !== 'string' || input.name.length === 0) {
    throw new Error('属性名必须是非空字符串')
  }

  const defaultValue =
    input.defaultValue === undefined
      ? getDefaultAttributeValue(input.type)
      : input.defaultValue

  if (!isAttributeValue(input.type, defaultValue)) {
    throw new Error(`属性 ${input.name} 的 defaultValue 与类型 ${input.type} 不匹配`)
  }

  const base = {
    id: createGuid(),
    name: input.name,
    createdAt: Date.now()
  }

  switch (input.type) {
    case 'string':
      return { ...base, type: 'string', defaultValue: defaultValue as string }
    case 'number':
      return { ...base, type: 'number', defaultValue: defaultValue as number }
    case 'bool':
      return { ...base, type: 'bool', defaultValue: defaultValue as boolean }
  }
}
