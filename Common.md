# EVG Data 公共契约

## 1. 概述

- **evg-editor** 负责编辑项目数据。
- **evg-runtime** 读取 `evg-data` 数据表，根据表中的 Event / Action / Condition 定义执行。
- EVG 围绕 Event 设计：Event 通过 Condition 判断能否执行，通过 Action 产生行为与改变。
- 公共结构定义在 `evg-editor/src/shared/evgData.ts`。
- Runtime 系统子系统（时间 / 物品系统等）所需的项目变量与运行配置约定见第 9 节，
  声明源文件为 `evg-editor/src/shared/runtimeSystems.ts` 与
  `evg-editor/src/shared/runtimeConfig.ts`。
- 该文件零依赖，可整体复制到 `evg-runtime/sdk/types/evg-data.ts`。
- 工作目录根部的 `sync_evg_data.py` 负责本地同步，脚本不进入 evg-editor 发布内容。

## 2. 基础类型

```ts
type EvgJsonPrimitive = string | number | boolean | null

type EvgJsonValue =
  | EvgJsonPrimitive
  | EvgJsonValue[]
  | { [key: string]: EvgJsonValue }

type EvgId = string
```

`EvgId` 是业务对象 id，落盘时由 `evg-data` 的 `key` 列承载。

## 3. evg-data 行结构

`evg-data` 的每一行统一为：

```ts
interface EvgDataRow<TType extends number, TData> {
  id: string
  key: EvgId
  type: TType
  data: TData
}
```

字段约定：

| 字段 | 含义 |
| --- | --- |
| `id` | 数据表内部 GUID。只用于编辑器 CRUD，不参与业务引用。 |
| `key` | 业务唯一 id。EventType / ActionType 的 `data.id` 必须与它一致。 |
| `type` | 行类型 discriminator，见 `EVG_DATA_KIND`。 |
| `data` | 业务对象正文。 |

行类型：

```ts
const EVG_DATA_KIND = {
  Event: 1,
  Action: 2,
  Condition: 3,
  LocationMap: 4
} as const
```

| type | data 结构 |
| --- | --- |
| 1 | `EventType` |
| 2 | `ActionType` |
| 3 | `ConditionType` |
| 4 | `LocationMap` |
| 1000 | `RuntimeConfigData`（Runtime 运行配置，见 9.3） |

引擎保留 `1-999`；扩展自定义行类型建议从 `1000` 开始。

对应的行类型：

```ts
type EvgEventRow = EvgDataRow<1, EventType>
type EvgActionRow = EvgDataRow<2, ActionType>
type EvgConditionRow = EvgDataRow<3, ConditionType>
type EvgLocationMapRow = EvgDataRow<4, LocationMap>
type EvgDataDefinition =
  | EvgEventRow
  | EvgActionRow
  | EvgConditionRow
  | EvgLocationMapRow
```

其中 ConditionType 是纯语法树，没有自己的 id；行 `key` 就是它的业务 id。

## 4. ConditionType

### 4.1 操作数

```ts
type EvgValueOperand =
  | { kind: 'literal'; value: EvgLiteralValue }
  | { kind: 'variable'; variable: string }
  | {
      kind: 'extensionMethod'
      extensionId: string
      methodId: string
      args?: EvgJsonValue
    }
```

`EvgLiteralValue` 只保留基础类型：

```ts
type EvgLiteralValue = string | number | boolean | null
```

- `literal`：基础类型字面量。
- `variable`：项目变量名，对应 `project.variables.json` 的 `variables[].name`。
- `extensionMethod`：调用扩展方法的返回值（求值由 runtime 完成），服务于
  `canExecute` / `guard` 等 fragment 执行之外的判断层，也用于 `SetVariable`
  的赋值——把方法返回值写入目标变量。方法未声明 returns（或求值结果不是
  基础类型）时运行时跳过写入并告警。编辑器内置方法清单（`runtimeMethods.ts`，
  与 9.3 对齐）为已登记方法提供可视化参数表单与返回类型推断；清单未登记的
  方法回退为手填 id + JSON 参数。

### 4.2 条件节点

Condition 是一棵语法树：

```ts
type ConditionType =
  | ConditionPredicate
  | ConditionAnd
  | ConditionOr
  | ConditionNot
  | ConditionConstant
```

