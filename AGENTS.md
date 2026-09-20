# AGENTS.md

> 工作区级 AI Agent 指令：Agent 在本工作区内工作前会阅读本文件。
>
> 本文是整个工作区的总览。具体到编辑器的实现细节见 `evg-editor/AGENTS.md`，
> 公共数据契约见 `Common.md`，Runtime 扩展说明见 `evg-runtime/README.md`。

## 1. 工作区概述

本工作区是 EVG 的编辑器、运行时和示例工程组合，核心业务围绕 **Event / Action / Condition / LocationMap** 展开：

- `evg-editor/`：Electron 桌面编辑器，负责打开、校核和编辑 EVG 工程数据。
- `evg-runtime/`：AVG+ Light Engine 扩展，负责读取工程中的 `evg-data`，并根据 Event / Action / Condition 定义工作。
- `playground/`：示例 EVG 工程，用于编辑器校核、读写测试和 Runtime 调试。
- `Common.md`：EVG Data 公共契约，是编辑器与 Runtime 之间的权威文档。
- `sync_evg_data.py`：工作区级同步脚本，把编辑器的公共 TS 契约复制到 Runtime。
- `AGENTS.md`：本文件，工作区级 Agent 总览和协作约定。
- `_tmp/`：本地临时验证和测试产物，不属于产品代码，可随时清理。

整体数据流：

```text
playground 等 EVG 工程
        │
        ▼
evg-editor ── 校验结构、读取/编辑/写回 JSON ──> 工程目录
        │
        │  evg-editor/src/shared/evgData.ts
        ▼
sync_evg_data.py ──复制──> evg-runtime/sdk/types/evg-data.ts
                                      │
playground/databases/                 │
  project-data--evdata.collection.json │  Runtime 读取 evg-data 行
        └────── evg-data 行 ───────────┘
                                      ▼
                        按 Event / Action / Condition / LocationMap 契约执行
```

## 2. evg-editor

定位：

- Electron 桌面应用。
- 当前目标是编辑类似 `playground` 的 EVG 工程。
- 不负责新建工程，只打开已有工程并读写其中的数据。

技术栈：

- Electron + React + TypeScript + Vite + electron-vite + pnpm。
- 状态管理使用 Zustand。
- 界面采用扁平化 Fluent 风格，并保留少量层级阴影。

当前能力：

- 项目历史记录、目录选择、项目结构校核（必需项缺失拦截打开；
  EVG Runtime 扩展快照缺失、`project.variables.json` 缺失只警示不拦截
  ——后者由引擎在用户设置变量时创建，变量页签在文件缺失时锁定并引导，
  见 evg-editor/AGENTS.md）。
- 首页、变量与角色属性页、条件页、动作页、事件页、地点页、运行数据配置页、设置页。
- 外观系统：Windows 98（默认）与 Fluent 扁平两套皮肤，在设置页切换并持久化。
- `project.variables.json` 的变量模板读写和增删改。
- Runtime 系统变量检查与同步：内置时间 / 物品系统等子系统所需变量的声明
  清单（`src/shared/runtimeSystems.ts`，命名约定 `evg.<system>.<name>`，
  结构预留槽位 / 方法等扩展字段），主页展示各变量的就绪状态（缺失 /
  类型不符 / 持久化不符），并提供按系统或一键全部写入 project.variables.json
  的功能按钮；将来可由 runtime 扩展声明合并清单。
- 运行数据配置页：以页签（时间 / 物品 / 天气 / 地点，后续可扩展）维护 Runtime 子系统的
  运行设置——计时模式（累计天数 / 真实年月日）、起始日期、星期开关与
  起始星期、单日时段列表、物品清单（id / 名称 / 描述 / 堆叠规则）、
  天气清单（id / 名称 / 权重；空清单 = 不使用天气系统）——
  整体作为一条 evg-data 行落盘（type=1000、key=runtime-config，
  模型见 `src/shared/runtimeConfig.ts`，写入经统一契约校验）。
  地点页签维护初始地点（候选 = 已注册地点）与导航模板：
  free 简单导航（全部启用地点互通）或 graph 连通图导航（SVG canvas
  拖动地点方块 + 连线，编辑有向连通图）。
