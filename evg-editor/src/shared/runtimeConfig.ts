/**
 * Runtime 运行配置的数据模型。
 *
 * 时间 / 物品系统等 Runtime 子系统的设置整理为一个设置对象，
 * 作为一条 evg-data 行整体落盘：
 *
 *   { id: GUID, key: 'runtime-config', type: 1000, data: RuntimeConfigData }
 *
 * 约定：
 * - type=1000 属于 Common.md 的扩展自定义类型区间（引擎保留 1-999），
 *   该配置属于 evg-runtime，不占用引擎保留区；
 * - 行 key 固定为 `runtime-config`，一个项目至多一条；
 * - 编辑器提供“运行数据配置”页（时间 / 物品页签）维护该条目；
 * - 与系统变量的关系见 Common.md 第 9 节：evg.time.slot 的取值即
 *   time.slots 中的时段 id；evg.inventory.gold 是货币数量，
 *   物品持有明细由 Runtime 存档承载。
 *
 * 后续新增子系统（如任务、好感度等）时，在 RuntimeConfigData 上追加
 * 可选字段，并在“运行数据配置”页追加对应页签。
 *
 * 位置调度：chapter 即 location。地点注册 = 该章节存在 LocationMap 行
 * （evg-data type=4，见 evgData.ts）；本 section 只保存调度参数
 * （启用开关、初始地点、导航模板与连通图）。移动通过运行时槽位
 * EVG Runtime 的扩展方法 move-location 触发，参数为
 * { chapterId, chapterName? }；当前位置存变量 evg.location.current。
 *
 * 本文件只依赖 ./variable（创建 GUID），可随契约共享给 runtime。
 */

import { createGuid } from './variable'

/** evg-data 行类型：Runtime 运行配置（扩展区间起点）。 */
export const RUNTIME_CONFIG_DATA_TYPE = 1000

/** 运行配置行的固定业务 key，一个项目至多一条。 */
export const RUNTIME_CONFIG_ROW_KEY = 'runtime-config'

/* ==========================================================================
 * 时间系统配置
 * ========================================================================== */

/**
 * 计时模式：
 * - elapsed  : 只累计天数（evg.time.day 从 1 递增）；
 * - calendar : 使用真实的年月日系统（由 startDate 起始）。
 */
export type RuntimeTimeMode = 'elapsed' | 'calendar'

/** calendar 模式的起始日期。 */
export interface RuntimeStartDate {
  year: number
  month: number
  day: number
}

/** 单日内的一个时段。id 是运行时引用的稳定标识；数组顺序即推进顺序。 */
export interface RuntimeTimeSlotDef {
  id: string
  label: string
}

export interface RuntimeTimeConfig {
  mode: RuntimeTimeMode
  /** calendar 模式的起始日期；elapsed 模式忽略（保留上次的值）。 */
  startDate?: RuntimeStartDate
  /** 是否启用星期。 */
  weekdayEnabled: boolean
  /** 游戏第 1 天（elapsed）或起始日期（calendar）是星期几：1=周一 … 7=周日。 */
  startWeekday: number
  /** 单日内划分的时段，按数组顺序循环推进。 */
  slots: RuntimeTimeSlotDef[]
}

/* ==========================================================================
 * 物品系统配置
 * ========================================================================== */

/** 物品清单中的一项定义。id 由编辑器生成，运行时与事件动作按 id 引用。 */
export interface RuntimeItemDef {
  id: string
  name: string
  description: string
  /** 是否可堆叠。 */
  stackable: boolean
  /** 可堆叠时的最大堆叠数量；不可堆叠时恒为 1。 */
  maxStack: number
}

export interface RuntimeInventoryConfig {
  items: RuntimeItemDef[]
}

/* ==========================================================================
 * 天气系统配置
 * ========================================================================== */

/** 一个天气类型。weight 为相对权重，0 = 不出现；运行时在时间推进时 roll。 */
export interface RuntimeWeatherDef {
  id: string
  name: string
  weight: number
}

export interface RuntimeWeatherConfig {
  /** 天气清单；空数组 = 项目不使用天气系统（不声明变量、不 roll）。 */
  weathers: RuntimeWeatherDef[]
}

/* ==========================================================================
 * 位置系统配置
 * ========================================================================== */

/**
 * 导航模板：
 * - free  : 简单导航，所有启用的地点互相可达；
 * - graph : 连通图导航，按 connections 声明的有向边可达，
 *           编辑器提供 canvas 可视化编辑。
 */
export type RuntimeMovementMode = 'free' | 'graph'

/**
 * 地点层（runtime overlay）的主题偏好，属于项目数据：
 * 由编辑者在运行数据配置 · 地点页签选择，决定玩家看到的画面主题。
 * auto 表示跟随玩家系统深浅色。
 */
export type RuntimeOverlayTheme = 'auto' | 'light' | 'dark'

/** 一条有向连通边：from → to 允许移动（chapterId）。 */
export interface RuntimeLocationConnection {
  from: string
  to: string
}