谓词操作符：

```ts
type ConditionPredicateOperator =
  | 'eq' | 'ne'
  | 'gt' | 'gte' | 'lt' | 'lte'
  | 'exists'
```

谓词节点（原子判定）：

> 谓词是条件判定中最原子的一层，返回 `true` / `false`；编辑器 UI 中显示为“判定”。
> “比较”只描述其中一部分运算符，不能覆盖 `exists`，因此统一用 `predicate`。

```ts
interface ConditionPredicate {
  kind: 'predicate'
  operator: ConditionPredicateOperator
  operands: EvgValueOperand[]
}
```

> 实际 TS 实现会按 operator 细分 `operands` 的元组长度；这里为便于阅读合并展示。

操作数数量由 operator 决定：

| operator | 操作数 | 语义 |
| --- | --- | --- |
| `eq` | 2+ | 全部相等 |
| `ne` | 2+ | 两两不相等 |
| `gt` / `gte` / `lt` / `lte` | 2 | 二元大小比较 |
| `exists` | 1 | 变量是否存在；不存在请用 `not` 包裹 |

逻辑节点：

```ts
interface ConditionAnd {
  kind: 'and'
  children: ConditionExpression[]
}

interface ConditionOr {
  kind: 'or'
  children: ConditionExpression[]
}

interface ConditionNot {
  kind: 'not'
  child: ConditionExpression
}

interface ConditionConstant {
  kind: 'constant'
  value: boolean
}
```

条件引用与绑定：

```ts
type ConditionRef = EvgId
type ConditionExpression = ConditionType | ConditionRef
type ConditionBinding = ConditionExpression | true
```

- `ConditionType`：内联条件树。
- `ConditionRef`：引用 `evg-data` 中 `type=Condition` 的行。
- `true`：无条件通过。

### 4.3 “三个变量都相等”的处理

多操作数 `eq` 直接表达：

```json
{
  "kind": "predicate",
  "operator": "eq",
  "operands": [
    { "kind": "variable", "variable": "a" },
    { "kind": "variable", "variable": "b" },
    { "kind": "variable", "variable": "c" }
  ]
}
```

等价于：

```text
a == b && b == c && a == c
```

多个值“两两不相等”用 `ne`：

```json
{
  "kind": "predicate",
  "operator": "ne",
  "operands": [
    { "kind": "variable", "variable": "a" },
    { "kind": "variable", "variable": "b" },
    { "kind": "variable", "variable": "c" }
  ]
}
```

等价于 `a != b && b != c && a != c`，不需要额外结构。

## 5. ActionType

```ts
interface ActionType<
  TType extends number = ActionPurpose,
  TData = EvgJsonValue
> {
  id: EvgId
  label: string
  guard: ConditionBinding
  type: TType
  data: TData
}
```

- `guard`：执行前最后一道保险；`true` 表示直接执行。
- `type`：Action 的目的类型，开放 number。
- `data`：具体行为参数，由 purpose 决定。

### 5.1 核心 ActionPurpose

```ts
const EVG_ACTION_PURPOSE = {
  SetVariable: 1,
  CallFragment: 10,
  CallExtensionMethod: 20,
  CallSystemSlot: 21
} as const
```

引擎保留 `1-999`，扩展自定义 Action 建议从 `1000` 开始：

```ts
const EVG_EXTENSION_ACTION_PURPOSE_MIN = 1000
type ActionPurpose = ActionPurposeEnum | number
```

### 5.2 data 类型映射

```ts
interface EvgActionDataMap {
  [EVG_ACTION_PURPOSE.SetVariable]: SetVariableActionData
  [EVG_ACTION_PURPOSE.CallFragment]: CallFragmentActionData
  [EVG_ACTION_PURPOSE.CallExtensionMethod]: CallExtensionMethodActionData
  [EVG_ACTION_PURPOSE.CallSystemSlot]: CallSystemSlotActionData
}
```

内置 data：

```ts
interface SetVariableActionData {
  variable: string
  // 字面量 / 变量 / 扩展方法返回值；方法未声明 returns 时运行时跳过写入
  value: EvgLiteralOperand | EvgVariableOperand | EvgExtensionMethodOperand
}

interface CallFragmentActionData {
  fragmentId: EvgId   // main 片段是章节入口，不可被片段调用
  chapterId?: EvgId   // 缺省由运行时按当前章节解析
}

interface CallExtensionMethodActionData {
  extensionId: string
  methodId: string
  args?: EvgJsonValue
}

interface CallSystemSlotActionData {
  slot: string
  payload?: EvgJsonValue
}
```

