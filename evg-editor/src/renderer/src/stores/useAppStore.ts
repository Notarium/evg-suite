import { create } from 'zustand'
import type { IpcResult } from '../../../shared/ipc'
import type { ProjectRecord } from '../../../shared/project'
import { useChapterStore } from './useChapterStore'
import { useEvgDataStore } from './useEvgDataStore'
import { useSceneStore } from './useSceneStore'
import { useVariableEditorStore } from './useVariableEditorStore'

export type PageKey = 'home' | 'variables' | 'conditions' | 'actions' | 'events' | 'locations' | 'runtime' | 'settings'
export type Theme = 'light' | 'dark'
export type Skin = 'fluent' | 'win98'

const THEME_STORAGE_KEY = 'evg-editor:theme'
const SKIN_STORAGE_KEY = 'evg-editor:skin'
const SIDEBAR_STORAGE_KEY = 'evg-editor:sidebar-collapsed'

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function persistTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Theme persistence is optional; ignore storage failures.
  }
}

function readStoredSkin(): Skin {
  try {
    const stored = window.localStorage.getItem(SKIN_STORAGE_KEY)
    return stored === 'fluent' ? 'fluent' : 'win98'
  } catch {
    return 'win98'
  }
}

function persistSkin(skin: Skin): void {
  try {
    window.localStorage.setItem(SKIN_STORAGE_KEY, skin)
  } catch {
    // Skin persistence is optional; ignore storage failures.
  }
}

function readStoredSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persistSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  } catch {
    // Sidebar persistence is optional; ignore storage failures.
  }
}

interface AppState {
  activePage: PageKey
  theme: Theme
  skin: Skin
  sidebarCollapsed: boolean
  history: ProjectRecord[]
  currentProject: ProjectRecord | null
  loading: boolean
  initialized: boolean
  errorMessage: string | null
  setActivePage: (page: PageKey) => void
  setTheme: (theme: Theme) => void
  setSkin: (skin: Skin) => void
  toggleSidebar: () => void
  toggleTheme: () => void
  initialize: () => Promise<void>
  openProject: () => Promise<void>
  openRecent: (id: string) => Promise<void>
  removeProject: (id: string) => Promise<void>
  clearHistory: () => Promise<void>
  closeProject: () => void
  refreshProject: () => Promise<void>
  clearError: () => void
}

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'home',
  theme: readStoredTheme(),
  skin: readStoredSkin(),
  sidebarCollapsed: readStoredSidebarCollapsed(),
  history: [],
  currentProject: null,
  loading: false,
  initialized: false,
  errorMessage: null,

  setActivePage: (activePage) => {
    set({ activePage })
  },

  setTheme: (theme) => {
    persistTheme(theme)
    set({ theme })
  },

  setSkin: (skin) => {
    persistSkin(skin)
    set({ skin })
  },

  toggleSidebar: () => {
    const sidebarCollapsed = !get().sidebarCollapsed
    persistSidebarCollapsed(sidebarCollapsed)
    set({ sidebarCollapsed })
  },

  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    persistTheme(theme)
    set({ theme })
  },

  initialize: async () => {
    if (get().initialized || get().loading) return

    set({ loading: true, errorMessage: null })

    try {
      const history = unwrap(await window.api.projects.list())
      set({ history, initialized: true, loading: false })
    } catch (error) {
      set({
        initialized: true,
        loading: false,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  openProject: async () => {
    if (get().loading) return

    set({ loading: true, errorMessage: null })

    try {
      const project = unwrap(await window.api.projects.open())

      if (!project) {
        set({ loading: false })
        return
      }

      const history = unwrap(await window.api.projects.list())
      set({
        currentProject: project,
        history,
        activePage: 'home',
        loading: false
      })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  openRecent: async (id) => {
    if (get().loading) return

    set({ loading: true, errorMessage: null })

    try {
      const project = unwrap(await window.api.projects.openRecent(id))
      const history = unwrap(await window.api.projects.list())
      set({
        currentProject: project,
        history,
        activePage: 'home',
        loading: false
      })
    } catch (error) {
      try {
        const history = unwrap(await window.api.projects.list())
        set({ history })
      } catch {
        // Keep the original error state; history refresh is best-effort.
      }

      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  removeProject: async (id) => {
    set({ errorMessage: null })

    try {
      const history = unwrap(await window.api.projects.remove(id))
      const currentProject = get().currentProject

      set({
        history,
        currentProject: currentProject?.id === id ? null : currentProject
      })
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
    }
  },

  clearHistory: async () => {
    set({ errorMessage: null })

    try {
      const history = unwrap(await window.api.projects.clear())
      set({ history, currentProject: null })
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
    }
  },

  closeProject: () => {
    useVariableEditorStore.getState().unload()
    useEvgDataStore.getState().unload()
    useChapterStore.getState().unload()
    useSceneStore.getState().unload()
    set({ currentProject: null, activePage: 'home', errorMessage: null })
  },

  refreshProject: async () => {
    const currentProject = get().currentProject
    if (!currentProject || get().loading) return

    set({ loading: true, errorMessage: null })

    try {
      const project = unwrap(await window.api.projects.reload(currentProject.id))
      await useVariableEditorStore.getState().reload(project.path)
      await useEvgDataStore.getState().reload(project.path)
      await useChapterStore.getState().reload(project.path)
      await useSceneStore.getState().reload(project.path)
      set({ currentProject: project, loading: false })
    } catch (error) {
      set({ loading: false, errorMessage: getErrorMessage(error) })
    }
  },

  clearError: () => {
    set({ errorMessage: null })
  }
}))