- `characters.json` 的角色属性模板和角色初始值读写。
- `evg-data` 表记录的读取与写回，支持 Event / Action / Condition 行。
- evg-data 写入前校验：公共契约结构校验（Event / Action / Condition / LocationMap
  的 data 形状、key === data.id / data.chapterId）与按行类型分组的业务 key 查重；
  读取保持宽容，不做结构校验。
- 引用完整性保护：删除条件 / 动作 / 事件前展示全部引用位置（含热点内联事件），
  用户可选择“保留悬空引用”或“级联清理引用”两种模式；级联会把引用的
  canExecute / guard 还原为 `true`、从 actions 列表移除对应项、解绑热点事件；
  删除变量前展示引用警示（不做级联）；条件 / 动作 / 事件页的 key 编辑提供
  为空与重复的即时提示。
- 条件树的递归编辑和条件引用管理。
- 动作的列表管理和组件化编辑，包含内联/引用编辑骨架与动作引用选择器。
- 扩展方法可视化编辑（`runtimeMethods.ts` 内置清单，与 Common.md §9.3
  对齐）：extensionMethod 条件操作数与 CallExtensionMethod 动作按清单
  生成参数表单（move-location 的章节候选、add-item / remove-item 的物品
  候选）；清单未登记的方法回退为手填 id + JSON 参数。
- 事件的列表管理和组件化编辑，支持 canExecute 条件绑定和有序 actions 列表；EventEditorDialog 可供后续地点热点编辑直接复用。
- 章节摘要读取 IPC，供 CallFragment 动作按章节 / fragment 选择目标。
- 地点数据和编辑器（`LocationsPage`，chapter 即 location）：按章节维护
  evg-data type=4 的 LocationMap（存在行即注册地点，支持空地点），带
  地点显示名 label 与 disabled 开关（demo 导出可禁用地点）；章节顺序参考
  project.json；尺寸编辑按 px 显示、内部归一化保存；支持扩大模式和整章移除；
  调度挂接只读检查（地点章节未加入蓝图 chapterIds 或无有效调度节点时
  显示警示条 + 刷新，不写回蓝图，见 Common.md §7）。
- 章节 JSON 摘要解析。
- 项目写操作统一走 `evg-editor/src/main/services/projectFileWriter.ts` 的
  ProjectFileWriter：白名单 + create 权限制（引擎的文件一律 create: false，
  编辑器绝不创建工程里不存在的文件），原子写入 + 项目级串行化。新增写入
  目标时先登记白名单条目。

主要代码分层：

```text
evg-editor/src/
  main/       Electron 主进程：窗口、IPC、项目读写与持久化
  preload/    contextBridge 暴露的 window.api
  renderer/   React 页面、组件和 Zustand store
  shared/     main / preload / renderer 共用类型与公共契约
```

关键文档：

- `evg-editor/AGENTS.md`：编辑器完整设计说明。
- `evg-editor/README.md`：面向使用者的简要说明。

常用命令：

```bash
cd evg-editor
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

## 3. evg-runtime

定位：

- AVG+ Light Engine 的一个扩展。
- 通过 React 组件渲染界面，并读取宿主提供的角色、对话、变量等数据。
- 读取工程中的 `evg-data` 数据表，按 Event / Action / Condition / LocationMap 契约工作。

目录结构：

```text
evg-runtime/
  src/
    index.tsx            扩展入口：导出 LocationModule（默认）/ InventoryModule
    evg/
      constants.ts       扩展 id、变量名、runtime-config 行常量
      runtime-config.ts  runtime-config 行（type=1000）的宽容读取
      evdata.ts          evg-data 行索引 + 地点可达性计算
      interpreter.ts     Event / Action / Condition 解释器（fragment 外层）
      inventory.ts       物品持有量（每物品变量 evg.item.<id>）读写
      dispatch.ts        地点调度控制器（scheduleStrategy 实现核心）
      methods.ts         扩展方法求值表（解释器与 Studio 方法共用）
    modules/
      LocationModule.tsx 地点系统：调度策略 + move-location + 地点层界面
                         （Fluent token 主题 + 时间卡 / 常驻栏 / 导航弹窗，
                         常驻区契约 OVERLAY_SAFE_AREAS 见 Common.md §9.3）
      InventoryModule.ts 物品系统：add-item / remove-item（每物品变量承载）
      TimeModule.ts     时间系统：advance-time 按时段顺序推进 day / slot
      IfExtModule.ts     条件分支：每次调用重新求值的 If/else（cond-jump-custom）
    welcome-ui.tsx       旧工程样例（已从入口移除，留作参考）
  extension.json     扩展 manifest：id / 版本 / SDK 依赖 / evg-data 数据依赖
  sdk/               @avg-studio/sdk 源码副本，包含同步来的 evg-data 类型
  dist/              构建产物
