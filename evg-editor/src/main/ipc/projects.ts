import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS, type IpcResult } from '../../shared/ipc'
import type { ProjectRecord } from '../../shared/project'
import type { ProjectService } from '../services/projectService'

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

function readId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('无效的项目 ID')
  }
  return value
}

export function registerProjectIpc(projectService: ProjectService): void {
  ipcMain.handle(IPC_CHANNELS.projects.list, () => run(() => projectService.list()))

  ipcMain.handle(IPC_CHANNELS.projects.open, (event) =>
    run(() => projectService.openProject(BrowserWindow.fromWebContents(event.sender)))
  )

  ipcMain.handle(IPC_CHANNELS.projects.openRecent, (_event, id: unknown) =>
    run(() => projectService.openRecent(readId(id)))
  )

  ipcMain.handle(IPC_CHANNELS.projects.reload, (_event, id: unknown) =>
    run(() => projectService.reload(readId(id)))
  )

  ipcMain.handle(IPC_CHANNELS.projects.remove, (_event, id: unknown): Promise<IpcResult<ProjectRecord[]>> =>
    run(() => projectService.remove(readId(id)))
  )

  ipcMain.handle(IPC_CHANNELS.projects.clear, () => run(() => projectService.clear()))
}
