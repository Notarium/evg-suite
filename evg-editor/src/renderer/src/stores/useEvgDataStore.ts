import { create } from 'zustand'
import type { EvgDataRecord } from '../../../shared/database'
import type { IpcResult } from '../../../shared/ipc'

interface EvgDataState {
  projectPath: string | null
  loadedPath: string | null
  records: EvgDataRecord[]
  loading: boolean
  saving: boolean
  dirty: boolean
  errorMessage: string | null
  load: (projectPath: string) => Promise<void>
  reload: (projectPath: string) => Promise<void>
  unload: () => void
  setRecords: (records: EvgDataRecord[]) => void
  saveRecords: () => Promise<boolean>
  clearError: () => void
}

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function getEvgDataApi(): Window['api']['evgData'] {
  const api = window.api?.evgData

  if (!api) {
    throw new Error(
      '当前运行环境未注入 evgData API。请完全退出并重新启动应用；preload 更新需要重启 Electron。'
    )
  }

  return api
}

async function readRecords(projectPath: string): Promise<EvgDataRecord[]> {
  return unwrap(await getEvgDataApi().read(projectPath))
}

export const useEvgDataStore = create<EvgDataState>((set, get) => ({
  projectPath: null,
  loadedPath: null,
  records: [],
  loading: false,
  saving: false,
  dirty: false,
  errorMessage: null,

  load: async (projectPath) => {
    if (get().loading) return
    if (get().loadedPath === projectPath) return

    set({ loading: true, errorMessage: null, projectPath })

    try {
      const records = await readRecords(projectPath)
      set({
        records,
        loadedPath: projectPath,
        loading: false,
        dirty: false
      })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  reload: async (projectPath) => {
    set({ loading: true, errorMessage: null, projectPath })

    try {
      const records = await readRecords(projectPath)
      set({
        records,
        loadedPath: projectPath,
        loading: false,
        dirty: false
      })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  unload: () => {
    set({
      projectPath: null,
      loadedPath: null,
      records: [],
      loading: false,
      saving: false,
      dirty: false,
      errorMessage: null
    })
  },

  setRecords: (records) => {
    set({ records, dirty: true })
  },

  saveRecords: async () => {
    const projectPath = get().projectPath
    if (!projectPath) {
      set({ errorMessage: '尚未打开项目' })
      return false
    }

    const snapshot = get().records
    set({ saving: true, errorMessage: null })

    try {
      const saved = unwrap(
        await getEvgDataApi().write(projectPath, snapshot)
      )

      if (!Array.isArray(saved)) {
        throw new Error('evg-data 保存返回格式异常：期望记录数组')
      }

      if (get().records !== snapshot) {
        // 保存期间用户继续编辑：保留内存中的新编辑并保持 dirty，
        // 等待下一次保存；不能用保存时的快照覆盖它们。
        set({ saving: false })
        return true
      }

      set({ records: saved, saving: false, dirty: false })
      return true
    } catch (error) {
      set({ saving: false, errorMessage: getErrorMessage(error) })
      return false
    }
  },

  clearError: () => {
    set({ errorMessage: null })
  }
}))
