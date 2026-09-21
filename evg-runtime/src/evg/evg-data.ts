/**
 * EVG Data 公共契约
 * ============================================================================
 * 这个文件定义 evg-data 数据表里 EventType / ActionType / ConditionType 的
 * 公共数据结构，以及它们和表结构（key / type / data）的对应关系。
 *
 * 为什么单独放一个文件：
 * - evg-editor 负责编辑，evg-runtime 负责执行，两边必须使用同一份契约；
 * - 本文件保持零依赖，不 import 编辑器 / 运行时 / Node API；
 * - 后续可以用脚本整体复制到 evg-runtime，例如：
 *     evg-runtime/src/evg/evg-data.ts
 *
 * 修改本文件时，必须保证两端可以原样共享，不要在文件里引入任何项目内路径。
 */

/* ==========================================================================
 * 1. JSON 基础类型
 * ========================================================================== */

export type EvgJsonPrimitive = string | number | boolean | null

export type EvgJsonValue =
  | EvgJsonPrimitive
  | EvgJsonValue[]
  | { [key: string]: EvgJsonValue }

/** 条件/操作数里允许的字面量：只保留基础类型。 */
export type EvgLiteralValue = EvgJsonPrimitive

/**
 * 业务对象 id。
 *
 * 落盘时由 evg-data 的 `key` 列承载；EventType/ActionType 的 data.id
 * 必须与所在行的 key 保持一致。
 */
export type EvgId = string

/* ==========================================================================
 * 2. evg-data 行结构
 * ========================================================================== */

/**
 * evg-data 表的行类型 discriminator。
 *
 * 对应 collection 中的 `type` 列（number）。
 * 引擎保留 1-999，后续如果有更多内置定义类型，从这里继续分配；
 * 扩展自定义类型建议从 1000 开始。
 */
export const EVG_DATA_KIND = {
  /** 事件定义 */
  Event: 1,
  /** 动作定义 */
  Action: 2,
  /** 条件定义 */
  Condition: 3,
  /** 地点定义（chapter 即 location，含热点布局） */
  LocationMap: 4
} as const

export type EvgDataKind = (typeof EVG_DATA_KIND)[keyof typeof EVG_DATA_KIND]

/**
 * evg-data 表中的一行。
 *
 * 字段对应关系：
 *   - row.id   : 数据表内部 GUID，仅编辑器 CRUD 使用，不参与业务引用；
 *   - row.key  : 业务唯一 id，运行时按它引用这些定义；
 *   - row.type : Event / Action / Condition / LocationMap，对应上面 EVG_DATA_KIND；
 *   - row.data : 业务对象正文。
 */
export interface EvgDataRow<TType extends number, TData> {
  id: string
  key: EvgId
  type: TType
  data: TData
}

export type EvgEventRow = EvgDataRow<typeof EVG_DATA_KIND.Event, EventType>
export type EvgActionRow = EvgDataRow<typeof EVG_DATA_KIND.Action, ActionType>
/** ConditionType 是纯语法树，没有自己的 id；行 key 就是它的业务 id。 */
export type EvgConditionRow = EvgDataRow<typeof EVG_DATA_KIND.Condition, ConditionType>
export type EvgLocationMapRow = EvgDataRow<
  typeof EVG_DATA_KIND.LocationMap,
  LocationMap
>
export type EvgDataDefinition =
  | EvgEventRow
  | EvgActionRow
  | EvgConditionRow
  | EvgLocationMapRow

/* ==========================================================================
 * 3. 操作数：字面量或变量
 * ========================================================================== */

/** 直接写死的字面量：string / number / boolean / null。 */
export interface EvgLiteralOperand {
  kind: 'literal'
  value: EvgLiteralValue
}

/** 从项目变量里取值，变量名对应 project.variables.json 的 variables[].name。 */
export interface EvgVariableOperand {
  kind: 'variable'
  variable: string
}

/**
 * 调用扩展方法取返回值（需要方法声明 returns）。
 *
 * 服务于 canExecute / guard 等“fragment 执行之外”的判断层：调度环节的
 * overlay 阻塞流程时，热点按钮的显隐与事件放行可以感知 runtime 状态。
 * 求值由 runtime 完成。
 */