/** 连通图编辑器里节点的画布坐标（仅编辑器布局用，运行时不关心）。 */
export interface RuntimeGraphNodePosition {
  x: number
  y: number
}

export interface RuntimeLocationConfig {
  /**
   * 初始位置（chapterId）；空串 = 未设置，运行时回退到第一个
   * 未禁用的地点。变量 evg.location.current 为空时也用它填充。
   */
  initialLocation: string
  /** 导航模板。当前实现 free；graph 为连通图导航。 */
  movement: RuntimeMovementMode
  /** movement='graph' 时的有向连通边。free 模式忽略（保留数据）。 */
  connections: RuntimeLocationConnection[]
  /**
   * 地点层（overlay）主题：auto 跟随系统深浅色，light / dark 固定。
   * 缺省视为 auto；将来扩展为完整的 overlay 排版编辑时在此追加。
   */
  theme?: RuntimeOverlayTheme
  /** 连通图编辑器的节点布局坐标，按 chapterId 索引；缺省时编辑器自动排布。 */
  nodePositions?: Record<string, RuntimeGraphNodePosition>
}

/* ==========================================================================
 * 整体设置对象
 * ========================================================================== */

export interface RuntimeConfigData {
  time: RuntimeTimeConfig
  inventory: RuntimeInventoryConfig
  /** 天气系统；空清单 = 未使用。 */
  weather: RuntimeWeatherConfig
  location: RuntimeLocationConfig
}

/* ==========================================================================
 * 常量与默认值
 * ========================================================================== */

/** 星期展示文案，下标 0 对应 startWeekday=1（周一）。 */
export const WEEKDAY_LABELS: ReadonlyArray<string> = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日'
]

export function getWeekdayLabel(startWeekday: number): string {
  return WEEKDAY_LABELS[startWeekday - 1] ?? String(startWeekday)
}

export function createRuntimeSlotId(): string {
  return `slot-${createGuid().slice(0, 8)}`
}

export function createRuntimeItemId(): string {
  return `item-${createGuid().slice(0, 8)}`
}

export function createRuntimeWeatherId(): string {
  return `weather-${createGuid().slice(0, 8)}`
}

/** 内置默认时段；label 可在配置页修改，id 保持稳定供运行时引用。 */
export function createDefaultTimeSlots(): RuntimeTimeSlotDef[] {
  return [
    { id: 'morning', label: '早上' },
    { id: 'afternoon', label: '下午' },
    { id: 'evening', label: '晚上' },
    { id: 'night', label: '深夜' }
  ]
}

export function createDefaultRuntimeConfig(): RuntimeConfigData {
  return {
    time: {
      mode: 'elapsed',
      startDate: { year: 2026, month: 1, day: 1 },
      weekdayEnabled: true,
      startWeekday: 1,
      slots: createDefaultTimeSlots()
    },
    inventory: {
      items: []
    },
    weather: {
      weathers: []
    },
    location: {
      initialLocation: '',
      movement: 'free',
      connections: [],
      theme: 'auto'
    }
  }
}

/* ==========================================================================
 * 结构校验（写入 evg-data 前由主进程统一调用）
 * ========================================================================== */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
  )
}

