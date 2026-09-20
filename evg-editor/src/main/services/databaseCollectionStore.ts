import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type {
  DatabaseDocument,
  EvgDataRecord,
  EvgDataTableDescriptor,
  NewEvgDataRecordInput
} from '../../shared/database'
import { findEvgDataRecordContractIssue } from '../../shared/evgDataValidate'
import { withProjectWriteLock, writeJsonFileAtomic } from './projectFileWriter'

interface DatabaseCollectionFile {
  formatVersion: number
  documents: DatabaseDocument[]
  [key: string]: unknown
}

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDatabaseDocument(value: unknown): value is DatabaseDocument {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0
}

function parseCollectionFile(raw: string, filePath: string): DatabaseCollectionFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`数据表文件不是合法的 JSON：${filePath}`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`数据表文件根节点必须是对象：${filePath}`)
  }
  if (!Array.isArray(parsed.documents)) {
    throw new Error(`数据表文件缺少 documents 数组：${filePath}`)
  }
  if (!parsed.documents.every(isDatabaseDocument)) {
    throw new Error(`数据表文件中存在缺少有效 id 的记录：${filePath}`)
  }

  return {
    ...parsed,
    formatVersion: typeof parsed.formatVersion === 'number' ? parsed.formatVersion : 1,
    documents: parsed.documents
  } as DatabaseCollectionFile
}

async function readCollectionFile(filePath: string): Promise<DatabaseCollectionFile> {
  return parseCollectionFile(await readFile(filePath, 'utf8'), filePath)
}

function parseStoredJsonText(
  value: unknown,
  documentId: string,
  table: EvgDataTableDescriptor
): unknown {
  if (typeof value !== 'string') {
    throw new Error(`记录 ${documentId} 的 data 列 ${table.dataColumnKey} 必须是 JSON 字符串`)
  }

  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`记录 ${documentId} 的 data 列不是合法的 JSON`)
  }
}

function toStoredJsonText(data: unknown): string {
  let serialized: string | undefined

  try {
    serialized = JSON.stringify(data)
  } catch {
    throw new Error('data 无法序列化为 JSON')
  }

  if (serialized === undefined) {
    throw new Error('data 无法序列化为 JSON')
  }

  return serialized
}

function readEvgDataRecord(
  document: DatabaseDocument,
  table: EvgDataTableDescriptor
): EvgDataRecord {
  const key = document[table.keyColumnKey]
  const type = document[table.typeColumnKey]

  if (typeof key !== 'string') {
    throw new Error(`记录 ${document.id} 缺少有效的 key 列 ${table.keyColumnKey}`)
  }
  if (typeof type !== 'number' || !Number.isFinite(type)) {
    throw new Error(`记录 ${document.id} 缺少有效的 type 列 ${table.typeColumnKey}`)
  }

  return {
    id: document.id,
    key,
    type,
    data: parseStoredJsonText(document[table.dataColumnKey], document.id, table)
  }
}

function assertNewRecordInput(input: NewEvgDataRecordInput): void {
  if (typeof input.key !== 'string' || input.key.length === 0) {
    throw new Error('新增记录的 key 必须是非空字符串')
  }
  if (typeof input.type !== 'number' || !Number.isFinite(input.type)) {
    throw new Error('新增记录的 type 必须是有效数字')
  }
}