扩展可以通过 declaration merging 追加新的 purpose → data 映射。

### 5.3 内联与引用

```ts
type ActionRef = EvgId
type ActionBinding = ActionType | ActionRef
```

- 内联：`Event.actions` 数组中直接放 `ActionType`。
- 引用：`Event.actions` 数组中放字符串 id，引用 `evg-data` 中 `type=Action` 的行。

## 6. EventType

```ts
interface EventType {
  id: EvgId
  label: string
  canExecute: ConditionBinding
  actions: ActionBinding[]
}
```

- `id`：业务 id，必须等于所在行的 `key`。
- `canExecute`：能否执行；`true` 表示无条件执行。
- `actions`：事件动作列表，按数组顺序依次执行。
- fragment 调用本身就是一个普通 Action（`CallFragment`），因此事件不再需要独立的 `hasFragment` / `beforeEffects` / `afterEffects` 字段。
- 如果事件不需要执行任何动作，`actions` 为空数组即可。

执行顺序：

```text
canExecute 通过
  -> 按顺序执行 actions 中的每一个 Action
```

`CallFragment` 只是其中一个 Action；它在数组中的位置决定 fragment 调用的时机。

地点的热点可以绑定事件，支持内联与引用：

```ts
type EventRef = EvgId
type EventBinding = EventType | EventRef
```

- 内联：直接放一个 `EventType`
- 引用：放字符串 id，引用 `evg-data` 中 `type=Event` 的行

## 7. LocationMap（地点）

LocationMap 对应 `evg-data` 中 `type=LocationMap` 的行，把一个章节注册为一个**地点（location）**：chapter 即 location，地点内保存可交互的热点布局。

```ts
interface LocationMap {
  chapterId: EvgId
  sceneId: EvgId
  label?: string      // 地点显示名（导航 / 移动提示），缺省回退章节名
  disabled?: boolean  // 禁用的地点不可移动、不执行调度；缺省视为 false
  hotspots: SceneHotspot[]
}
```

约束：

- 一行对应一个章节，`row.key === data.chapterId`；**存在该行即表示该章节被注册为地点**，`hotspots` 为空数组表示“无交互点的地点”（仍可被导航访问）。
- **调度候选不在这里**：章节能否被调度由 Studio 蓝图（`project.json` 的
  `schedule.graph`，extension 节点的 `chapterIds`）承载，与 LocationMap
  是两个独立集合，runtime 取二者交集（见 9.3 调度策略）。编辑器地点页
  只读检查二者的差集并显示提示条（带刷新），**不写回蓝图**——章节
  加入调度由编辑者在 Studio 侧完成。
- `sceneId` 来自该章节 `main` fragment 第一个 `scene` block 的 `props.sceneId`。
- 一个章节只写一行，`hotspots` 数组顺序就是运行时渲染 / 命中顺序。

热点结构：

```ts
type SceneHotspotShape =
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

interface SceneHotspot {
  id: EvgId
  label: string
  enabled: boolean
  shape: SceneHotspotShape
  event?: EventBinding
}
```

坐标约定：

- 全部使用归一化坐标 `[0, 1]`
- `x` / `y` 相对场景参考分辨率
- `rect` 的 `width` / `height` 也相对参考分辨率
- `circle` 的 `radius` 相对参考分辨率的短边
- 编辑器负责在预览像素坐标和归一化坐标之间换算，运行时按实际舞台尺寸还原

地点的热点可以绑定事件：

```ts
interface SceneHotspot {
  event?: EventBinding
}
```

- 内联：直接在热点里保存完整 `EventType`
- 引用：保存字符串 id，引用 `evg-data` 中 `type=Event` 的行
- 留空表示暂未绑定

## 8. 命名对照

原稿字段名到当前契约的映射：

| 原稿 | 当前 |
| --- | --- |
| `can_execute` | `canExecute` |
| `have_fragmen` | 已删除；fragment 调用改为 `CallFragment` Action |
| `before_effect` | 合并为 `actions` |
| `after_effect` | 合并为 `actions` |