/** 校验 RuntimeConfigData 的结构；返回第一个错误，合法时返回 null。 */
export function validateRuntimeConfigData(value: unknown): string | null {
  if (!isRecord(value)) {
    return 'data 必须是对象'
  }

  const time = value.time
  if (!isRecord(time)) {
    return 'data.time 必须是对象'
  }
  if (time.mode !== 'elapsed' && time.mode !== 'calendar') {
    return 'data.time.mode 必须是 elapsed 或 calendar'
  }
  if (typeof time.weekdayEnabled !== 'boolean') {
    return 'data.time.weekdayEnabled 必须是布尔值'
  }
  if (!isIntegerInRange(time.startWeekday, 1, 7)) {
    return 'data.time.startWeekday 必须是 1-7 的整数（1=周一）'
  }

  if (time.mode === 'calendar') {
    const startDate = time.startDate
    if (!isRecord(startDate)) {
      return 'calendar 模式必须提供 data.time.startDate'
    }
    if (!isIntegerInRange(startDate.year, 1, 9999)) {
      return 'data.time.startDate.year 必须是 1-9999 的整数'
    }
    if (!isIntegerInRange(startDate.month, 1, 12)) {
      return 'data.time.startDate.month 必须是 1-12 的整数'
    }
    if (!isIntegerInRange(startDate.day, 1, 31)) {
      return 'data.time.startDate.day 必须是 1-31 的整数'
    }
  }

  if (!Array.isArray(time.slots)) {
    return 'data.time.slots 必须是数组'
  }
  if (time.slots.length === 0) {
    return 'data.time.slots 不能为空，至少保留一个时段'
  }

  const seenSlotIds = new Set<string>()
  for (const [index, slot] of time.slots.entries()) {
    const where = `data.time.slots[${index}]`
    if (!isRecord(slot)) {
      return `${where} 必须是对象`
    }
    if (!isNonEmptyString(slot.id)) {
      return `${where}.id 必须是非空字符串`
    }
    if (seenSlotIds.has(slot.id)) {
      return `${where}.id 重复：${slot.id}`
    }
    seenSlotIds.add(slot.id)
    if (!isNonEmptyString(slot.label)) {
      return `${where}.label 必须是非空字符串`
    }
  }

  const inventory = value.inventory
  if (!isRecord(inventory)) {
    return 'data.inventory 必须是对象'
  }
  if (!Array.isArray(inventory.items)) {
    return 'data.inventory.items 必须是数组'
  }

  const seenItemIds = new Set<string>()
  for (const [index, item] of inventory.items.entries()) {
    const where = `data.inventory.items[${index}]`
    if (!isRecord(item)) {
      return `${where} 必须是对象`
    }
    if (!isNonEmptyString(item.id)) {
      return `${where}.id 必须是非空字符串`
    }
    if (seenItemIds.has(item.id)) {
      return `${where}.id 重复：${item.id}`
    }
    seenItemIds.add(item.id)
    if (!isNonEmptyString(item.name)) {
      return `${where}.name 必须是非空字符串`
    }
    if (typeof item.description !== 'string') {
      return `${where}.description 必须是字符串`
    }
    if (typeof item.stackable !== 'boolean') {
      return `${where}.stackable 必须是布尔值`
    }
    if (!isIntegerInRange(item.maxStack, 1, 999999)) {
      return `${where}.maxStack 必须是 1-999999 的整数`
    }
  }

  const weather = value.weather
  if (!isRecord(weather)) {
    return 'data.weather 必须是对象'
  }
  if (!Array.isArray(weather.weathers)) {
    return 'data.weather.weathers 必须是数组'
  }

  const seenWeatherIds = new Set<string>()
  let totalWeatherWeight = 0
  for (const [index, entry] of weather.weathers.entries()) {
    const where = `data.weather.weathers[${index}]`
    if (!isRecord(entry)) {
      return `${where} 必须是对象`
    }
    if (!isNonEmptyString(entry.id)) {
      return `${where}.id 必须是非空字符串`
    }
    if (seenWeatherIds.has(entry.id)) {
      return `${where}.id 重复：${entry.id}`
    }
    seenWeatherIds.add(entry.id)
    if (!isNonEmptyString(entry.name)) {
      return `${where}.name 必须是非空字符串`
    }
    if (
      typeof entry.weight !== 'number' ||
      !Number.isFinite(entry.weight) ||
      entry.weight < 0
    ) {
      return `${where}.weight 必须是非负数字（0 = 不出现）`
    }
    totalWeatherWeight += entry.weight
  }
  if (weather.weathers.length > 0 && totalWeatherWeight <= 0) {
    return 'data.weather.weathers 权重之和必须大于 0'
  }

  const location = value.location
  if (!isRecord(location)) {
    return 'data.location 必须是对象'
  }
  if (typeof location.initialLocation !== 'string') {
    return 'data.location.initialLocation 必须是字符串'
  }
  if (location.movement !== 'free' && location.movement !== 'graph') {
    return 'data.location.movement 必须是 free 或 graph'
  }
  if (
    location.theme !== undefined &&
    location.theme !== 'auto' &&
    location.theme !== 'light' &&
    location.theme !== 'dark'
  ) {
    return 'data.location.theme 必须是 auto / light / dark'
  }
  if (!Array.isArray(location.connections)) {
    return 'data.location.connections 必须是数组'
  }

  const seenEdges = new Set<string>()
  for (const [index, connection] of location.connections.entries()) {
    const where = `data.location.connections[${index}]`
    if (!isRecord(connection)) {
      return `${where} 必须是对象`
    }
    if (!isNonEmptyString(connection.from)) {
      return `${where}.from 必须是非空字符串`
    }
    if (!isNonEmptyString(connection.to)) {
      return `${where}.to 必须是非空字符串`
    }
    if (connection.from === connection.to) {
      return `${where} 不允许自连（${connection.from} → ${connection.to}）`
    }
    const edgeKey = `${connection.from}\n${connection.to}`
    if (seenEdges.has(edgeKey)) {
      return `${where} 重复的连通边：${connection.from} → ${connection.to}`
    }
    seenEdges.add(edgeKey)
  }

  if (location.nodePositions !== undefined) {
    if (!isRecord(location.nodePositions)) {
      return 'data.location.nodePositions 必须是对象'
    }
    for (const [chapterId, position] of Object.entries(location.nodePositions)) {
      const where = `data.location.nodePositions["${chapterId}"]`
      if (!isRecord(position)) {
        return `${where} 必须是对象`
      }
      if (
        typeof position.x !== 'number' ||
        !Number.isFinite(position.x) ||
        typeof position.y !== 'number' ||
        !Number.isFinite(position.y)
      ) {
        return `${where}.x / y 必须是有效数字`
      }
    }
  }

  return null
}