export interface EvgExtensionMethodOperand {
  kind: 'extensionMethod'
  extensionId: string
  methodId: string
  args?: EvgJsonValue
}

/**
 * Condition / Action 共用的取值操作数。
 *
 * 目前有“字面量”“项目变量”“扩展方法返回值”三种来源；后续如果要支持
 * 角色属性、场景属性、系统只读值等，在这里追加新的 kind 即可。
 */
export type EvgValueOperand =
  | EvgLiteralOperand
  | EvgVariableOperand
  | EvgExtensionMethodOperand

/* ==========================================================================
 * 4. ConditionType
 * ========================================================================== */

/**
 * 条件谓词运算符。
 *
 * 语义约定：
 * - eq   : 2 个以上操作数全部相等；
 * - ne   : 2 个以上操作数两两不相等；
 * - gt / gte / lt / lte : 二元数值 / 字符串比较；
 * - exists : 一元，判断变量是否存在。
 */
export type ConditionPredicateOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'

/**
 * 相等判断。
 *
 * operands 允许 2 个以上，语义是“全部相等”。
 * 这样“判断三个变量都相等”不需要额外的特殊结构：
 *   { kind: 'predicate', operator: 'eq', operands: [a, b, c] }
 */
export interface ConditionEquality {
  kind: 'predicate'
  operator: 'eq'
  operands: [EvgValueOperand, EvgValueOperand, ...EvgValueOperand[]]
}

/**
 * 不等判断。
 *
 * operands 允许 2 个以上，语义是“全部两两不相等”：
 *   { kind: 'predicate', operator: 'ne', operands: [a, b, c] }
 * = a != b && b != c && a != c
 */
export interface ConditionInequality {
  kind: 'predicate'
  operator: 'ne'
  operands: [EvgValueOperand, EvgValueOperand, ...EvgValueOperand[]]
}

/** 二元大小比较。 */
export interface ConditionOrdering {
  kind: 'predicate'
  operator: 'gt' | 'gte' | 'lt' | 'lte'
  operands: [EvgValueOperand, EvgValueOperand]
}

/** 存在性判断。不存在请使用 not(exists)。 */
export interface ConditionExistence {
  kind: 'predicate'
  operator: 'exists'
  operands: [EvgValueOperand]
}

export type ConditionPredicate =
  | ConditionEquality
  | ConditionInequality
  | ConditionOrdering
  | ConditionExistence

/** AND 节点，children 按顺序求值。 */
export interface ConditionAnd {
  kind: 'and'
  children: ConditionExpression[]
}

/** OR 节点，children 按顺序求值。 */
export interface ConditionOr {
  kind: 'or'
  children: ConditionExpression[]
}

/** NOT 节点，只包含一个子条件。 */
export interface ConditionNot {
  kind: 'not'
  child: ConditionExpression
}

/**
 * 常量条件。
 *
 * 通常 `true` 会直接作为 guard 的简写；
 * 这个节点主要用来表达显式的 `false`，或者需要被其它条件包裹的常量。
 */
export interface ConditionConstant {
  kind: 'constant'
  value: boolean
}

export type ConditionNode =
  | ConditionPredicate
  | ConditionAnd
  | ConditionOr
  | ConditionNot
  | ConditionConstant

/** 条件树的正式名称。 */
export type ConditionType = ConditionNode

/** 引用 evg-data 中 type=Condition 的行。 */
export type ConditionRef = EvgId

/** 可以被放进逻辑树里的条件表达式：内联树或对条件行的引用。 */
export type ConditionExpression = ConditionType | ConditionRef

/**
 * canExecute / guard 中可接受的条件值。
 *
 * - true       : 永远通过；
 * - ConditionType : 内联条件树；
 * - ConditionRef  : 引用独立的条件定义行。
 */
export type ConditionBinding = ConditionExpression | true

/* ==========================================================================
 * 5. ActionType
 * ========================================================================== */

/**
 * 引擎内置 effect purpose。
 *
 * 这里只放已经明确的核心值；扩展 action 从 EvgExtensionActionPurposeMin
 * 开始分配。ActionType.type 本身是 number，所以扩展不需要改这个联合类型。
 */