其余字段保持 `id`、`label`、`guard`、`type`、`data`。

## 8.1 数据表的三个名字（重要）

"evg-data 表"在不同层面有三个名字，**不要混用**：

| 名字 | 值 | 出现位置 |
| --- | --- | --- |
| **dependency alias** | `evdata` | `extension.json` 的 `dataDependencies` key；`project.json` 的 `dataBindings.<扩展id>` 的 key；runtime 代码里 `ctx.database.collection(alias)` 的参数 |
| **collection id** | `evdata` | 工程 `databases/<databaseId>--<collectionId>.collection.json` 文件名；database 定义 JSON 里 `collections[].id` |
| **collection 展示名** | `evg-data` | `extension.json` 的 `dataDependencies.evdata.autoCreate.name`；database 定义 JSON 里 `collections[].name`（供引擎 UI 展示） |

约束：

- alias 是 runtime 代码读取数据的唯一入口键；改名必须三处同步
  （manifest key / dataBindings key / `EVG_DATA_COLLECTION_ALIAS` 常量）。
- `autoCreate.name` 只是展示名，**不是** collection id；引擎按 alias
  绑定（经 dataBindings 解析到真实 collection），按模板创建的集合
  `id` 固定为 `evdata`。
- runtime 侧 alias 常量：`evg-runtime/src/evg/constants.ts` 的
  `EVG_DATA_COLLECTION_ALIAS`。

## 9. Runtime 系统变量

evg-runtime 会接管时间、物品系统等系统级功能。这些功能依赖一组约定好的
项目变量（`project.variables.json` 的 `variables[]`），由编辑器负责检查与写入，
Runtime 负责读取和推进。本节是双方协调的依据。

声明源文件：`evg-editor/src/shared/runtimeSystems.ts`（常量 + 纯函数，
只依赖 `./variable`，零外部依赖）。

### 9.1 命名与写入约定

- 变量名统一使用 `evg.<systemId>.<name>` 命名空间（`evg.` 是本框架的前缀，
  避免与引擎内部变量重名），与项目自建变量隔离。
- 所有变量（含 Runtime 系统变量）`kind` 一律为 `project`——`system` 是
  引擎内部使用的保留值，写了引擎无法识别；系统变量只靠 `evg.` 名字前缀
  与项目自建变量区分。
- 编辑器在主页展示各系统变量的就绪状态，并提供按系统或一键全部写入；
  写入只补缺失变量、对齐类型与持久化范围，不覆盖用户对默认值的合法调整。
- 检查与写入只以 `name`、`type`、`persistence` 为准；`defaultValue` 仅在
  新增变量和修复类型不符时使用规范值。

### 9.2 当前内置清单（草案）

时间系统（systemId: `time`）——变量随存档保存：

| 变量名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `evg.time.day` | number | `1` | 从 1 开始累计的天数 |
| `evg.time.slot` | string | `"morning"` | 时段标识，如 morning / afternoon / evening / night |
| `evg.time.paused` | bool | `false` | 为 true 时暂停时间推进 |

位置系统（systemId: `location`）——章节即地点（chapter = location），移动 = 章节切换：

| 变量名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `evg.location.current` | string | `""` | 当前所在地点的章节 id；空串 = 未初始化，运行时用 9.3 的 `location.initialLocation` 填充 |

物品系统（systemId: `inventory`）——持有状态按"每物品一个变量"承载
（见 9.3「物品的读写路径」）；货币等标量走普通变量：

| 变量名 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `evg.inventory.gold` | number | `0` | 当前持有的货币数量 |

以上变量的 `persistence` 均为 `slot`（当前存档）。

**物品变量（动态清单）**：每个物品一个 number 变量 `evg.item.<itemId>`
（默认 0，slot 持久化），即该物品的持有量。物品是项目数据，不在上面的
静态清单里——编辑器在主页检查时从 9.3 的物品清单现算这一节（"物品变量"
卡片），缺失 / 类型不符可一键写入。add-item / remove-item 动作或剧本的
SetVariable 都按此语义维护它。

### 9.3 运行配置条目（evg-data type=1000）

时间 / 物品系统的设置整理为一个设置对象，作为一条 evg-data 行整体落盘。
写入后 Runtime 启动时读取该条目，决定时间如何推进、物品清单有哪些定义。

