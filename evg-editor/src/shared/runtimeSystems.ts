/**
 * Runtime 系统子系统所需的变量声明与检查。
 *
 * 背景：evg-runtime 会接管“时间”“物品系统”等系统级功能，这些功能
 * 需要一组约定好的项目变量（project.variables.json）。编辑器负责在
 * 主页展示这些变量的就绪状态，并提供一键写入。
 *
 * 扩展空间（设计约定）：
 * - 变量名统一使用 `evg.<systemId>.<name>` 命名空间，避免与项目
 *   自建变量冲突；
 * - RuntimeSystemSpec 只描述“变量需求”；后续 runtime 设计确定后，可以
 *   在这里追加可选字段（如 slots / methods / dataRows，声明该系统需要的
 *   系统槽位、扩展方法或 evg-data 行），主页检查器按字段逐步扩展；
 * - 当前清单是编辑器内置草案；将来 runtime 的 extension.json 若声明了
 *   所需变量，可在此处与扩展声明合并，UI 与写入逻辑不需要变化。
 *
 * 本文件零依赖（只引用 ./variable），可随契约一起共享给 runtime。
 */

import {
  type ProjectVariable,
  type VariablePersistence,
  type VariableType,
  createProjectVariable
} from './variable'

/** Runtime 系统变量不允许 pending：运行时要直接参与求值。 */
export type RuntimeVariableType = Exclude<VariableType, 'pending'>

/** Runtime 系统写入的变量统一使用的 kind，便于与项目自建变量区分。 */
export const RUNTIME_VARIABLE_KIND = 'system'

export interface RuntimeVariableSpec {
  /** 变量名；约定 `evg.<systemId>.<name>`。 */
  name: string
  /** 展示名。 */
  label: string
  type: RuntimeVariableType
  /** 规范默认值；修复类型不符时会重置为该值。 */
  defaultValue: string | number | boolean
  persistence: VariablePersistence
  /** 变量用途说明，展示在主页检查列表。 */
  description?: string
}

export interface RuntimeSystemSpec {
  /** 系统标识，如 'time' / 'inventory'；与扩展声明对齐时使用。 */
  id: string
  /** 展示名。 */
  label: string
  /** 系统说明。 */
  description?: string
  /** 该系统正常运行所需的变量清单。 */
  variables: RuntimeVariableSpec[]
  /**
   * 预留：后续补充该系统的非变量需求（系统槽位、扩展方法、evg-data 行等）。
   * 现阶段保持为空对象，字段随 runtime 设计逐步固化。
   */
  [key: string]: unknown
}

/* ==========================================================================
 * 内置系统清单（草案，随 runtime 设计演进）
 * ========================================================================== */

export const RUNTIME_SYSTEM_SPECS: readonly RuntimeSystemSpec[] = [
  {
    id: 'time',
    label: '时间系统',
    description: '游戏内时间推进。变量随存档（slot）保存。',
    variables: [
      {
        name: 'evg.time.day',
        label: '当前天数',
        type: 'number',
        defaultValue: 1,
        persistence: 'slot',
        description: '从 1 开始累计的天数'
      },
      {
        name: 'evg.time.slot',
        label: '当前时段',
        type: 'string',
        defaultValue: 'morning',
        persistence: 'slot',
        description: '时段标识，如 morning / afternoon / evening / night'
      },
      {
        name: 'evg.time.paused',
        label: '时间暂停',
        type: 'bool',
        defaultValue: false,
        persistence: 'slot',
        description: '为 true 时暂停时间推进'
      }
    ]
  },
  {
    id: 'inventory',
    label: '物品系统',
    description:
      '物品与货币。持有状态 = 每物品一个 number 变量（见 buildItemVariableSystemSpec）；' +
      '货币等标量走普通变量。',
    variables: [
      {
        name: 'evg.inventory.gold',
        label: '货币',
        type: 'number',
        defaultValue: 0,
        persistence: 'slot',
        description: '当前持有的货币数量'
      }
    ]
  },
  {
    id: 'weather',
    label: '天气系统',
    description: '时间推进时按权重 roll 天气，写入当前天气变量；清单为空 = 未使用。',
    variables: [
      {
        name: 'evg.weather.current',
        label: '当前天气',
        type: 'string',
        defaultValue: '',
        persistence: 'slot',
        description:
          '时间推进时 roll 出的天气 id；天气清单为空时本变量不声明、不 roll'
      }
    ]
  },
  {
    id: 'location',
    label: '位置系统',
    description:
      '章节即地点（chapter = location），移动 = 章节切换。变量随存档（slot）保存。',
    variables: [
      {
        name: 'evg.location.current',
        label: '当前地点',
        type: 'string',
        defaultValue: '',
        persistence: 'slot',
        description:
          '当前所在地点的章节 id；空串 = 未初始化，运行时用配置的初始地点填充'
      }
    ]
  }
]

/**
 * 从运行数据配置的物品清单生成"物品变量"动态系统规格。
 *
 * 持有状态 = 每物品一个 number 变量 `evg.item.<itemId>`（number / 0 /
 * slot），由 add-item / remove-item 动作或剧本 SetVariable 维护。物品是
 * 项目数据而非内置清单，所以主页检查时从 runtime-config 行现算这一节；
 * 没有物品（或没有配置条目）时返回 null，面板不显示该节。
 */
