import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createAttributeType,
  isAttributeValue,
  isAttributeValueType,
  type AttributeType,
  type AttributeValue,
  type AttributeValueType,
  type CharacterAttributeEntry,
  type CharacterAttributeState,
  type CharacterAttributeValues,
  type NewAttributeTypeInput
} from '../../shared/attribute'
import { withProjectWriteLock, writeJsonFileAtomic } from './projectFileWriter'

const CHARACTERS_FILENAME = 'characters.json'

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertAttributeValue(
  type: AttributeValueType,
  value: unknown,
  where: string
): asserts value is AttributeValue {
  if (!isAttributeValue(type, value)) {
    throw new Error(`${where} 与属性类型 ${type} 不匹配`)
  }
}

function readAttributeType(
  value: unknown,
  index: number,
  filePath: string
): AttributeType {
  const where = `${filePath} 的 attributeTemplate[${index}]`

  if (!isRecord(value)) {
    throw new Error(`${where} 必须是对象`)
  }

  const { id, name, type, defaultValue, createdAt } = value

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`${where} 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${where} 缺少有效的 name`)
  }
  if (!isAttributeValueType(type)) {
    throw new Error(`${where} 的 type 不是支持的角色属性类型`)
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    throw new Error(`${where} 的 createdAt 必须是有效的时间戳`)
  }

  assertAttributeValue(type, defaultValue, `${where} 的 defaultValue`)

  return {
    ...value,
    id,
    name,
    type,
    defaultValue,
    createdAt
  } as AttributeType
}

function assertUniqueAttributeTypes(definitions: AttributeType[]): void {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const definition of definitions) {
    if (seenIds.has(definition.id)) {
      throw new Error(`属性模板 id 重复：${definition.id}`)
    }
    if (seenNames.has(definition.name)) {
      throw new Error(`属性模板 name 重复：${definition.name}`)
    }
    seenIds.add(definition.id)
    seenNames.add(definition.name)
  }
}

async function readCharactersFile(
  projectPath: string
): Promise<Record<string, unknown>> {
  const filePath = resolve(projectPath, CHARACTERS_FILENAME)

  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    throw new Error(`找不到角色文件：${filePath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`角色文件不是合法的 JSON：${filePath}`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`角色文件根节点必须是对象：${filePath}`)
  }
  if (!Array.isArray(parsed.attributeTemplate)) {
    throw new Error(`角色文件缺少 attributeTemplate 数组：${filePath}`)
  }
  if (!Array.isArray(parsed.characters)) {
    throw new Error(`角色文件缺少 characters 数组：${filePath}`)
  }

  return parsed
}

function parseCharacterAttributeState(
  raw: Record<string, unknown>,
  filePath: string
): CharacterAttributeState {
  const definitions = (raw.attributeTemplate as unknown[]).map((item, index) =>
    readAttributeType(item, index, filePath)
  )
  assertUniqueAttributeTypes(definitions)

  const definitionByName = new Map(
    definitions.map((definition) => [definition.name, definition])
  )

  const seenCharacterIds = new Set<string>()
  const characters: CharacterAttributeEntry[] = (
    raw.characters as unknown[]
  ).map((item, index) => {
    const where = `${filePath} 的 characters[${index}]`

    if (!isRecord(item)) {
      throw new Error(`${where} 必须是对象`)
    }

    const { id, name, attributeValues } = item

    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${where} 缺少有效的 id`)
    }
    if (seenCharacterIds.has(id)) {
      throw new Error(`角色 id 重复：${id}`)
    }
    seenCharacterIds.add(id)

    const values: CharacterAttributeValues = {}
    if (attributeValues !== undefined) {
      if (!isRecord(attributeValues)) {
        throw new Error(`${where} 的 attributeValues 必须是对象`)
      }

      for (const [key, value] of Object.entries(attributeValues)) {
        const definition = definitionByName.get(key)
        if (!definition) {
          throw new Error(`${where} 的 attributeValues.${key} 没有对应的属性模板`)
        }
        assertAttributeValue(
          definition.type,
          value,
          `${where} 的 attributeValues.${key}`
        )
        values[key] = value
      }
    }

    return {
      id,
      name: typeof name === 'string' ? name : '',
      attributeValues: values
    }
  })

  return {
    definitions,
    characters
  }
}

