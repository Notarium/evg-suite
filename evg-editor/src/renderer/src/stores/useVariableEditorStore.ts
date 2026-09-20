import { create } from 'zustand'
import type {
  AttributeType,
  AttributeValue,
  CharacterAttributeState,
  NewAttributeTypeInput
} from '../../../shared/attribute'
import {
  createAttributeType,
  getDefaultAttributeValue,
  isAttributeValue
} from '../../../shared/attribute'
import type { IpcResult } from '../../../shared/ipc'
import type {
  NewProjectVariableInput,
  ProjectVariable,
  VariablePersistence,
  VariableType
} from '../../../shared/variable'
import {
  createProjectVariable,
  getDefaultVariableValue
} from '../../../shared/variable'

export interface VariablePatch {
  name?: string
  type?: VariableType
  defaultValue?: unknown
  persistence?: VariablePersistence
}

/**
 * 变量与角色属性的编辑 store。
 *
 * 与 useEvgDataStore 同款草稿模式：variables / attributeState 是内存草稿，
 * 除 saveVariables / saveAttributes / saveChanged 外的动作都只改草稿并
 * 置脏（dirtyVariables / dirtyAttributes 分别对应两个文件），页面用
 * 右上角「保存」写盘、「取消修改」（reload）回滚到文件当前状态。
 * load 对同一 projectPath 跳过，草稿在页面切换间保留。
 */

interface VariableEditorState {
  projectPath: string | null
  loadedPath: string | null
  variables: ProjectVariable[]
  /** project.variables.json 是否存在（false = 引擎端尚未设置过变量，页面锁定）。 */
  variablesFileExists: boolean
  attributeState: CharacterAttributeState | null
  loading: boolean
  saving: boolean
  dirtyVariables: boolean
  dirtyAttributes: boolean
  errorMessage: string | null
  load: (projectPath: string) => Promise<void>
  reload: (projectPath: string) => Promise<void>
  unload: () => void
  /** 写 project.variables.json；主页同步面板传入合成数组，页面保存传当前草稿。 */
  saveVariables: (variables: ProjectVariable[]) => Promise<boolean>
  /** 写 characters.json（当前草稿）。 */
  saveAttributes: () => Promise<boolean>
  /** 按脏标记依次写盘；页面「保存」按钮入口。 */
  saveChanged: () => Promise<boolean>
  addVariable: (input: NewProjectVariableInput) => ProjectVariable | null
  updateVariable: (id: string, patch: VariablePatch) => boolean
  removeVariable: (id: string) => void
  addAttributeType: (input: NewAttributeTypeInput) => AttributeType | null
  /** 按 id 定位（实时编辑改名过程中名字可能为空 / 中间态，名字不可靠）。 */
  updateAttributeType: (id: string, input: NewAttributeTypeInput) => boolean
  removeAttributeType: (name: string) => void
  setCharacterAttributeValue: (
    characterId: string,
    attributeName: string,
    value: AttributeValue | undefined
  ) => void
  clearError: () => void
}

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.data
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

function getVariablesApi(): Window['api']['variables'] {
  const api = window.api?.variables
  if (!api) {
    throw new Error(
      '当前运行环境未注入 variables API。请完全退出并重新启动应用；preload 更新需要重启 Electron。'
    )
  }
  return api
}

function getAttributesApi(): Window['api']['attributes'] {
  const api = window.api?.attributes
  if (!api) {
    throw new Error(
      '当前运行环境未注入 attributes API。请完全退出并重新启动应用；preload 更新需要重启 Electron。'
    )
  }
  return api
}

async function readEditorData(projectPath: string): Promise<{
  variables: ProjectVariable[]
  variablesFileExists: boolean
  attributeState: CharacterAttributeState
}> {
  const [snapshot, attributeState] = await Promise.all([
    getVariablesApi().read(projectPath).then(unwrap),
    getAttributesApi().read(projectPath).then(unwrap)
  ])

  return {
    variables: snapshot.variables,
    variablesFileExists: snapshot.fileExists,
    attributeState
  }
}

