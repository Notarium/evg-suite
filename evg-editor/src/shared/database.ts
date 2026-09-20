export interface DatabaseColumn {
  key: string
  label: string
  type: string
}

export interface DatabaseCollectionSchema {
  type?: string
  columns: DatabaseColumn[]
  titleColumn?: string
  additionalProperties?: boolean
}

export interface DatabaseCollection {
  id: string
  name: string
  schema: DatabaseCollectionSchema
  [key: string]: unknown
}

export interface ProjectDatabaseDefinition {
  formatVersion: number
  id: string
  name: string
  collections: DatabaseCollection[]
  [key: string]: unknown
}

export interface EvgDataTableDescriptor {
  projectPath: string
  databaseDefinitionPath: string
  databaseId: string
  collectionId: string
  collectionName: 'evg-data'
  collectionFilePath: string
  keyColumnKey: string
  typeColumnKey: string
  dataColumnKey: string
}

/**
 * collection 文件中实际的记录结构。
 * `data` 列在文件中是 long-text，内容通常是 JSON 字符串。
 */
export interface DatabaseDocument {
  id: string
  [key: string]: unknown
}

/**
 * 对外暴露的 evg-data 记录。
 * data 字段已经过 JSON.parse，调用方拿到的是真正的 JSON 值。
 *
 * 这是底层存储模型；Event / Action / Condition 的业务类型和行映射见
 * `./evgData.ts`。业务层可以在这里显式传入 TType / TData 收窄类型。
 */
export interface EvgDataRecord<
  TType extends number = number,
  TData = unknown
> {
  id: string
  key: string
  type: TType
  data: TData
}

/**
 * 新增 evg-data 记录时的输入。
 * data 是 JSON 值，写入时会自动 JSON.stringify 为 long-text 字符串。
 */
export interface NewEvgDataRecordInput<
  TType extends number = number,
  TData = unknown
> {
  key: string
  type: TType
  data: TData
}