function assertWritableRecords(records: EvgDataRecord[]): void {
  const seenIds = new Set<string>()
  // 业务 key 的命名空间按行类型隔离：ConditionRef / ActionRef / EventRef
  // 都在各自 type 的行里解析，因此查重也按 type 分组进行。
  const seenKeysByType = new Map<number, Set<string>>()

  for (const record of records) {
    if (typeof record.id !== 'string' || record.id.length === 0) {
      throw new Error('写入记录的 id 必须是非空字符串')
    }
    if (seenIds.has(record.id)) {
      throw new Error(`写入记录中存在重复 id：${record.id}`)
    }
    if (typeof record.key !== 'string' || record.key.length === 0) {
      throw new Error(`记录 ${record.id} 的 key 必须是非空字符串`)
    }
    if (typeof record.type !== 'number' || !Number.isFinite(record.type)) {
      throw new Error(`记录 ${record.id} 的 type 必须是有效数字`)
    }

    let seenKeys = seenKeysByType.get(record.type)
    if (!seenKeys) {
      seenKeys = new Set<string>()
      seenKeysByType.set(record.type, seenKeys)
    }
    if (seenKeys.has(record.key)) {
      throw new Error(
        `写入记录中存在重复的业务 key（type=${record.type}）：${record.key}`
      )
    }
    seenKeys.add(record.key)

    // 提前校验 data 可以序列化，避免读到一半才发现写入失败。
    toStoredJsonText(record.data)

    const contractIssue = findEvgDataRecordContractIssue(
      record.key,
      record.type,
      record.data
    )
    if (contractIssue) {
      throw new Error(`记录 ${record.id}（${record.key}）不符合公共契约：${contractIssue}`)
    }

    seenIds.add(record.id)
  }
}

function toDatabaseDocument(
  table: EvgDataTableDescriptor,
  record: EvgDataRecord,
  existing?: DatabaseDocument
): DatabaseDocument {
  return {
    ...(existing ?? {}),
    id: record.id,
    [table.keyColumnKey]: record.key,
    [table.typeColumnKey]: record.type,
    [table.dataColumnKey]: toStoredJsonText(record.data)
  }
}

/**
 * evg-data 的唯一落盘入口。
 *
 * 所有写操作（insert / update / delete / import 等）最终都必须调用这里，
 * 由它统一负责：
 * 1. 校验记录；
 * 2. 复用原有 document 上除 key/type/data 外的未知字段；
 * 3. 通过 writeJsonFileAtomic 做原子替换。
 */
async function commitEvgDataRecords(
  table: EvgDataTableDescriptor,
  collectionFile: DatabaseCollectionFile,
  records: EvgDataRecord[]
): Promise<EvgDataRecord[]> {
  assertWritableRecords(records)

  const existingDocuments = new Map(
    collectionFile.documents.map((document) => [document.id, document])
  )

  const nextCollectionFile: DatabaseCollectionFile = {
    ...collectionFile,
    documents: records.map((record) =>
      toDatabaseDocument(table, record, existingDocuments.get(record.id))
    )
  }

  await writeJsonFileAtomic(table.collectionFilePath, nextCollectionFile)

  return records
}

export async function readEvgDataRecords(
  table: EvgDataTableDescriptor
): Promise<EvgDataRecord[]> {
  const collectionFile = await readCollectionFile(table.collectionFilePath)
  return collectionFile.documents.map((document) => readEvgDataRecord(document, table))
}

/**
 * 全量写入 evg-data 数据表。
 *
 * 这是对外的统一写入口：传入记录数组即代表该表的最终状态。
 * 上层的新增/修改/删除都应先基于 readEvgDataRecords 得到目标数组，
 * 再调用本函数，而不是直接拼 documents 或重写 collection 文件。
 */
export function writeEvgDataRecords(
  table: EvgDataTableDescriptor,
  records: EvgDataRecord[]
): Promise<EvgDataRecord[]> {
  return withProjectWriteLock(table.projectPath, async () => {
    const collectionFile = await readCollectionFile(table.collectionFilePath)
    return commitEvgDataRecords(table, collectionFile, records)
  })
}

/**
 * 新增一条记录。
 * 这是 writeEvgDataRecords 的语法糖，内部同样走唯一落盘入口。
 */
export function insertEvgDataRecord(
  table: EvgDataTableDescriptor,
  input: NewEvgDataRecordInput
): Promise<EvgDataRecord> {
  assertNewRecordInput(input)

  return withProjectWriteLock(table.projectPath, async () => {
    const collectionFile = await readCollectionFile(table.collectionFilePath)
    const existingRecords = collectionFile.documents.map((document) =>
      readEvgDataRecord(document, table)
    )
    const record: EvgDataRecord = {
      id: randomUUID(),
      key: input.key,
      type: input.type,
      data: input.data
    }

    await commitEvgDataRecords(table, collectionFile, [
      ...existingRecords,
      record
    ])

    return record
  })
}