- 行类型 `type = 1000`：属于扩展自定义类型区间，该配置属于 evg-runtime，
  不占用引擎保留的 1-999。
- 行 `key` 固定为 `runtime-config`，一个项目至多一条（编辑器按同类型
  key 查重 + 行级校验保证）。
- 声明源文件：`evg-editor/src/shared/runtimeConfig.ts`（零外部依赖）。

`data`（`RuntimeConfigData`）结构：

```ts
interface RuntimeTimeSlotDef {
  id: string      // 时段标识（period-id），运行时与事件按 id 引用；可编辑为语义化 id
  label: string   // 展示名（period-name）
}

interface RuntimeTimeConfig {
  mode: 'elapsed' | 'calendar'
  // elapsed  : 只累计天数（evg.time.day 从 1 递增）
  // calendar : 真实年月日系统，从 startDate 起始
  startDate?: { year: number; month: number; day: number } // calendar 必填
  weekdayEnabled: boolean  // 是否启用星期
  startWeekday: number     // 第 1 天/起始日期是星期几：1=周一 … 7=周日
  slots: RuntimeTimeSlotDef[] // 单日时段，数组顺序即推进顺序
}

interface RuntimeItemDef {
  id: string          // 默认自动生成（item-xxxxxxxx），允许编辑为语义化 id（如 key）
  name: string        // 展示文案，可随时修改；剧本条件按 id 引用而非 name
  description: string
  stackable: boolean
  maxStack: number    // 可堆叠时的最大堆叠数量；不可堆叠时为 1
}

interface RuntimeInventoryConfig {
  items: RuntimeItemDef[]
}

type RuntimeMovementMode = 'free' | 'graph'

interface RuntimeLocationConnection {
  from: string   // 起点地点的 chapterId
  to: string     // 终点地点的 chapterId
}

interface RuntimeLocationConfig {
  initialLocation: string   // 初始地点 chapterId；空串 = 回退第一个未禁用地点
  movement: RuntimeMovementMode
  // free  : 简单导航，全部启用地点互相可达
  // graph : 连通图导航，按 connections 的有向边可达
  connections: RuntimeLocationConnection[]
  nodePositions?: Record<string, { x: number; y: number }>  // 连通图编辑器布局
  theme?: 'auto' | 'light' | 'dark'  // 地点层主题；缺省 auto（跟随系统深浅色）
}

interface RuntimeWeatherDef {
  id: string
  name: string
  weight: number  // 相对权重，roll 概率 = weight / 总权重；0 = 暂不出现
}

interface RuntimeWeatherConfig {
  weathers: RuntimeWeatherDef[]  // 空数组 = 项目不使用天气系统
}

interface RuntimeConfigData {
  time: RuntimeTimeConfig
  inventory: RuntimeInventoryConfig
  weather: RuntimeWeatherConfig
  location: RuntimeLocationConfig
}
```

默认值：`location` section 为 `{ initialLocation: '', movement: 'free',
connections: [], theme: 'auto' }`。

**位置调度与移动方法**：地点注册 = 章节存在 LocationMap 行（见第 7 节），
config 只保存调度参数。注意 `internal.system.*` 是引擎保留前缀（引擎的
UI 系统槽位），EVG 框架不得占用——移动动作统一走 EVG Runtime 的
**扩展方法** `move-location`（`extensionId: com.notarium.evg-runtime`，
剧本动作用 `CallExtensionMethod` 调用），参数为结构化对象：

```json
{ "chapterId": "ch-market", "chapterName": "集市" }
```

`chapterId` 是调度依据（runtime 校验后写入 `evg.location.current`
并切换章节）；`chapterName` 是冗余的展示名，供移动提示直接使用。
导航候选 = 全部 `disabled !== true` 的地点；`movement: 'graph'` 时只列出
与当前地点连通的目的地。

**天气系统**：天气清单非空时，`advance-time` 每次推进后按权重 roll
一次写入 `evg.weather.current`（string，存天气 id；随存档 slot 保存），
调度开局（先进初始地点章节的那一轮）也会 roll 一次，保证开场剧本的
天气分支可用；清单为空时变量不声明、不 roll。剧本分支直接用引擎原生
变量条件（`evg.weather.current eq rain`）或 IfExt 条件分支。地点层
overlay 的时间信息卡在天气可用时于时间旁展示天气名（id 对应清单里的
`name`）。roll 本体是纯函数（`rollWeatherTable`，随机源注入），
"剧情强制天气"预期以新增 `set-weather` 扩展方法承载（暂未实现）。