```

关键约定：

- `extension.json` 声明扩展 id（`com.notarium.evg-runtime`）、入口、SDK
  版本和数据依赖；方法按 `<扩展id>/<方法id>` 全局注册，与编辑器的
  `runtimeMethods.ts` 清单一一对应。
- 扩展通过 `evg-data` 依赖读取项目数据；`playground` 中对应
  `databases/project-data--evdata.collection.json`。读取保持宽容
  （结构问题跳行 + 告警），写入侧校验由编辑器负责。
- `sdk/types/evg-data.ts` 是从编辑器公共契约同步得到的副本，不要手改；
  sdk 是 `file:` 依赖，副本更新后要重新 `pnpm install`。
- 地点调度：LocationModule 声明项目调度策略「EVG 地点调度」——
  打开地点层挂起等待玩家，移动 / 剧情性 `move-location` 后返回章节决策；
  不挂本策略节点的项目走引擎默认顺序调度（详见 Common.md §9.3）。
- 物品状态：每物品一个 number 变量 `evg.item.<itemId>`（持有量），
  声明由编辑器从物品清单同步；不用扩展 save——模块 save 只在方法调用
  实例上可用，而 `ctx.variables` 是动作执行 / 操作数求值 / 调度 / 界面
  四层都可用的唯一持久存储。物品判断走引擎原生变量条件或 IfExt 条件
  分支（引擎自带 If 首次判断后缓存结果，不适合循环复入的片段）。
- `pnpm exec tsc --noEmit` 做类型检查（vite build 不含类型检查）。

常用命令：

```bash
cd evg-runtime
pnpm install
pnpm build
pnpm watch
pnpm exec tsc --noEmit
```

## 4. Common.md

`Common.md` 是 EVG Data 公共契约，定义了编辑器与 Runtime 共享的数据结构。
核心内容：

1. **基础类型**
   - `EvgJsonPrimitive`、`EvgJsonValue`、`EvgId`。

2. **evg-data 行结构**
   - `EvgDataRow { id, key, type, data }`。
   - `EVG_DATA_KIND`：Event = 1、Action = 2、Condition = 3、LocationMap = 4。
   - `id` 是表格内部 GUID，`key` 是业务 id。
   - Event / Action 的 `data.id` 必须等于行 `key`；Condition 树没有独立 id，行 `key` 即条件 id；LocationMap 的 `data.chapterId` 必须等于行 `key`。
   - 引擎保留 `1-999`，扩展自定义类型建议从 `1000` 开始。

3. **ConditionType**
   - 条件树由 `predicate` / `and` / `or` / `not` / `constant` 组成。
   - 谓词运算符：`eq`、`ne`、`gt`、`gte`、`lt`、`lte`、`exists`。
   - 不存在性统一用 `not(exists)`，不再提供单独的 `not_exists`。
   - 操作数支持字面量和项目变量。

4. **ActionType**
   - 结构：`id`、`label`、`guard`、`type`、`data`。
   - 核心 purpose：`SetVariable = 1`、`CallFragment = 10`、`CallExtensionMethod = 20`、`CallSystemSlot = 21`。
   - 扩展 action purpose 建议从 `1000` 开始。
   - Action 支持内联对象和字符串引用。

5. **EventType**
   - 结构：`id`、`label`、`canExecute`、`actions`。
   - fragment 调用就是一个普通 `CallFragment` 动作，不再需要 `hasFragment` / `beforeActions` / `afterActions`。
   - `canExecute` 通过后按顺序执行 `actions`。
   - `EventBinding = EventType | EventRef`，地点热点可以内联事件或引用 `type=Event` 的行。

6. **LocationMap**
   - 一个章节一条记录，`row.key === data.chapterId`。
   - `data.sceneId` 来自章节 main fragment 第一个 scene block。
   - `hotspots` 数组保存 `SceneHotspot`，形状支持 `circle` / `rect`。
   - 坐标使用归一化 `[0, 1]`，编辑器按 px 显示并在保存时换算。

7. **Runtime 系统变量**
   - Runtime 子系统（时间 / 物品系统等）所需的项目变量，命名约定
     `evg.<systemId>.<name>`，kind 为 `project`。
   - 声明源文件：`evg-editor/src/shared/runtimeSystems.ts`。
   - 编辑器主页提供就绪检查与一键写入；清单演进时需同步更新
     Common.md 第 9 节（与 Runtime 协调的依据）。
   - 子系统运行设置以一条 evg-data 行落盘（type=1000、key=runtime-config），
     结构见 Common.md 9.3，源文件 `evg-editor/src/shared/runtimeConfig.ts`，
     由编辑器的“运行数据配置”页维护。
   - 天气系统：清单非空时声明 `evg.weather.current`（string / slot），
     时间推进与调度开局时按权重 roll 写入；空清单 = 未使用（不声明、
     不 roll），主页“天气变量”节按清单动态生成。

8. **同步与扩展**
   - 契约实现文件：`evg-editor/src/shared/evgData.ts`。
   - Runtime 目标文件：`evg-runtime/sdk/types/evg-data.ts`。
   - 通过 `python sync_evg_data.py` 同步，`--check` 检查是否一致。
   - 新增操作符、操作数来源、行类型时，需要同时更新契约、文档和 Runtime 实现。

修改公共契约时的顺序：

```text
改 evg-editor/src/shared/evgData.ts
  -> 更新 Common.md
  -> 运行 python sync_evg_data.py
  -> 确保 evg-editor 和 evg-runtime 都能构建