export const EVG_ACTION_PURPOSE = {
  /** 设置变量值 */
  SetVariable: 1,
  /** 调用 / 跳转片段 */
  CallFragment: 10,
  /** 调用扩展方法 */
  CallExtensionMethod: 20,
  /** 触发系统槽位 */
  CallSystemSlot: 21
} as const

export type ActionPurposeEnum =
  (typeof EVG_ACTION_PURPOSE)[keyof typeof EVG_ACTION_PURPOSE]

/** 扩展 action purpose 建议从这个值开始。 */
export const EVG_EXTENSION_ACTION_PURPOSE_MIN = 1000

/** 引擎保留 1-999，因此这里保留 number 以兼容扩展自定义值。 */
export type ActionPurpose = ActionPurposeEnum | number

/**
 * 设置变量的值：字面量 / 另一变量 / 扩展方法返回值。
 * extensionMethod 用于把方法的返回值写入目标变量；方法未声明 returns
 * （或求值结果不是基础类型）时运行时跳过写入并告警。
 */
export type SetVariableValueOperand =
  | EvgLiteralOperand
  | EvgVariableOperand
  | EvgExtensionMethodOperand

export interface SetVariableActionData {
  /** 变量名，对应 project.variables.json 的 variables[].name。 */
  variable: string
  /** 要写入的值：字面量 / 另一变量 / 扩展方法返回值。 */
  value: SetVariableValueOperand
}

export interface CallFragmentActionData {
  /** 目标 fragment id。 */
  fragmentId: EvgId
  /** 目标 fragment 所属 chapter；省略时由运行时按当前章节解析。 */
  chapterId?: EvgId
}

export interface CallExtensionMethodActionData {
  /** 扩展 id。 */
  extensionId: string
  /** 扩展内方法 id。 */
  methodId: string
  /** 方法参数，具体 schema 由扩展自己定义。 */
  args?: EvgJsonValue
}

export interface CallSystemSlotActionData {
  /** 引擎内置系统槽位 id（internal.system.*，见 SDK INTERNAL_SYSTEM_SLOT）。 */
  slot: string
  /** 传给槽位的 payload。 */
  payload?: EvgJsonValue
}

/**
 * 通用 Action 信封。
 *
 * Common.md 中的 ActionType 就是它；`data` 的类型由具体 purpose 决定。
 * 引擎和扩展可以通过 EvgActionDataMap 继续补全“purpose → data”的强类型映射。
 */
export interface ActionType<
  TType extends number = ActionPurpose,
  TData = EvgJsonValue
> {
  id: EvgId
  label: string
  guard: ConditionBinding
  type: TType
  data: TData
}

/**
 * 内置 effect 的 purpose → data 映射。
 *
 * 增加新的核心 effect 时，在这里补一项；扩展也可以在自己的类型声明文件里
 * 通过 declaration merging 追加：
 *
 *   declare module '.../evg-data' {
 *     interface EvgActionDataMap {
 *       [1001]: MyCustomActionData
 *     }
 *   }
 */
export interface EvgActionDataMap {
  [EVG_ACTION_PURPOSE.SetVariable]: SetVariableActionData
  [EVG_ACTION_PURPOSE.CallFragment]: CallFragmentActionData
  [EVG_ACTION_PURPOSE.CallExtensionMethod]: CallExtensionMethodActionData
  [EVG_ACTION_PURPOSE.CallSystemSlot]: CallSystemSlotActionData
}

/** 核心 effect 的强类型联合。 */
export type CoreActionType = {
  [K in keyof EvgActionDataMap]: ActionType<K & number, EvgActionDataMap[K]>
}[keyof EvgActionDataMap]

/** 引用 evg-data 中 type=Action 的行。 */
export type ActionRef = EvgId

/**
 * Event 的 actions 数组中可接受的值。
 *
 * - ActionType : 内联 effect；
 * - ActionRef  : 引用独立的 effect 定义行。
 */
export type ActionBinding = ActionType | ActionRef

/* ==========================================================================
 * 6. EventType
 * ========================================================================== */