**调度策略（scheduleStrategy）**：EVG Runtime 声明项目调度策略
「EVG 地点调度」（模块 `location`，实现见 `evg-runtime/src/evg/dispatch.ts`），
作为"调度环节"的实现——章节 main fragment 走完后由引擎调用：

- 校验并初始化 `evg.location.current`（空串回退
  `initialLocation`，再回退第一个可用地点），开局先进初始地点章节做
  场景铺垫，此后打开常驻地点层（热点 + 导航入口）挂起等待玩家；
- 玩家的自由移动经导航面板发生（`free` 全部启用地点 / `graph` 按有向
  连通边可达），选择目的地后返回 `{ kind: "chapter", chapterId }`；
  热点事件里的 `move-location`（剧情性移动，不校验连通性、只要求
  地点存在且未禁用）同样会结束等待并切章；未发生移动的热点事件
  执行完毕后地点层继续等待。

**地点层常驻区与热点安全区**：地点层界面（LocationModule 的 render）
由常驻元素与热点构成——左上角时间信息卡（`evg.time.*` + runtime-config
时间节，缺失时整卡隐藏）、底部左右两角（当前地点名与导航按钮，导航
以弹窗面板展开，不随地点数量常驻增长）、热点按归一化坐标铺在其余
区域。常驻元素占用的屏幕区域是热点编辑的安全区契约（场景参考分辨率
下的 px）：

| 区域 | 范围 |
| --- | --- |
| 左上时间信息卡 | `(0, 0)` 起，384 × 112 |
| 底部常驻栏 | 整宽，高 72 |

编辑器地点页的热点编辑预览按这组数字画参考线（开关在工具栏），提示
避开常驻元素；runtime 侧常量为 `LocationModule` 的
`OVERLAY_SAFE_AREAS`，编辑器镜像于 `LocationsPage.tsx`，两侧修改必须
同步本表。地点层视觉走 Fluent token（`LocationOverlayTheme`，浅色 /
深色两套，对应编辑器的两套外观）。主题是**项目数据**：由编辑者在
「运行数据配置 · 地点页签」维护 `location.theme`（auto 跟随玩家系统
深浅色 / light / dark），决定玩家在游戏里看到的画面主题，不进任何
扩展设置。将来以升级形式追加完整的 overlay 排版编辑时，预期在该
`location` 节的数据结构上扩展承载，组件只消费同形 token 对象。

默认值：elapsed 模式、起始 2026-01-01、启用星期且周一起始、时段
morning / afternoon / evening / night（早上 / 下午 / 晚上 / 深夜）、
空物品清单、空天气清单。

时段 id 可编辑为语义化 id（period-id），编辑器提供为空与重复的即时
提示；修改 id 会使剧本中已按旧 id 写的条件（`evg.time.slot` 与 id
字面量比较）失效，runtime 对清单外的时段按 id 原样展示兜底。

编辑器提供“运行数据配置”页（时间 / 物品 / 地点页签）维护该条目；写入经过
统一的 evg-data 校验路径，结构不合法会被拒绝落盘。后续新增子系统时
在 `RuntimeConfigData` 上追加字段，并在配置页追加页签。

**时间推进**：时间不会自动走动——由 Runtime 的扩展方法
`advance-time`（`extensionId: com.notarium.evg-runtime`，剧本动作用
`CallExtensionMethod` 调用，参数 `{ "count": 1 }`）显式推进：按本节
时间清单的时段数组顺序推进 `count` 个时段，跨过当天最后一个时段即
进入下一天（`evg.time.day` + 1、`evg.time.slot` 回到第一个时段）。
`evg.time.paused` 为 true 时空转（契约：暂停时间推进）；当前时段不在
清单里（未初始化 / 时段 id 被改过）按"位于首时段之前"处理，推进 1 即
落到第一个时段。推进与计时模式无关，calendar 的日期由展示层从 day
推算（地点层时间卡）。