```

## 5. 数据结构总览

### 5.1 工程文件模型

- `project.json`
  - `ProjectSummary { id, projectId, name, folderName, path, resolution? }`
  - `ProjectRecord = ProjectSummary + lastOpenedAt`
  - `ProjectResolution { width, height }`
- `chapters/*.json`
  - `ChapterSummary { id, name, sceneId, fragments }`
  - `ChapterFragmentSummary { id, name, isMain? }`（isMain = name === 'main'）
  - `sceneId` 来自 main fragment 第一个 scene block 的 `props.sceneId`
- `scenes.json`
  - `SceneSummary { id, name, layers }`
  - `SceneLayerSummary { id, name, assetPath, distance? }`
- `project.variables.json`
  - `ProjectVariablesFile { version, variables }`
  - `ProjectVariable`：`string` / `number` / `bool` / `pending` 四种变体
  - 字段：`id`、`name`、`kind`、`createdAt`、`persistence`、`type`、`defaultValue`
- `characters.json`
  - `CharacterAttributeState { definitions, characters }`
  - `AttributeType`：`string` / `number` / `bool` 三种变体
  - `CharacterAttributeEntry { id, name, attributeValues }`
  - `attributeValues` 是稀疏覆盖，缺失的 key 回退到 `AttributeType.defaultValue`

### 5.2 evg-data 行模型

```ts
interface EvgDataRow<TType extends number, TData> {
  id: string
  key: EvgId
  type: TType
  data: TData
}
```

```ts
const EVG_DATA_KIND = {
  Event: 1,
  Action: 2,
  Condition: 3,
  LocationMap: 4
} as const
```

| type | data 结构 | key 约束 |
| --- | --- | --- |
| 1 | `EventType` | `key === data.id` |
| 2 | `ActionType` | `key === data.id` |
| 3 | `ConditionType` | 行 `key` 就是条件 id |
| 4 | `LocationMap` | `key === data.chapterId` |

### 5.3 操作数

```ts
type EvgValueOperand =
  | { kind: 'literal'; value: EvgLiteralValue }
  | { kind: 'variable'; variable: string }
  | { kind: 'extensionMethod'; extensionId: string; methodId: string; args?: EvgJsonValue }
```

- 字面量只允许 `string | number | boolean | null`
- 变量来源对应 `project.variables.json` 的 `variables[].name`
- `extensionMethod`：扩展方法返回值，服务于 canExecute / guard 等
  fragment 执行之外的判断层（求值由 runtime 完成）；已登记方法见
  `evg-editor/src/shared/runtimeMethods.ts`（move-location /
  add-item / remove-item / advance-time）；SetVariable 的值只接受
  字面量 / 变量，extensionMethod 操作数专用于判断层

### 5.4 Condition 嵌套

```ts
type ConditionBinding = true | ConditionType | ConditionRef
type ConditionExpression = ConditionType | ConditionRef

type ConditionType =
  | ConditionPredicate
  | ConditionAnd
  | ConditionOr
  | ConditionNot
  | ConditionConstant
```

- `ConditionRef = EvgId`，引用 `type=Condition` 的 evg-data 行
- `ConditionPredicate.operator`：`eq` / `ne` / `gt` / `gte` / `lt` / `lte` / `exists`
- `ConditionAnd` / `ConditionOr` 通过 `children: ConditionExpression[]` 递归组合
- `ConditionNot` 通过 `child: ConditionExpression` 取反
- `ConditionConstant.value` 是 `boolean`
- 不存在统一写成 `not(exists)`

### 5.5 Action / Event 嵌套

```ts
interface ActionType {
  id: EvgId
  label: string
  guard: ConditionBinding
  type: number
  data: unknown
}

type ActionBinding = ActionType | ActionRef

interface EventType {
  id: EvgId
  label: string
  canExecute: ConditionBinding
  actions: ActionBinding[]
}
```

- 核心 Action purpose：`SetVariable = 1`、`CallFragment = 10`、`CallExtensionMethod = 20`、`CallSystemSlot = 21`
- `ActionBinding` 支持内联 `ActionType` 或字符串 `ActionRef`
- `EventType.actions` 是一个有序数组，每一项都可以是内联 Action 或 Action 引用
- fragment 调用本身就是普通的 `CallFragment` 动作，没有额外的 `hasFragment` / `beforeActions` / `afterActions`

### 5.6 LocationMap 嵌套

```ts
interface LocationMap {
  chapterId: EvgId
  sceneId: EvgId
  label?: string      // 地点显示名，缺省回退章节名
  disabled?: boolean  // 禁用的地点不可移动、不执行调度；缺省视为 false
  hotspots: SceneHotspot[]
}

interface SceneHotspot {
  id: EvgId
  label: string
  enabled: boolean
  shape: SceneHotspotShape
  event?: EventBinding
}

type SceneHotspotShape =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number }

type EventBinding = EventType | EventRef
```

坐标使用 `[0, 1]` 归一化坐标：

- `x` / `y` / `rect.width` / `rect.height` 相对场景参考分辨率
- `circle.radius` 相对参考分辨率短边

### 5.7 整体嵌套关系

```text
LocationMap (evg-data type=4, key=chapterId)
  └─ SceneHotspot
       ├─ SceneHotspotShape
       └─ event?: EventBinding
             ├─ EventType
             │    ├─ canExecute: ConditionBinding
             │    │    ├─ true
             │    │    ├─ ConditionType (inline 条件树)
             │    │    │    ├─ ConditionPredicate (operands: EvgValueOperand[])
             │    │    │    ├─ ConditionAnd / ConditionOr (children: ConditionExpression[])
             │    │    │    ├─ ConditionNot (child: ConditionExpression)
             │    │    │    └─ ConditionConstant
             │    │    └─ ConditionRef -> evg-data type=Condition
             │    └─ actions: ActionBinding[]
             │         ├─ ActionType
             │         │    ├─ guard: ConditionBinding
             │         │    └─ data: purpose-specific
             │         └─ ActionRef -> evg-data type=Action
             └─ EventRef -> evg-data type=Event
```

### 5.8 跨文件引用

- `LocationMap.chapterId` -> `ChapterSummary.id`
- `LocationMap.sceneId` -> `SceneSummary.id`
- `CallFragmentActionData.chapterId` / `fragmentId` -> `ChapterSummary` / `ChapterFragmentSummary`
- `SetVariableActionData.variable` -> `ProjectVariable.name`
- `ConditionRef` / `ActionRef` / `EventRef` -> 对应的 evg-data 行 `key`

## 6. playground

`playground` 是一个示例 EVG 工程，也是编辑器当前最主要的测试工程。

用途：

- 验证项目结构校核规则。
- 验证变量、角色属性、章节摘要和 `evg-data` 的读写。
- 作为条件、Event、Action 编辑和 Runtime 联调的样例数据。
- 不要把它当作唯一的模板来源；实际规则以 `Common.md` 和编辑器校验代码为准。

目录结构：

```text
playground/
  project.json                              工程基础信息、分辨率、章节顺序、扩展与数据绑定
  project.variables.json                    项目变量模板
  characters.json                           角色、表情、属性模板、角色初始属性值
  scenes.json                               场景和背景层定义
  extensions.json                           扩展配置，样例中为空对象

  assets/                                   资源目录
    backgrounds/  characters/  bgm/  se/
    voice/  video/  fonts/  particles/  transitions/  ui/  dynamic/

  chapters/                                 章节 JSON
    开始.json  序章.json  客厅场景.json
    门口场景.json  房间场景.json

  databases/
    project-data.database.json              数据库描述，声明 evdata collection 及 schema
    project-data--evdata.collection.json    evg-data 记录，row 为 { id, key, type, data }

  config/                                   Studio 项目配置、迁移和个性化数据
  extensions/                               扩展快照与启用扩展
  ui/                                       自定义 UI 扩展/主题资源
  .studio/                                  Studio 内部状态，人工编辑时应忽略
  .studio-history/                          Studio 内部历史，人工编辑时应忽略
```

说明：

- `chapters/*.json` 中的章节包含 `fragments`，fragment 内包含 `blocks`。
- `databases/project-data.database.json` 描述数据表结构；
  `databases/project-data--evdata.collection.json` 存放真正的 evg-data 行。
- `evg-data` 行的 `data` 在文件里是 JSON 字符串，编辑器读取时会 `JSON.parse`，写入时会 `JSON.stringify`。
- `.studio/`、`.studio-history/` 以及 `extensions/.snapshot-lifecycle-*` 属于工具生成内容，
  人工修改时优先改正式 JSON，不要直接改这些内部状态。

## 7. 常用命令汇总

工作区根目录：

```bash
python sync_evg_data.py
python sync_evg_data.py --check
```

编辑器：

```bash
cd evg-editor
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

Runtime：

```bash
cd evg-runtime
pnpm install
pnpm build
pnpm watch
```

## 8. 协作规范

- 公共契约以 `evg-editor/src/shared/evgData.ts` 为源，`Common.md` 为权威说明。
- 不要手改 `evg-runtime/sdk/types/evg-data.ts`；它由同步脚本维护。
- 所有工程 JSON 写入必须经过统一写入入口，保持原子写入和项目级串行化。
- 不提供新建工程功能，只打开已有工程；新增工程逻辑要先更新本文档和 `evg-editor/AGENTS.md`。
- 所有 token、私钥、password 等敏感凭据不得写入代码或提交到仓库；使用环境变量和 `.gitignore`。
- 修改核心契约、目录规则、IPC、数据模型或构建方式时，同步维护 `Common.md`、
  `evg-editor/AGENTS.md` 和本文件。
