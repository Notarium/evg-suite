import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { CharacterAttributeState } from '../shared/attribute'
import type { ChapterSummary } from '../shared/chapter'
import type { EvgDataRecord } from '../shared/database'
import { IPC_CHANNELS, type AppApi, type IpcResult } from '../shared/ipc'
import type { ProjectRecord } from '../shared/project'
import type { SceneSummary } from '../shared/scene'
import type { ProjectVariable } from '../shared/variable'

function invoke<T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> {
  return ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>
}

const api: AppApi = {
  platform: process.platform,
  window: {
    minimize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.window.minimize)
    },
    toggleMaximize: (): void => {
      ipcRenderer.send(IPC_CHANNELS.window.toggleMaximize)
    },
    close: (): void => {
      ipcRenderer.send(IPC_CHANNELS.window.close)
    },
    onMaximizeChange: (callback: (maximized: boolean) => void): (() => void) => {
      const listener = (_event: IpcRendererEvent, maximized: boolean): void => {
        callback(maximized)
      }

      ipcRenderer.on(IPC_CHANNELS.window.maximizeChanged, listener)

      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.window.maximizeChanged, listener)
      }
    }
  },
  projects: {
    list: () => invoke<ProjectRecord[]>(IPC_CHANNELS.projects.list),
    open: () => invoke<ProjectRecord | null>(IPC_CHANNELS.projects.open),
    openRecent: (id: string) => invoke<ProjectRecord>(IPC_CHANNELS.projects.openRecent, id),
    reload: (id: string) => invoke<ProjectRecord>(IPC_CHANNELS.projects.reload, id),
    remove: (id: string) => invoke<ProjectRecord[]>(IPC_CHANNELS.projects.remove, id),
    clear: () => invoke<ProjectRecord[]>(IPC_CHANNELS.projects.clear)
  },
  variables: {
    read: (projectPath: string) =>
      invoke<ProjectVariable[]>(IPC_CHANNELS.variables.read, projectPath),
    write: (projectPath: string, variables: ProjectVariable[]) =>
      invoke<ProjectVariable[]>(
        IPC_CHANNELS.variables.write,
        projectPath,
        variables
      )
  },
  attributes: {
    read: (projectPath: string) =>
      invoke<CharacterAttributeState>(IPC_CHANNELS.attributes.read, projectPath),
    write: (projectPath: string, state: CharacterAttributeState) =>
      invoke<CharacterAttributeState>(
        IPC_CHANNELS.attributes.write,
        projectPath,
        state
      )
  },
  evgData: {
    read: (projectPath: string) =>
      invoke<EvgDataRecord[]>(IPC_CHANNELS.evgData.read, projectPath),
    write: (projectPath: string, records: EvgDataRecord[]) =>
      invoke<EvgDataRecord[]>(
        IPC_CHANNELS.evgData.write,
        projectPath,
        records
      )
  },
  schedule: {
    read: (projectPath: string) =>
      invoke<unknown>(IPC_CHANNELS.schedule.read, projectPath)
  },
  chapters: {
    read: (projectPath: string) =>
      invoke<ChapterSummary[]>(IPC_CHANNELS.chapters.read, projectPath)
  },
  scenes: {
    read: (projectPath: string) =>
      invoke<SceneSummary[]>(IPC_CHANNELS.scenes.read, projectPath)
  },
  assets: {
    read: (projectPath: string, assetPath: string) =>
      invoke<string>(
        IPC_CHANNELS.assets.read,
        projectPath,
        assetPath
      )
  }
}

contextBridge.exposeInMainWorld('api', api)