export function buildItemVariableSystemSpec(
  items: ReadonlyArray<{ id: string; name: string }>
): RuntimeSystemSpec | null {
  const variables = items
    .filter((item) => item.id !== '')
    .map((item) => ({
      name: `evg.item.${item.id}`,
      label: item.name || item.id,
      type: 'number' as const,
      defaultValue: 0,
      persistence: 'slot' as const,
      description: '物品持有量；由 add-item / remove-item 或剧本 SetVariable 维护'
    }))

  if (variables.length === 0) return null

  return {
    id: 'inventory-items',
    label: '物品变量',
    description: '按运行数据配置的物品清单生成（evg.item.<物品id>）。',
    variables
  }
}

/**
 * 从运行数据配置的天气清单生成"天气变量"动态系统规格。
 *
 * 天气清单非空时声明 evg.weather.current（string / '' / slot）；空清单
 * = 项目不使用天气系统，返回 null，面板不显示该节。静态清单里的 weather
 * 节描述契约本身，本函数描述"项目是否真的在用"——与物品变量同款分层。
 */
export function buildWeatherVariableSystemSpec(
  weathers: ReadonlyArray<{ id: string; name: string }>
): RuntimeSystemSpec | null {
  if (weathers.length === 0) return null

  return {
    id: 'weather-current',
    label: '天气变量',
    description: '天气清单已配置，时间推进时 roll 写入。',
    variables: [
      {
        name: 'evg.weather.current',
        label: '当前天气',
        type: 'string',
        defaultValue: '',
        persistence: 'slot',
        description: `候选：${weathers.map((w) => w.name || w.id).join(' / ')}`
      }
    ]
  }
}

/* ==========================================================================
 * 检查与修复
 * ========================================================================== */

export type RuntimeVariableStatus =
  | 'ok'
  | 'missing'
  | 'type-mismatch'
  | 'persistence-mismatch'

export interface RuntimeVariableCheck {
  spec: RuntimeVariableSpec
  /** 按变量名匹配到的现有变量；缺失时为 null。 */
  existing: ProjectVariable | null
  status: RuntimeVariableStatus
}

export interface RuntimeSystemDiff {
  system: RuntimeSystemSpec
  checks: RuntimeVariableCheck[]
  /** 需要新增的变量。 */
  missing: RuntimeVariableCheck[]
  /** 已存在但类型或持久化范围与规范不符的变量。 */
  mismatched: RuntimeVariableCheck[]
}

/** 检查单个系统所需变量的就绪状态。 */
export function diffRuntimeSystem(
  variables: readonly ProjectVariable[],
  system: RuntimeSystemSpec
): RuntimeSystemDiff {
  const byName = new Map(
    variables.map((variable) => [variable.name, variable])
  )

  const checks: RuntimeVariableCheck[] = system.variables.map((spec) => {
    const existing = byName.get(spec.name) ?? null

    if (!existing) {
      return { spec, existing: null, status: 'missing' }
    }
    if (existing.type !== spec.type) {
      return { spec, existing, status: 'type-mismatch' }
    }
    if (existing.persistence !== spec.persistence) {
      return { spec, existing, status: 'persistence-mismatch' }
    }
    return { spec, existing, status: 'ok' }
  })

  return {
    system,
    checks,
    missing: checks.filter((check) => check.status === 'missing'),
    mismatched: checks.filter(
      (check) =>
        check.status === 'type-mismatch' || check.status === 'persistence-mismatch'
    )
  }
}

/** 检查全部内置系统。 */
export function diffAllRuntimeSystems(
  variables: readonly ProjectVariable[],
  specs: readonly RuntimeSystemSpec[] = RUNTIME_SYSTEM_SPECS
): RuntimeSystemDiff[] {
  return specs.map((system) => diffRuntimeSystem(variables, system))
}

export function hasRuntimeIssues(diff: RuntimeSystemDiff): boolean {
  return diff.missing.length > 0 || diff.mismatched.length > 0
}

/**
 * 应用一个系统的修复，返回写回用的变量数组（不修改入参）：
 * - 缺失变量按规范新增，kind 使用 RUNTIME_VARIABLE_KIND；
 * - 类型或持久化不符的变量对齐到规范（type / defaultValue / persistence
 *   以规范为准，保留 id、name、kind、createdAt 与其它未知字段）；
 * - 已就绪的变量原样保留。
 */
export function applyRuntimeSystemFix(
  variables: readonly ProjectVariable[],
  diff: RuntimeSystemDiff
): ProjectVariable[] {
  let next = [...variables]

  for (const check of diff.missing) {
    next.push(
      createProjectVariable({
        name: check.spec.name,
        type: check.spec.type,
        defaultValue: check.spec.defaultValue,
        persistence: check.spec.persistence,
        kind: RUNTIME_VARIABLE_KIND
      })
    )
  }

  if (diff.mismatched.length > 0) {
    const mismatchByName = new Map(
      diff.mismatched.map((check) => [check.spec.name, check])
    )
    next = next.map((variable) => {
      const check = mismatchByName.get(variable.name)
      if (!check) return variable
      return {
        ...variable,
        type: check.spec.type,
        defaultValue: check.spec.defaultValue,
        persistence: check.spec.persistence
      } as ProjectVariable
    })
  }

  return next
}