export const useVariableEditorStore = create<VariableEditorState>((set, get) => ({
  projectPath: null,
  loadedPath: null,
  variables: [],
  variablesFileExists: false,
  attributeState: null,
  loading: false,
  saving: false,
  dirtyVariables: false,
  dirtyAttributes: false,
  errorMessage: null,

  load: async (projectPath) => {
    if (get().loading) return
    if (get().loadedPath === projectPath) return

    set({ loading: true, errorMessage: null, projectPath })

    try {
      const { variables, variablesFileExists, attributeState } =
        await readEditorData(projectPath)

      set({
        variables,
        variablesFileExists,
        attributeState,
        loadedPath: projectPath,
        loading: false,
        dirtyVariables: false,
        dirtyAttributes: false
      })
    } catch (error) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  reload: async (projectPath) => {
    set({ loading: true, errorMessage: null, projectPath })

    try {
      const { variables, variablesFileExists, attributeState } =
        await readEditorData(projectPath)

      set({
        variables,
        variablesFileExists,
        attributeState,
        loadedPath: projectPath,
        loading: false,
        dirtyVariables: false,
        dirtyAttributes: false
      })
    } catch (error) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  unload: () => {
    set({
      projectPath: null,
      loadedPath: null,
      variables: [],
      attributeState: null,
      loading: false,
      saving: false,
      dirtyVariables: false,
      dirtyAttributes: false,
      errorMessage: null
    })
  },

  saveVariables: async (variables) => {
    const projectPath = get().projectPath
    if (!projectPath) {
      set({ errorMessage: '尚未打开项目' })
      return false
    }

    // 写入安全（最终防线）：project.variables.json 由引擎在用户设置变量
    // 时创建。文件不存在时任何写入都会凭空新建它——这是被禁止的操作，
    // 无论哪个调用方（主页同步 / 本页保存）都必须在这里被拦下。
    if (!get().variablesFileExists) {
      set({
        errorMessage:
          'project.variables.json 不存在（需先在引擎编辑器里设置变量），已阻止写入'
      })
      return false
    }

    // 快照进入保存时的状态；写盘期间的并发编辑以此判断，而不是以
    // 入参引用判断——调用方（主页同步面板等）传的通常是派生数组，
    // 引用必然不同，按入参判断会让 store 永远不吸收保存结果。
    const snapshot = get().variables

    set({ saving: true, errorMessage: null })

    try {
      const saved = unwrap(await getVariablesApi().write(projectPath, variables))

      if (!Array.isArray(saved)) {
        throw new Error('变量保存返回格式异常：期望变量数组')
      }

      if (get().variables !== snapshot) {
        // 保存期间用户继续编辑：保留内存中的新编辑，脏标记保持，
        // 等待下一次保存。
        set({ saving: false })
        return true
      }

      set({ variables: saved, saving: false, dirtyVariables: false })
      return true
    } catch (error) {
      set({ saving: false, errorMessage: getErrorMessage(error) })
      return false
    }
  },

  saveAttributes: async () => {
    const projectPath = get().projectPath
    const state = get().attributeState
    if (!projectPath || !state) {
      set({ errorMessage: '尚未打开项目' })
      return false
    }

    const snapshot = state

    set({ saving: true, errorMessage: null })

    try {
      const saved = unwrap(await getAttributesApi().write(projectPath, state))

      if (get().attributeState !== snapshot) {
        // 保存期间用户继续编辑：保留内存中的新状态，脏标记保持。
        set({ saving: false })
        return true
      }

      set({ attributeState: saved, saving: false, dirtyAttributes: false })
      return true
    } catch (error) {
      set({ saving: false, errorMessage: getErrorMessage(error) })
      return false
    }
  },

  saveChanged: async () => {
    let ok = true

    if (get().dirtyVariables) {
      ok = (await get().saveVariables(get().variables)) && ok
    }
    if (get().dirtyAttributes) {
      ok = (await get().saveAttributes()) && ok
    }

    return ok
  },

  addVariable: (input) => {
    try {
      const variable = createProjectVariable(input)
      set({
        variables: [...get().variables, variable],
        dirtyVariables: true
      })
      return variable
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
      return null
    }
  },

  updateVariable: (id, patch) => {
    const current = get().variables.find((variable) => variable.id === id)
    if (!current) {
      set({ errorMessage: '变量不存在，可能已被移除' })
      return false
    }

    try {
      const nextType = patch.type ?? current.type
      const nextDefaultValue =
        patch.defaultValue !== undefined
          ? patch.defaultValue
          : patch.type !== undefined && patch.type !== current.type
            ? getDefaultVariableValue(nextType)
            : current.defaultValue

      const next = {
        ...current,
        name: patch.name ?? current.name,
        type: nextType,
        defaultValue: nextDefaultValue,
        persistence: patch.persistence ?? current.persistence
      } as ProjectVariable

      set({
        variables: get().variables.map((variable) =>
          variable.id === id ? next : variable
        ),
        dirtyVariables: true
      })
      return true
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
      return false
    }
  },

  removeVariable: (id) => {
    set({
      variables: get().variables.filter((variable) => variable.id !== id),
      dirtyVariables: true
    })
  },

  addAttributeType: (input) => {
    const state = get().attributeState
    if (!state) {
      set({ errorMessage: '角色属性尚未加载' })
      return null
    }

    try {
      if (state.definitions.some((definition) => definition.name === input.name)) {
        throw new Error(`属性名已存在：${input.name}`)
      }

      const definition = createAttributeType(input)
      set({
        attributeState: {
          ...state,
          definitions: [...state.definitions, definition]
        },
        dirtyAttributes: true
      })
      return definition
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
      return null
    }
  },

  updateAttributeType: (id, input) => {
    const state = get().attributeState
    if (!state) {
      set({ errorMessage: '角色属性尚未加载' })
      return false
    }

    const current = state.definitions.find(
      (definition) => definition.id === id
    )
    if (!current) {
      set({ errorMessage: '属性模板不存在，可能已被移除' })
      return false
    }

    // 改名迁移以本次修改前的名字为源键；input.name 为目标键。
    const currentName = current.name

    try {
      const nextType = input.type
      const nextDefaultValue =
        input.defaultValue !== undefined
          ? input.defaultValue
          : getDefaultAttributeValue(nextType)

      if (!isAttributeValue(nextType, nextDefaultValue)) {
        throw new Error('默认值与属性类型不匹配')
      }

      const nextDefinition = {
        ...current,
        name: input.name,
        type: nextType,
        defaultValue: nextDefaultValue
      } as AttributeType

      const characters = state.characters.map((character) => {
        const oldValue = character.attributeValues[currentName]
        if (oldValue === undefined) return character

        const nextValues = { ...character.attributeValues }
        delete nextValues[currentName]

        if (isAttributeValue(nextType, oldValue)) {
          nextValues[input.name] = oldValue
        }

        return { ...character, attributeValues: nextValues }
      })

      set({
        attributeState: {
          definitions: state.definitions.map((definition) =>
            definition.name === currentName ? nextDefinition : definition
          ),
          characters
        },
        dirtyAttributes: true
      })
      return true
    } catch (error) {
      set({ errorMessage: getErrorMessage(error) })
      return false
    }
  },

  removeAttributeType: (name) => {
    const state = get().attributeState
    if (!state) return

    set({
      attributeState: {
        definitions: state.definitions.filter(
          (definition) => definition.name !== name
        ),
        characters: state.characters.map((character) => {
          if (character.attributeValues[name] === undefined) return character

          const nextValues = { ...character.attributeValues }
          delete nextValues[name]
          return { ...character, attributeValues: nextValues }
        })
      },
      dirtyAttributes: true
    })
  },

  setCharacterAttributeValue: (characterId, attributeName, value) => {
    const state = get().attributeState
    if (!state) return

    set({
      attributeState: {
        ...state,
        characters: state.characters.map((character) => {
          if (character.id !== characterId) return character

          const nextValues = { ...character.attributeValues }
          if (value === undefined) {
            delete nextValues[attributeName]
          } else {
            nextValues[attributeName] = value
          }

          return { ...character, attributeValues: nextValues }
        })
      },
      dirtyAttributes: true
    })
  },

  clearError: () => {
    set({ errorMessage: null })
  }
}))
