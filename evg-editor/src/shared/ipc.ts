import type { CharacterAttributeState } from './attribute'
import type { ChapterSummary } from './chapter'
import type { EvgDataRecord } from './database'
import type { ProjectRecord } from './project'
import type { SceneSummary } from './scene'
import type { ProjectVariable } from './variable'

export const IPC_CHANNELS = {
  projects: {
    list: 'projects:list',
    open: 'projects:open',
    openRecent: 'projects:open-recent',
    reload: 'projects:reload',
    remove: 'projects:remove',
    clear: 'projects:clear'
  },
  variables: {
    read: 'variables:read',
    write: 'variables:write'
  },
  attributes: {
    read: 'attributes:read',
    write: 'attributes:write'
  },
  evgData: {
    read: 'evg-data:read',
    write: 'evg-data:write'
  },
  schedule: {
    read: 'schedule:read'
  },
  chapters: {
    read: 'chapters:read'
  },
  scenes: {
    read: 'scenes:read'
  },
  assets: {
    read: 'assets:read'
  },
  window: {
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    maximizeChanged: 'window:maximize-changed'
  }
} as const

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export interface ProjectsApi {
  list: () => Promise<IpcResult<ProjectRecord[]>>
  open: () => Promise<IpcResult<ProjectRecord | null>>
  openRecent: (id: string) => Promise<IpcResult<ProjectRecord>>
  reload: (id: string) => Promise<IpcResult<ProjectRecord>>
  remove: (id: string) => Promise<IpcResult<ProjectRecord[]>>
  clear: () => Promise<IpcResult<ProjectRecord[]>>
}

import type { ProjectVariablesSnapshot } from './variable'
export type { ProjectVariablesSnapshot }

export interface VariablesApi {
  read: (projectPath: string) => Promise<IpcResult<ProjectVariablesSnapshot>>
  write: (
    projectPath: string,
    variables: ProjectVariable[]
  ) => Promise<IpcResult<ProjectVariablesSnapshot>>
}

export interface EvgDataApi {
  read: (projectPath: string) => Promise<IpcResult<EvgDataRecord[]>>
  write: (
    projectPath: string,
    records: EvgDataRecord[]
  ) => Promise<IpcResult<EvgDataRecord[]>>
}


/**
 * Studio 工程调度蓝图（project.json 的 schedule 节）只读读取。
 * 编辑器只做检查与提示，不写回该节。
 */
export interface ScheduleApi {
  read: (projectPath: string) => Promise<IpcResult<unknown>>
}

export interface ChaptersApi {
  read: (projectPath: string) => Promise<IpcResult<ChapterSummary[]>>
}

export interface ScenesApi {
  read: (projectPath: string) => Promise<IpcResult<SceneSummary[]>>
}

export interface AssetsApi {
  /** 读取项目 assets/ 下的资源，返回 data URL。 */
  read: (projectPath: string, assetPath: string) => Promise<IpcResult<string>>
}

export interface CharacterAttributesApi {
  read: (projectPath: string) => Promise<IpcResult<CharacterAttributeState>>
  write: (
    projectPath: string,
    state: CharacterAttributeState
  ) => Promise<IpcResult<CharacterAttributeState>>
}

export interface WindowApi {
  minimize: () => void
  toggleMaximize: () => void
  close: () => void
  onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
}

export interface AppApi {
  platform: string
  window: WindowApi
  projects: ProjectsApi
  variables: VariablesApi
  attributes: CharacterAttributesApi
  evgData: EvgDataApi
  schedule: ScheduleApi
  chapters: ChaptersApi
  scenes: ScenesApi
  assets: AssetsApi
}
