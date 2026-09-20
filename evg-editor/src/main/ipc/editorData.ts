import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ipcMain } from 'electron'
import { IPC_CHANNELS, type IpcResult } from '../../shared/ipc'
import type { CharacterAttributeState } from '../../shared/attribute'
import type { EvgDataRecord } from '../../shared/database'
import type { ProjectVariable } from '../../shared/variable'
import {
  readCharacterAttributeState,
  writeCharacterAttributeState
} from '../services/characterAttributeStore'
import {
  readEvgDataRecords,
  writeEvgDataRecords
} from '../services/databaseCollectionStore'
import { parseChapterSummaries } from '../services/projectChapterParser'
import { readProjectAssetDataUrl } from '../services/projectAssetStore'
import { parseSceneSummaries } from '../services/projectSceneParser'
import { parseEvgDataTable } from '../services/projectDatabaseParser'
import {
  readProjectVariables,
  writeProjectVariables
} from '../services/projectVariablesStore'

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

async function run<T>(task: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await task() }
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) }
  }
}

function readAssetPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('无效的资源路径')
  }
  return value
}

function readProjectPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('无效的项目路径')
  }
  return value
}

function readVariables(value: unknown): ProjectVariable[] {
  if (!Array.isArray(value)) {
    throw new Error('无效的变量列表')
  }
  return value as ProjectVariable[]
}

function readAttributeState(value: unknown): CharacterAttributeState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('无效的角色属性状态')
  }
  return value as CharacterAttributeState
}

function readEvgDataRecordList(value: unknown): EvgDataRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('无效的 evg-data 记录列表')
  }
  return value as EvgDataRecord[]
}

export function registerEditorDataIpc(): void {
  ipcMain.handle(IPC_CHANNELS.variables.read, (_event, projectPath: unknown) =>
    run(() => readProjectVariables(readProjectPath(projectPath)))
  )

  ipcMain.handle(
    IPC_CHANNELS.variables.write,
    (
      _event,
      projectPath: unknown,
      variables: unknown
    ): Promise<IpcResult<ProjectVariable[]>> =>
      run(async () => {
        const saved = await writeProjectVariables(
          readProjectPath(projectPath),
          readVariables(variables)
        )

        // IPC 契约返回 variables 数组，而不是完整 ProjectVariablesFile。
        return saved.variables
      })
  )

  ipcMain.handle(IPC_CHANNELS.attributes.read, (_event, projectPath: unknown) =>
    run(() => readCharacterAttributeState(readProjectPath(projectPath)))
  )

  ipcMain.handle(
    IPC_CHANNELS.attributes.write,
    (_event, projectPath: unknown, state: unknown) =>
      run(() =>
        writeCharacterAttributeState(
          readProjectPath(projectPath),
          readAttributeState(state)
        )
      )
  )

  ipcMain.handle(IPC_CHANNELS.evgData.read, (_event, projectPath: unknown) =>
    run(async () => {
      const table = await parseEvgDataTable(readProjectPath(projectPath))
      return readEvgDataRecords(table)
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.evgData.write,
    (_event, projectPath: unknown, records: unknown) =>
      run(async () => {
        const table = await parseEvgDataTable(readProjectPath(projectPath))
        return writeEvgDataRecords(table, readEvgDataRecordList(records))
      })
  )

  ipcMain.handle(IPC_CHANNELS.chapters.read, (_event, projectPath: unknown) =>
    run(() => parseChapterSummaries(readProjectPath(projectPath)))
  )

  ipcMain.handle(IPC_CHANNELS.scenes.read, (_event, projectPath: unknown) =>
    run(() => parseSceneSummaries(readProjectPath(projectPath)))
  )

  ipcMain.handle(IPC_CHANNELS.schedule.read, (_event, projectPath: unknown) =>
    run(async () => {
      // 只读：编辑器对调度蓝图（schedule 节）只做检查提示，不写回。
      const raw = await readFile(join(readProjectPath(projectPath), 'project.json'), 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null
      }
      return (parsed as { schedule?: unknown }).schedule ?? null
    })
  )

  ipcMain.handle(
    IPC_CHANNELS.assets.read,
    (_event, projectPath: unknown, assetPath: unknown) =>
      run(() =>
        readProjectAssetDataUrl(
          readProjectPath(projectPath),
          readAssetPath(assetPath)
        )
      )
  )
}
