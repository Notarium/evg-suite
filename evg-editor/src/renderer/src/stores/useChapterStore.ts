import { create } from 'zustand'
import type { ChapterSummary } from '../../../shared/chapter'
import type { IpcResult } from '../../../shared/ipc'

interface ChapterState {
  projectPath: string | null
  loadedPath: string | null
  chapters: ChapterSummary[]
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

function getChapterApi(): Window['api']['chapters'] {
  const api = window.api?.chapters

  if (!api) {
    throw new Error(
      '当前运行环境未注入 chapters API。请完全退出并重新启动应用；preload 更新需要重启 Electron。'
    )
  }

  return api
}

async function readChapters(projectPath: string): Promise<ChapterSummary[]> {
  return unwrap(await getChapterApi().read(projectPath))
}

export const useChapterStore = create<ChapterState>((set, get) => ({
  projectPath: null,
  loadedPath: null,
  chapters: [],
  loading: false,
  errorMessage: null,

  load: async (projectPath) => {
    if (get().loading) return
    if (get().loadedPath === projectPath) return

    set({ loading: true, errorMessage: null, projectPath })

    try {
      const chapters = await readChapters(projectPath)
      set({
        chapters,
        loadedPath: projectPath,
        loading: false
      })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  reload: async (projectPath) => {
    set({ loading: true, errorMessage: null, projectPath })

    try {
      const chapters = await readChapters(projectPath)
      set({
        chapters,
        loadedPath: projectPath,
        loading: false
      })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  unload: () => {
    set({
      projectPath: null,
      loadedPath: null,
      chapters: [],
      loading: false,
      errorMessage: null
    })
  },

  clearError: () => {
    set({ errorMessage: null })
  }
}))