**物品的读写路径**：持有状态 = 每物品一个 number 变量
`evg.item.<itemId>`（即持有量，默认 0，slot 持久化，声明由编辑器从
物品清单同步，见 9.2）。选择变量承载的原因：SDK 的模块 save 只在
「方法调用」实例上可用，而物品状态要在动作执行、调度层、界面层与
引擎原生变量条件之间通用，`ctx.variables` 是唯一全层可用的持久存储；
逐物品拆成 number 变量（而不是单个 JSON 明细变量），是为了让引擎的
剧本编辑器能原生按物品写条件。分支按场景分两层：

- **fragment 内**：引擎原生变量条件（`evg.item.key >= 1`）；循环复入
  （SLG 反复调用同一片段、读档回放）的分支用 Runtime 的 **IfExt 条件
  分支**（模块 `if-ext`，方法 `cond-jump-custom`）——引擎自带的 If
  面向线性 AVG，一个判断只执行一次、后续沿用首次结果，IfExt 用扩展
  方法每次重新求值，并按比较结果把流程 callFragment 到真 / 假分支片段；
- **fragment 外**：`canExecute`（调度环节地点层打开时热点按钮是否
  显示）与 `guard`（按下后事件是否执行）直接用变量操作数
  （`extensionMethod` 操作数作为通用机制保留，供未来声明 returns 的
  扩展方法使用）。

物品的增减优先走 Runtime 的 `add-item` / `remove-item` 动作（参数为
物品变量，数量按本节物品清单的堆叠规则封顶 / 下限 0）；剧本用
SetVariable 直写 `evg.item.*` 是作者的自由（绕过堆叠上限，语义上就是
改持有量）。方法参数在引擎侧以 `type: variable` 呈现为变量选择器，
编辑器侧表单填物品 id，runtime 按 `evg.item.` 前缀归一，两种写法等价。

修改物品 id 会使剧本中已引用它的内容（变量 `evg.item.<旧id>`、
add-item / remove-item 参数）失联，编辑器在 id 编辑处提供重复与断链
提示。编辑器已按本节方法清单提供 `extensionMethod` 操作数与
`CallExtensionMethod` 动作的可视化编辑：内置清单 `runtimeMethods.ts`
与 9.3 对齐，参数表单对 `chapterId` / `itemId` 类参数给出章节与物品
候选；清单未登记的方法回退为手填 id + JSON 参数。

### 9.4 协调与扩展约定

- 清单是草案，随 runtime 设计演进；调整变量名、类型、默认值或持久化范围，
  或调整 9.3 运行配置结构时，需要同步更新本节与对应源文件
  （`runtimeSystems.ts` / `runtimeConfig.ts`）。
- `RuntimeSystemSpec` 为开放结构，后续可追加该系统的非变量需求字段
  （系统槽位、扩展方法、evg-data 行等）。
- 将来 runtime 的 extension.json 若声明所需变量，编辑器会在内置清单处
  与扩展声明合并；扩展声明的变量同样建议使用 `evg.` 命名空间。
- `runtimeSystems.ts` / `runtimeConfig.ts` / `runtimeMethods.ts` 当前不参与
  `sync_evg_data.py` 的自动同步；runtime 接入时要么把这三个文件（及其依赖
  `variable.ts`）纳入同步脚本，要么在 runtime 侧按本节约定实现对齐的读取逻辑。

## 10. 同步与扩展

### 10.1 文件同步

源文件：

```text
evg-editor/src/shared/evgData.ts
```

runtime 目标：

```text
evg-runtime/sdk/types/evg-data.ts
```

本地同步：

```bash
python sync_evg_data.py
python sync_evg_data.py --check
```

脚本位于工作目录根部，不进入 evg-editor 发布包。同步时会自动确保 `evg-runtime/sdk/types/index.ts` 中有：

```ts
export * from "./evg-data";
```

### 10.2 扩展约定

- 新核心 Action：在 `1-999` 分配 purpose，并在 `EvgActionDataMap` 中补 data 类型。
- 扩展 Action：purpose >= `1000`，可通过 declaration merging 扩展 `EvgActionDataMap`。
- 新条件操作符：加入 `ConditionPredicateOperator`，并在运行时实现对应语义。
- 新操作数来源：在 `EvgValueOperand` 中追加新的 `kind`。
- 新行类型：`type >= 1000`，避免与引擎保留区间冲突。