export async function readCharacterAttributeState(
  projectPath: string
): Promise<CharacterAttributeState> {
  const filePath = resolve(projectPath, CHARACTERS_FILENAME)
  return parseCharacterAttributeState(await readCharactersFile(projectPath), filePath)
}

function validateStateForWrite(state: CharacterAttributeState): void {
  const definitions = state.definitions.map((definition, index) =>
    readAttributeType(definition, index, '待写入的角色属性模板列表')
  )
  assertUniqueAttributeTypes(definitions)

  const definitionByName = new Map(
    definitions.map((definition) => [definition.name, definition])
  )

  const seenCharacterIds = new Set<string>()
  for (const character of state.characters) {
    if (typeof character.id !== 'string' || character.id.length === 0) {
      throw new Error('待写入的角色缺少有效的 id')
    }
    if (seenCharacterIds.has(character.id)) {
      throw new Error(`待写入的角色 id 重复：${character.id}`)
    }
    seenCharacterIds.add(character.id)

    for (const [key, value] of Object.entries(character.attributeValues)) {
      const definition = definitionByName.get(key)
      if (!definition) {
        throw new Error(`角色 ${character.id} 的 attributeValues.${key} 没有对应的属性模板`)
      }
      assertAttributeValue(
        definition.type,
        value,
        `角色 ${character.id} 的 attributeValues.${key}`
      )
    }
  }
}

async function writeCharacterAttributeStateUnlocked(
  projectPath: string,
  state: CharacterAttributeState
): Promise<CharacterAttributeState> {
  validateStateForWrite(state)

  const filePath = resolve(projectPath, CHARACTERS_FILENAME)
  const raw = await readCharactersFile(projectPath)
  const rawCharacters = raw.characters as unknown[]

  const rawIds = new Set<string>()
  for (const [index, item] of rawCharacters.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) {
      throw new Error(`${filePath} 的 characters[${index}] 缺少有效的 id`)
    }
    rawIds.add(item.id)
  }

  if (rawIds.size !== state.characters.length) {
    throw new Error('待写入的角色列表与 characters.json 中的角色数量不一致')
  }

  const stateById = new Map(
    state.characters.map((character) => [character.id, character])
  )

  for (const rawId of rawIds) {
    if (!stateById.has(rawId)) {
      throw new Error(`待写入的角色列表缺少角色：${rawId}`)
    }
  }

  const nextCharacters = rawCharacters.map((item) => {
    const rawCharacter = item as Record<string, unknown>
    const stateCharacter = stateById.get(rawCharacter.id as string)!

    const nextCharacter: Record<string, unknown> = { ...rawCharacter }

    if (Object.keys(stateCharacter.attributeValues).length > 0) {
      nextCharacter.attributeValues = stateCharacter.attributeValues
    } else {
      delete nextCharacter.attributeValues
    }

    return nextCharacter
  })

  const nextFile: Record<string, unknown> = {
    ...raw,
    attributeTemplate: state.definitions,
    characters: nextCharacters
  }

  await writeJsonFileAtomic(filePath, nextFile)

  return state
}

/**
 * 全量写回 characters.json 中与属性相关的部分。
 *
 * 只替换：
 * - attributeTemplate
 * - 每个角色对象的 attributeValues
 *
 * 角色和文件上的其它字段原样保留。
 */
export function writeCharacterAttributeState(
  projectPath: string,
  state: CharacterAttributeState
): Promise<CharacterAttributeState> {
  return withProjectWriteLock(projectPath, () =>
    writeCharacterAttributeStateUnlocked(projectPath, state)
  )
}

/**
 * 新增一个属性模板并写回 characters.json。
 *
 * 已经存在的角色 attributeValues 保持不变，未显式设置的属性继续使用
 * attributeTemplate 的 defaultValue。
 */
export function insertAttributeType(
  projectPath: string,
  input: NewAttributeTypeInput
): Promise<AttributeType> {
  return withProjectWriteLock(projectPath, async () => {
    const state = await readCharacterAttributeState(projectPath)

    if (state.definitions.some((definition) => definition.name === input.name)) {
      throw new Error(`属性名已存在：${input.name}`)
    }

    const definition = createAttributeType(input)
    await writeCharacterAttributeStateUnlocked(projectPath, {
      definitions: [...state.definitions, definition],
      characters: state.characters
    })

    return definition
  })
}

