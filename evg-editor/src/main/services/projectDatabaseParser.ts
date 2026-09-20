import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  DatabaseCollection,
  DatabaseColumn,
  EvgDataTableDescriptor
} from '../../shared/database'

export const PROJECT_DATABASE_ID = 'project-data'
export const PROJECT_DATABASE_FILENAME = `${PROJECT_DATABASE_ID}.database.json`
export const EVG_DATA_COLLECTION_NAME = 'evg-data'
export const EVG_DATA_COLLECTION_ID = 'evdata'
export const EVG_DATA_COLLECTION_FILENAME = `${PROJECT_DATABASE_ID}--${EVG_DATA_COLLECTION_ID}.collection.json`
export const EVG_DATA_KEY_COLUMN_KEY = 'key'
export const EVG_DATA_TYPE_COLUMN_KEY = 'type'
export const EVG_DATA_DATA_COLUMN_KEY = 'data'

interface RawProjectDatabaseDefinition {
  formatVersion: number
  id: string
  name: string
  collections: unknown[]
  [key: string]: unknown
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readColumn(value: unknown): DatabaseColumn {
  if (!isRecord(value)) {
    throw new Error('数据库 schema.columns 中存在无效列定义')
  }

  const { key, label, type } = value

  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('数据库列定义缺少有效的 key')
  }
  if (typeof label !== 'string') {
    throw new Error(`数据库列 ${key} 缺少有效的 label`)
  }
  if (typeof type !== 'string' || type.length === 0) {
    throw new Error(`数据库列 ${key} 缺少有效的 type`)
  }

  return { key, label, type }
}

function readCollection(value: unknown): DatabaseCollection {
  if (!isRecord(value)) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 的 collections 中存在无效项`)
  }

  const { id, name, schema } = value

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('数据库 collection 缺少有效的 id')
  }
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`数据库 collection ${id} 缺少有效的 name`)
  }
  if (!isRecord(schema) || !Array.isArray(schema.columns)) {
    throw new Error(`数据库 collection ${id} 缺少有效的 schema.columns`)
  }

  return {
    ...value,
    id,
    name,
    schema: {
      ...schema,
      columns: schema.columns.map(readColumn)
    }
  } as DatabaseCollection
}

function parseDatabaseDefinition(raw: string): RawProjectDatabaseDefinition {
  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 不是合法的 JSON 文件`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 根节点必须是对象`)
  }

  const { id, name, collections } = parsed

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 缺少有效的 name`)
  }
  if (!Array.isArray(collections)) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 缺少 collections 数组`)
  }

  return {
    ...parsed,
    formatVersion: typeof parsed.formatVersion === 'number' ? parsed.formatVersion : 1,
    id,
    name,
    collections
  } as RawProjectDatabaseDefinition
}

function resolveEvgDataColumns(collection: DatabaseCollection): {
  keyColumnKey: string
  typeColumnKey: string
  dataColumnKey: string
} {
  const columns = collection.schema.columns

  if (columns.length !== 3) {
    throw new Error(`name=${EVG_DATA_COLLECTION_NAME} 的 schema.columns 必须恰好有 3 列`)
  }

  const keyColumn = columns.find((column) => column.key === EVG_DATA_KEY_COLUMN_KEY)
  const typeColumn = columns.find((column) => column.key === EVG_DATA_TYPE_COLUMN_KEY)
  const dataColumn = columns.find((column) => column.key === EVG_DATA_DATA_COLUMN_KEY)

  if (!keyColumn || !typeColumn || !dataColumn) {
    throw new Error(`name=${EVG_DATA_COLLECTION_NAME} 的列 key 必须为 key、type 和 data`)
  }
  if (keyColumn.type !== 'text') {
    throw new Error('key=key 的列 type 必须为 text')
  }
  if (typeColumn.type !== 'number') {
    throw new Error('key=type 的列 type 必须为 number')
  }
  if (dataColumn.type !== 'long-text') {
    throw new Error('key=data 的列 type 必须为 long-text')
  }

  return {
    keyColumnKey: keyColumn.key,
    typeColumnKey: typeColumn.key,
    dataColumnKey: dataColumn.key
  }
}

export async function parseEvgDataTable(projectPath: string): Promise<EvgDataTableDescriptor> {
  const absoluteProjectPath = resolve(projectPath)
  const databasesPath = resolve(absoluteProjectPath, 'databases')
  const databaseDefinitionPath = resolve(databasesPath, PROJECT_DATABASE_FILENAME)
  let databaseDefinitionRaw: string

  try {
    databaseDefinitionRaw = await readFile(databaseDefinitionPath, 'utf8')
  } catch {
    throw new Error(`找不到数据库定义文件：${databaseDefinitionPath}`)
  }

  const databaseDefinition = parseDatabaseDefinition(databaseDefinitionRaw)

  const collectionValue = databaseDefinition.collections.find(
    (item) => isRecord(item) && item.name === EVG_DATA_COLLECTION_NAME
  )

  if (!collectionValue) {
    throw new Error(`数据库中没有 name=${EVG_DATA_COLLECTION_NAME} 的数据表`)
  }

  const collection = readCollection(collectionValue)

  if (collection.id !== EVG_DATA_COLLECTION_ID) {
    throw new Error(`name=${EVG_DATA_COLLECTION_NAME} 的 collection id 必须为 ${EVG_DATA_COLLECTION_ID}`)
  }

  if (databaseDefinition.id !== PROJECT_DATABASE_ID) {
    throw new Error(`${PROJECT_DATABASE_FILENAME} 的 id 必须为 ${PROJECT_DATABASE_ID}`)
  }

  const { keyColumnKey, typeColumnKey, dataColumnKey } = resolveEvgDataColumns(collection)
  const collectionFilePath = resolve(databasesPath, EVG_DATA_COLLECTION_FILENAME)
  const collectionFileStats = await stat(collectionFilePath).catch(() => null)

  if (!collectionFileStats?.isFile()) {
    throw new Error(`找不到 evg-data 对应的数据表文件：${collectionFilePath}`)
  }

  return {
    projectPath: absoluteProjectPath,
    databaseDefinitionPath,
    databaseId: databaseDefinition.id,
    collectionId: collection.id,
    collectionName: EVG_DATA_COLLECTION_NAME,
    collectionFilePath,
    keyColumnKey,
    typeColumnKey,
    dataColumnKey
  }
}
