import {
  EVG_ACTION_PURPOSE,
  type CallFragmentActionData,
  type ActionPurpose,
  type ActionType,
  type CallExtensionMethodActionData,
  type CallSystemSlotActionData,
  type SetVariableActionData
} from '../../../../../shared/evgData'
import {
  RUNTIME_METHOD_SPECS,
  type RuntimeMethodSpec
} from '../../../../../shared/runtimeMethods'

export interface ActionOption {
  key: string
  label?: string
}

export type ActionValue = ActionType<ActionPurpose, unknown>

export interface ActionPurposeOption {
  value: ActionPurpose
  label: string
  description: string
}

export const CORE_ACTION_PURPOSE_OPTIONS: readonly ActionPurposeOption[] = [
  {
    value: EVG_ACTION_PURPOSE.SetVariable,
    label: '设置变量',
    description: '修改变量的值'
  },
  {
    value: EVG_ACTION_PURPOSE.CallFragment,
    label: '调用片段',
    description: '调用章节中的 fragment'
  },
  {
    value: EVG_ACTION_PURPOSE.CallExtensionMethod,
    label: '扩展方法',
    description: '调用扩展提供的方法'
  },
  {
    value: EVG_ACTION_PURPOSE.CallSystemSlot,
    label: '系统槽位',
    description: '打开引擎内置系统槽位绑定的界面'
  }
]

/**
 * EVG Runtime 自带方法的一级入口（“EVG Runtime”分组按钮）。
 *
 * 只是编辑器糖：数据上仍是 CallExtensionMethod（purpose=20）+
 * extensionId/methodId/args，运行时与引擎无感知；通用“扩展方法”
 * 入口保留给其它扩展。切换到预设时按清单生成缺省 args（必填项
 * 留空会由参数表单给出警示）。
 */
export interface ActionMethodPreset {
  extensionId: string
  methodId: string
  label: string
  description: string
}

export const EVG_METHOD_PRESETS: readonly ActionMethodPreset[] =
  RUNTIME_METHOD_SPECS.map((spec: RuntimeMethodSpec) => ({
    extensionId: spec.extensionId,
    methodId: spec.methodId,
    label: spec.label,
    description: spec.description
  }))

export function matchActionMethodPreset(
  extensionId: string,
  methodId: string
): ActionMethodPreset | null {
  return (
    EVG_METHOD_PRESETS.find(
      (preset) =>
        preset.extensionId === extensionId && preset.methodId === methodId
    ) ?? null
  )
}

export function createDataForMethodPreset(
  preset: ActionMethodPreset
): CallExtensionMethodActionData {
  const spec = RUNTIME_METHOD_SPECS.find(
    (item) =>
      item.extensionId === preset.extensionId &&
      item.methodId === preset.methodId
  )
  const args: Record<string, string | number | boolean> = {}
  for (const field of spec?.args ?? []) {
    args[field.key] =
      field.type === 'number' ? 1 : field.type === 'boolean' ? false : ''
  }
  return { extensionId: preset.extensionId, methodId: preset.methodId, args }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function readText(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return typeof value === 'string' ? value : ''
}

export function getActionPurposeOption(
  type: ActionPurpose
): ActionPurposeOption | undefined {
  return (CORE_ACTION_PURPOSE_OPTIONS as readonly ActionPurposeOption[]).find(
    (option) => option.value === type
  )
}

export function getActionPurposeLabel(type: ActionPurpose): string {
  return getActionPurposeOption(type)?.label ?? `扩展 ${type}`
}

export function createDefaultSetVariableActionData(): SetVariableActionData {
  return {
    variable: '',
    value: { kind: 'literal', value: '' }
  }
}

export function createDefaultCallFragmentActionData(): CallFragmentActionData {
  return { fragmentId: '' }
}

export function createDefaultCallExtensionMethodActionData(): CallExtensionMethodActionData {
  return { extensionId: '', methodId: '' }
}

export function createDefaultCallSystemSlotActionData(): CallSystemSlotActionData {
  return { slot: '' }
}

export function createActionDataForPurpose(type: ActionPurpose): unknown {
  switch (type) {
    case EVG_ACTION_PURPOSE.SetVariable:
      return createDefaultSetVariableActionData()
    case EVG_ACTION_PURPOSE.CallFragment:
      return createDefaultCallFragmentActionData()
    case EVG_ACTION_PURPOSE.CallExtensionMethod:
      return createDefaultCallExtensionMethodActionData()
    case EVG_ACTION_PURPOSE.CallSystemSlot:
      return createDefaultCallSystemSlotActionData()
    default:
      return {}
  }
}

export function createDefaultAction(
  id: string,
  type: ActionPurpose = EVG_ACTION_PURPOSE.SetVariable
): ActionValue {
  return {
    id,
    label: '新动作',
    guard: true,
    type,
    data: createActionDataForPurpose(type)
  }
}

export function getActionSummary(action: ActionValue): string {
  const data = asRecord(action.data)

  switch (action.type) {
    case EVG_ACTION_PURPOSE.SetVariable: {
      const variable = readText(data, 'variable')
      return variable ? `设置变量 · ${variable}` : '设置变量'
    }

    case EVG_ACTION_PURPOSE.CallFragment: {
      const fragmentId = readText(data, 'fragmentId')
      return fragmentId ? `调用片段 · ${fragmentId}` : '调用片段'
    }

    case EVG_ACTION_PURPOSE.CallExtensionMethod: {
      const extensionId = readText(data, 'extensionId')
      const methodId = readText(data, 'methodId')
      const preset = matchActionMethodPreset(extensionId, methodId)
      if (preset) return `EVG · ${preset.label}`
      const target = [extensionId, methodId].filter(Boolean).join('/')
      return target ? `扩展方法 · ${target}` : '扩展方法'
    }

    case EVG_ACTION_PURPOSE.CallSystemSlot: {
      const slot = readText(data, 'slot')
      return slot ? `系统槽位 · ${slot}` : '系统槽位'
    }

    default:
      return getActionPurposeLabel(action.type)
  }
}