/**
 * 事件定义。
 *
 * 对应 evg-data 中 type=Event 的行的 data。
 */
export interface EventType {
  /** 业务 id，必须等于所在行的 key。 */
  id: EvgId
  /** 可读名称。 */
  label: string
  /** 是否允许执行；true 表示无条件执行。 */
  canExecute: ConditionBinding
  /**
   * 事件动作列表，按数组顺序依次执行。
   *
   * fragment 调用本身也是一个普通 Action（CallFragment），
   * 因此不再需要 hasFragment / beforeEffects / afterEffects。
   */
  actions: ActionBinding[]
}

/* ==========================================================================
 * 7. LocationMap（地点）
 * ========================================================================== */

/** 引用 evg-data 中 type=Event 的行。 */
export type EventRef = EvgId

/**
 * 可以绑定到地点热点上的事件。
 *
 * - EventType : 内联事件；
 * - EventRef  : 引用独立的 Event 行。
 */
export type EventBinding = EventType | EventRef

/**
 * 归一化坐标点。
 *
 * x / y 的取值范围都是 [0, 1]，相对场景参考分辨率。
 */
export interface SceneHotspotPoint {
  x: number
  y: number
}

/**
 * 地点热点的可点击形状。
 *
 * 坐标全部归一化：
 * - x / y / width / height 相对场景参考分辨率；
 * - radius 相对场景参考分辨率的短边。
 */
export type SceneHotspotShape =
  | {
      kind: 'circle'
      x: number
      y: number
      radius: number
    }
  | {
      kind: 'rect'
      x: number
      y: number
      width: number
      height: number
    }

/** 地点内一个可交互的热点。 */
export interface SceneHotspot {
  id: EvgId
  label: string
  enabled: boolean
  shape: SceneHotspotShape
  /** 点击热点时触发的事件；留空表示暂未绑定。 */
  event?: EventBinding
}

/**
 * 一个章节对应的地点定义（chapter 即 location）。
 *
 * 对应 evg-data 中 type=LocationMap 的行的 data。
 * row.key 必须等于 data.chapterId。
 *
 * 语义约定（与 Runtime 的位置调度相关，见 Common.md 第 9 节）：
 * - 存在本行 = 该章节被注册为一个地点；hotspots 为空数组表示
 *   “无交互点的地点”（仍可被导航访问）；
 * - disabled 的地点不作为可移动目的地，也不执行其调度；
 * - 地点间移动由 EVG Runtime 的扩展方法 move-location 负责，
 *   当前位置记录在变量 evg.location.current（存章节 id）。
 */
export interface LocationMap {
  /** 对应章节 id，也对应 row.key。 */
  chapterId: EvgId
  /** 章节 main fragment 第一个 scene block 的 props.sceneId。 */
  sceneId: EvgId
  /**
   * 地点显示名（导航菜单 / 移动提示）。
   * 缺省时运行时回退到章节名；编辑器写回时保留原值。
   */
  label?: string
  /**
   * 是否禁用该地点。缺省视为 false（兼容旧数据）；
   * 编辑器写回时会显式补齐。
   */
  disabled?: boolean
  hotspots: SceneHotspot[]
}

/* ==========================================================================
 * 8. 便捷类型守卫
 * ========================================================================== */

export function isActionRef(value: ActionBinding): value is ActionRef {
  return typeof value === 'string'
}

export function isConditionRef(value: ConditionBinding): value is ConditionRef {
  return typeof value === 'string'
}

export function isConditionNode(value: ConditionBinding): value is ConditionType {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isEvgEventRow(row: EvgDataDefinition): row is EvgEventRow {
  return row.type === EVG_DATA_KIND.Event
}

export function isEvgActionRow(row: EvgDataDefinition): row is EvgActionRow {
  return row.type === EVG_DATA_KIND.Action
}

export function isEvgConditionRow(row: EvgDataDefinition): row is EvgConditionRow {
  return row.type === EVG_DATA_KIND.Condition
}

export function isEvgLocationMapRow(
  row: EvgDataDefinition
): row is EvgLocationMapRow {
  return row.type === EVG_DATA_KIND.LocationMap
}
