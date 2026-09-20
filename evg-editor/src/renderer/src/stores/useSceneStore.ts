import { create } from 'zustand'
import type { IpcResult } from '../../../shared/ipc'
import type { SceneSummary } from '../../../shared/scene'

interface SceneState {
  projectPath: string | null
  loadedPath: string | null
  scenes: SceneSummary[]
  loading: boolean
  errorMessage: string | null
  load: (projectPath: string) => Promise<void>
  reload: (projectPath: string) => Promise<void>
  unload: () => void
  clearError: () => void
}

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function getSceneApi(): Window['api']['scenes'] {
  const api = window.api?.scenes

  if (!api) {
    throw new Error(
      '当前运行环境未注入 scenes API。请完全退出并重新启动应用；preload 更新需要重启 Electron。'
    )
  }

  return api
}

async function readScenes(projectPath: string): Promise<SceneSummary[]> {
  return unwrap(await getSceneApi().read(projectPath))
}

export const useSceneStore = create<SceneState>((set, get) => ({
  projectPath: null,
  loadedPath: null,
  scenes: [],
  loading: false,
  errorMessage: null,

  load: async (projectPath) => {
    if (get().loading) return
    if (get().loadedPath === projectPath) return

    set({ loading: true, errorMessage: null, projectPath })

    try {
      const scenes = await readScenes(projectPath)
      set({ scenes, loadedPath: projectPath, loading: false })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  reload: async (projectPath) => {
    set({ loading: true, errorMessage: null, projectPath })

    try {
      const scenes = await readScenes(projectPath)
      set({ scenes, loadedPath: projectPath, loading: false })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  unload: () => {
    set({
      projectPath: null,
      loadedPath: null,
      scenes: [],
      loading: false,
      errorMessage: null
    })
  },

  clearError: () => {
    set({ errorMessage: null })
  }
}))
