import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DEFAULT_VARIABLE_KIND,
  PROJECT_VARIABLES_FILENAME,
  PROJECT_VARIABLES_VERSION,
  createProjectVariable,
  isVariablePersistence,
  isVariableType,
  type NewProjectVariableInput,
  type ProjectVariable,
  type ProjectVariablesFile,
  type ProjectVariablesSnapshot,
  type VariableType
} from '../../shared/variable'
import { ProjectFileWriter, withProjectWriteLock } from './projectFileWriter'

function stripBom(content: string): string {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === 'string' ? error.code : undefined
}

function assertDefaultValue(
  type: VariableType,
  value: unknown,
  where: string
): void {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new Error(`${where} 的 defaultValue 必须是字符串`)
      }
      return
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${where} 的 defaultValue 必须是有限数字`)
      }
      return
    case 'bool':
      if (typeof value !== 'boolean') {
        throw new Error(`${where} 的 defaultValue 必须是布尔值`)
      }
      return
    case 'pending':
      // pending 类型未被实际使用，允许保留任意 default。
      return
  }
}

function readProjectVariable(
  value: unknown,
  index: number,
  filePath: string
): ProjectVariable {
  const where = `${filePath} 的 variables[${index}]`

  if (!isRecord(value)) {
    throw new Error(`${where} 必须是对象`)
  }

  const { id, name, type, defaultValue, kind, createdAt, persistence } = value

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`${where} 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error(`${where} 缺少有效的 name`)
  }
  if (!isVariableType(type)) {
    throw new Error(`${where} 的 type 不是支持的变量类型`)
  }
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    throw new Error(`${where} 的 createdAt 必须是有效的时间戳`)
  }
  if (!isVariablePersistence(persistence)) {
    throw new Error(`${where} 的 persistence 必须是 slot 或 shared`)
  }
  if (kind !== undefined && typeof kind !== 'string') {
    throw new Error(`${where} 的 kind 必须是字符串`)
  }

  assertDefaultValue(type, defaultValue, where)

  return {
    ...value,
    id,
    name,
    type,
    defaultValue,
    kind: typeof kind === 'string' ? kind : DEFAULT_VARIABLE_KIND,
    createdAt,
    persistence
  } as ProjectVariable
}

function parseProjectVariablesFile(
  raw: string,
  filePath: string
): ProjectVariablesFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(stripBom(raw))
  } catch {
    throw new Error(`变量文件不是合法的 JSON：${filePath}`)
  }

  if (!isRecord(parsed)) {
    throw new Error(`变量文件根节点必须是对象：${filePath}`)
  }
  if (!Array.isArray(parsed.variables)) {
    throw new Error(`变量文件缺少 variables 数组：${filePath}`)
  }

  return {
    ...parsed,
    version:
      typeof parsed.version === 'number' && Number.isFinite(parsed.version)
        ? parsed.version
        : PROJECT_VARIABLES_VERSION,
    variables: parsed.variables.map((item, index) =>
      readProjectVariable(item, index, filePath)
    )
  }
}

function assertUniqueVariables(variables: ProjectVariable[]): void {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()

  for (const variable of variables) {
    if (seenIds.has(variable.id)) {
      throw new Error(`变量列表中 id 重复：${variable.id}`)
    }
    if (seenNames.has(variable.name)) {
      throw new Error(`变量列表中 name 重复：${variable.name}`)
    }
    seenIds.add(variable.id)
    seenNames.add(variable.name)
  }
}

async function readExistingVariablesFile(
  filePath: string
): Promise<ProjectVariablesFile | null> {
  try {
    return parseProjectVariablesFile(await readFile(filePath, 'utf8'), filePath)
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * project.variables.json 由引擎在用户设置变量时创建——引擎新建的工程
 * 没有它。读取宽容：缺失按空清单处理，但通过 fileExists 告知调用方，
 * 供 UI 提示“去引擎端设置一个变量”。
 */
export async function readProjectVariablesFile(
  projectPath: string
): Promise<{ file: ProjectVariablesFile; fileExists: boolean }> {
  const filePath = resolve(projectPath, PROJECT_VARIABLES_FILENAME)

  let raw: string
  try {
    raw = await readFile(filePath, 'utf8')
  } catch {
    return {
      file: { version: PROJECT_VARIABLES_VERSION, variables: [] },
      fileExists: false
    }
  }

  return { file: parseProjectVariablesFile(raw, filePath), fileExists: true }
}

export async function readProjectVariables(
  projectPath: string
): Promise<ProjectVariablesSnapshot> {
  const { file, fileExists } = await readProjectVariablesFile(projectPath)
  return { variables: file.variables, fileExists }
}

async function writeProjectVariablesUnlocked(
  projectPath: string,
  variables: ProjectVariable[]
): Promise<ProjectVariablesFile> {
  // create: false —— 该文件由引擎在用户设置变量时创建，编辑器绝不能凭空生成
  const writer = new ProjectFileWriter(projectPath).register({
    relativePath: PROJECT_VARIABLES_FILENAME,
    create: false
  })
  const filePath = resolve(projectPath, PROJECT_VARIABLES_FILENAME)
  const validatedVariables = variables.map((variable, index) =>
    readProjectVariable(variable, index, '待写入的变量列表')
  )

  assertUniqueVariables(validatedVariables)

  const existingFile = await readExistingVariablesFile(filePath)
  const nextFile: ProjectVariablesFile = {
    ...(existingFile ?? {}),
    version: existingFile?.version ?? PROJECT_VARIABLES_VERSION,
    variables: validatedVariables
  }

  await writer.writeUnlocked(PROJECT_VARIABLES_FILENAME, nextFile)

  return nextFile
}

/**
 * 全量写回 project.variables.json。
 *
 * - 保留文件原有顶层字段和 version；
 * - 只替换 variables 数组；
 * - 通过项目写锁串行化，并统一走原子 JSON 写入。
 */
export function writeProjectVariables(
  projectPath: string,
  variables: ProjectVariable[]
): Promise<ProjectVariablesFile> {
  return withProjectWriteLock(projectPath, () =>
    writeProjectVariablesUnlocked(projectPath, variables)
  )
}

/**
 * 新建一个变量并写回文件。
 *
 * 这是 UI 常用的“新增变量”入口；编辑已有变量时可以读取全量变量后
 * 调用 writeProjectVariables 写回。
 */
export function insertProjectVariable(
  projectPath: string,
  input: NewProjectVariableInput
): Promise<ProjectVariable> {
  return withProjectWriteLock(projectPath, async () => {
    const { file } = await readProjectVariablesFile(projectPath)

    if (file.variables.some((variable) => variable.name === input.name)) {
      throw new Error(`变量名已存在：${input.name}`)
    }

    const variable = createProjectVariable(input)
    await writeProjectVariablesUnlocked(projectPath, [
      ...file.variables,
      variable
    ])

    return variable
  })
}
