# EVG Runtime

EVG 框架的运行时扩展。读取工程 `evg-data` 数据表，按
Event / Action / Condition / LocationMap 契约把 AVG+ Light Engine
的章节调度呈现为"地点移动"，使项目能以 SLG 循环运行。

数据契约与编辑器侧的配置说明见工作区 `Common.md`（尤其 §9）；
本文面向**使用本扩展做项目的作者**，也覆盖开发者关心的结构说明。

---

> 这是一个 AVG+ Light Engine **扩展**（`extension.json` id:
> `com.notarium.evg-runtime`）。每个导出的 `Extension` 子类 = 一个子模块；
> 方法按 `<扩展id>/<方法id>` 全局注册，与编辑器的内置清单
> `evg-editor/src/shared/runtimeMethods.ts` 一一对应。

## 快速上手：一个最小的 SLG 项目

1. **启用扩展**：把构建产物装进 Studio 项目（`extension.json` 声明
   `sdkVersion >=2.0.0`，依赖 `evdata` 数据表）。
2. **配置运行数据**：编辑器「运行数据配置」页设置时段、物品、天气、
   地点与导航模板，保存写入工程的 `runtime-config` 数据行。
3. **注册地点**：编辑器「地点」页把章节设为地点，铺热点并绑定事件。
4. **挂调度节点**：在 Studio 的调度图里，把项目根调度节点选到
   **「EVG 地点调度」**——这一步是 SLG 循环的总开关。
5. **主页同步变量**：编辑器首页一键写入运行时所需变量声明
   （`evg.*`），引擎内的剧本编辑器才能引用它们。

之后项目会按「进初始地点章节 → 打开地点层等待 → 玩家移动 / 触发热点
→ 切章 → 再等待」循环运行。

> ⚠️ **不挂「EVG 地点调度」节点 = 不启用地点系统**，项目走引擎默认的
> 顺序调度（纯视觉小说模式）。没有独立的开关字段——调度图就是开关。

## 变量速查

所有框架状态都在这些变量上，剧本里直接用引擎原生变量条件引用它们：

| 变量 | 类型 / 缺省 | 含义 | 何时写入 |
| --- | --- | --- | --- |
| `evg.location.current` | string / `''` | 当前地点（chapterId） | 调度开局初始化；`move-location` 移动时 |
| `evg.time.day` | number / 1 | 游戏天数，从 1 递增 | `advance-time` 跨天时 |
| `evg.time.slot` | string / 首时段 | 当前时段 id | 每次 `advance-time` |
| `evg.time.paused` | bool / false | `true` 时时间空转 | 剧本 SetVariable 自行控制 |
| `evg.weather.current` | string / `''` | 当前天气 id | 每次 `advance-time` 后 roll；调度开局 |
| `evg.inventory.gold` | number / 0 | 货币（示例标量） | 剧本 SetVariable |
| `evg.item.<itemId>` | number / 0 | 物品持有量 | `add-item` / `remove-item` / SetVariable |

> ⚠️ **变量声明要先同步**：`evg.*` 变量必须在编辑器首页（系统变量 +
> 物品变量 + 天气变量）写入 `project.variables.json` 后，引擎内剧本
> 编辑器的变量选择器里才能看到并引用。天气 / 物品变量按运行数据配置
> 的清单动态生成——清单为空时对应变量不声明、功能即未启用。

> ⚠️ **改 id 会断引用**：时段 id、天气 id、物品 id 都可能已被写进剧本
> 条件（如 `evg.weather.current == "rain"`）。编辑器会提示重复 / 为空，
> 但**不会**阻止你改；改之前先确认剧本里的引用。

## 剧本写作示例

**时间推进 + 天气分支**（片段内）：

```
[动作] advance-time ×1        → 时段推进一格；天气随之重 roll
[分支] evg.time.slot == "night" ? 夜晚片段 : 白天片段
[分支] evg.weather.current == "rain" ? 雨天片段 : 晴天片段
```

**物品条件**（fragment 内两种写法）：

```
[分支] evg.item.key >= 1      → 有钥匙：开门（引擎原生变量条件）
[调用] cond-jump-custom       → IfExt 条件分支（见下文"循环复入"）
        variable: evg.item.key   opr: >=   compare: 1
        trueFrag: 开门片段        falseFrag: 提示没有钥匙
```

**剧情性移动**（动作里调用扩展方法）：

```
[动作] move-location          → 切换到目标章节
        chapterId: ch-market  chapterName: 集市
```

**热点事件**（编辑器「地点」页绑定在热点上）：

```
canExecute: evg.item.key >= 1   → 不满足时热点按钮直接置灰
actions:
  1. move-location(ch-market)   → 移动，结束本轮等待
  或
  1. SetVariable(gold += 10)    → 不移动的热点执行完继续等待
```

**进入触发 onEnter**（编辑器「地点」页的「进入触发」列表）：每次到达
该地点，章节主 fragment 播完、地点层出现前按序尝试执行；每项独立
`canExecute` 开关。「只触发一次」用变量做门槛：

```
触发 1「首次进入介绍」
  canExecute: evg.story.living_room_visited == 0
  actions:
    1. CallFragment(片段: 初到客厅)
    2. SetVariable(evg.story.living_room_visited = 1)
触发 2「桌上钥匙」（还没拿走时）
  canExecute: evg.item.key == 0
  actions:
    1. SetVariable(evg.item.key = 1)
```

注意：开局首轮直接进初始地点章节（开场铺垫优先），初始地点的 onEnter
在第二轮到达时触发；onEnter 里的 move-location 只写位置变量，由下一轮
调度切过去（不会打断本轮触发链）。

## 模块与运行循环

### LocationModule（子模块 id `location`）

- **调度策略「EVG 地点调度」**（`location-dispatch`）：在 Studio 把项目
  根调度节点选到本策略即启用 SLG 循环——开局进初始地点章节，此后打开
  地点层（热点 + 导航）挂起等待玩家，移动后切章循环。不用地点系统的
  项目不挂本策略节点，走引擎默认的顺序调度。
- **`move-location` 方法**：剧情性移动。校验目标地点存在且未禁用（不校验
  连通性）→ 写 `evg.location.current`；调度等待中立即切章，否则本轮
  剧本走完后由调度器切过去。
- **地点层界面**：调度等待期间经 `ctx.ui.show` 打开，pointer-events
  穿透，只有热点与常驻控件可点。布局：左上时间信息卡（时间 + 天气，
  时间系统未就绪时整卡隐藏）、底部左角当前地点名 + 右角导航按钮
  （导航以弹窗面板展开）、热点铺在其余区域。视觉为 Fluent token
  （浅 / 深两套）；主题是**项目数据**——运行数据配置 · 地点页签的
  `location.theme`（auto 跟随玩家系统深浅色），决定玩家看到的画面，
  不进任何扩展设置。常驻元素占屏契约 `OVERLAY_SAFE_AREAS` 与编辑器
  热点安全区参考线镜像（Common.md §9.3），在编辑器里铺热点时会画出
  参考线提示避让。

### TimeModule（子模块 id `time`）

`advance-time` 方法：显式推进时间——按 runtime-config 时间清单的时段
顺序推进 count 个时段，跨过当天最后一个时段进入下一天（day + 1、回到
第一个时段）。

> ⚠️ **没有自动推进**：world clock 只在剧本要求时走动。想让时间流动，
> 剧本里必须显式调用 `advance-time`。
>
> ⚠️ `evg.time.paused = true` 时推进空转（用于剧情冻结时间）。
> 当前时段不在清单里（id 被改过）按"首时段之前"处理，不会报错。
> 推进与计时模式无关，calendar 日期由展示层从 day 推算。

**天气系统**（随时间联动）：runtime-config 的天气清单非空时，每次
`advance-time` 后按权重 roll 一次写入 `evg.weather.current`，调度开局
也 roll 一次（开场剧本即可分支）。清单为空 = 不使用天气系统：变量不
声明、不 roll。地点层时间卡在天气可用时展示天气名。

> ⚠️ 天气是"时间推进时重 roll"的——同一时段内反复读档不会保持天气
> 一致性；需要剧情锁定天气（"这场雨直到主角离开"）目前需要自行用
> 变量 + 分支模拟，`set-weather` 方法在计划中。

### InventoryModule（子模块 id `inventory`）

- `add-item` / `remove-item`：按物品清单的堆叠规则增减持有量；参数在
  引擎侧是变量选择器（type: variable），编辑器侧表单填物品 id，
  runtime 按 `evg.item.` 前缀归一，两种写法等价。
- 持有状态 = 每物品一个 number 变量 `evg.item.<itemId>`（slot 持久化，
  声明由编辑器从物品清单同步），而不是扩展 save——SDK 的 save 只在
  方法调用实例上可用，而物品状态要覆盖动作执行、调度层、界面层与引擎
  原生变量条件（`src/evg/inventory.ts` 顶部有完整说明）。
- **没有 has-item**：物品判断走引擎原生变量条件（`evg.item.key >= 1`）
  或 IfExt 条件分支；canExecute / guard 用变量操作数。
- `remove-item` 下限 0，不会出现负数；`add-item` 按清单的最大堆叠封顶。

### IfExtModule（子模块 id `if-ext`）

引擎自带的 If 面向线性 AVG：一个判断只执行一次，循环复入（SLG 反复
调用的片段、读档回放）会沿用首次结果。

> ⚠️ **SLG 项目里请用 `cond-jump-custom` 代替引擎 If 做变量分支**——
> 它每次调用重新求值：按变量的运行时类型解析对比值并比较，满足 /
> 不满足分别 callFragment 到真 / 假分支片段（片段返回后继续执行调用点
> 之后的流程）。参数：`variable`（变量）、`opr`（> / >= / < / <= / ==
> / !=）、`compare`（按变量类型解析）、`trueFrag` / `falseFrag`（均可省，
> 省略即该方向不跳）。

**变量写入三连**（事件 / 触发链里的 SetVariable 动作，`op` 字段）：

```
op 省略 / = assign  → 赋值：variable = value（字面量 / 变量 / 扩展方法返回值）
op = toggle         → 布尔翻转：true ↔ false（目标当前值不是布尔则告警跳过）
op = add            → 数值自增：variable += value（目标与增量都必须是数字）
```

编辑器按目标变量的声明类型过滤操作项（bool 才有翻转、number 才有自增）。
`add` **不做边界截断**——需要上限 / 下限的剧情语义用条件分支显式表达。

### 解释器（`src/evg/interpreter.ts`，开发者向）

服务 fragment 之外的判断与执行层：热点事件的 `canExecute`（按钮显隐）、
动作 `guard`（是否放行）、事件 actions 执行（SetVariable / CallFragment /
CallExtensionMethod / CallSystemSlot）。`extensionMethod` 操作数与
CallExtensionMethod 动作经 `methods.ts` 的求值表分派到各方法实现；
条件引用（ConditionRef）支持递归展开并防环，断链按 false 处理。

方法实现本体只写在 `methods.ts`（`evaluate*` 函数）：求值表与各 Module
的 `method()` 注册（引擎原生方法块路径）都委托到它，保证两条执行路径
行为一致。新增方法的固定顺序：`methods.ts` 写实现 → 对应 Module 声明
schema 并转发 → 编辑器 `runtimeMethods.ts` 登记 → Common.md §9.3 契约。

## 状态与存档

- 框架状态一律放 `ctx.variables`（`evg.*` 命名空间）；模块不使用
  saveSchema——SDK 的 save 只在方法调用实例上可用，而变量在动作执行 /
  操作数求值 / 调度 / 界面四层都可读，是唯一的持久存储。
- 调度控制器的会话状态（等待中的决策、快照）是包级单例的内存态，
  不落盘。读档恢复 = 引擎回放变量 + 调度图重新走到等待点。
- 所有 `evg.*` 变量均为 slot 持久化（随存档保存）。

## 常见问题

**Q：地点层不出现，项目像普通 AVG 一样顺序跑？**
调度图根节点没选「EVG 地点调度」，或没有章节被注册为地点。

**Q：剧本编辑器里找不到 `evg.*` 变量？**
没做变量同步——回编辑器首页点同步；或清单为空（物品 / 天气未配置），
对应变量本来就不存在。

**Q：`advance-time` 调了但时间没走？**
检查 `evg.time.paused` 是否为 `true`；或该片段引擎 If 用了首次结果——
改用 IfExt 的 `cond-jump-custom`。

**Q：移动按钮点了没反应？**
目标地点可能被禁用（地点页 disabled）或未连入导航图（graph 模式需
在连通图编辑器里连线）；热点则可能是 `canExecute` 不满足而置灰。

**Q：改了时段 / 天气 / 物品 id 之后剧本分支全失效？**
预期行为——id 是剧本引用的键。编辑器会在 id 编辑处提示，改前先全局
搜索剧本引用。

## 已知限制 / 待定

- 热点用归一化坐标近似铺在 ui.show 容器上（circle 半径以
  `min(vw, vh)` 近似场景短边），假设容器与场景视口重合；宿主的
  letterbox 行为若与假设不符需再对齐。
- `sdk/index.ts` 中 `extension-inspector` 导出被注释：SDK 副本未包含该
  文件，同步副本时若带上可恢复。

## 目录结构与开发

```
src/
  index.tsx               扩展入口：导出 LocationModule（默认）/ InventoryModule / IfExtModule / TimeModule
  evg/
    evg-data.ts           EVG Data 公共契约副本（sync_evg_data.py 维护，只读）
    constants.ts          扩展 id、变量名、runtime-config 行常量
    runtime-config.ts     runtime-config 行（type=1000）的宽容读取
    evdata.ts             evg-data 行索引（事件/动作/条件/地点）+ 可达性计算
    interpreter.ts        Event / Action / Condition 解释器（fragment 外层）
    inventory.ts          物品持有量（每物品变量 evg.item.<id>）读写
    dispatch.ts           地点调度控制器（scheduleStrategy 的实现核心）
    methods.ts            扩展方法求值表（解释器与 Studio 方法共用逻辑）
    time.ts               时间格式化 / 天气 roll（纯函数）
  modules/
    LocationModule.tsx    地点系统：调度策略 + move-location + 地点层界面
    InventoryModule.ts    物品系统：add-item / remove-item（每物品变量承载）
    IfExtModule.ts        条件分支：cond-jump-custom 每次调用重新求值
    TimeModule.ts         时间系统：advance-time 按时段顺序推进 day / slot
  welcome-ui.tsx          旧工程样例（已从入口移除，留作界面写法参考）
extension.json            manifest - id / 版本 / sdkVersion / evdata 依赖
vite.config.ts            build 配置 - lib 模式 ESM 输出
sdk/                      @avg-studio/sdk 官方源码副本（只读，不承载 EVG 契约）
```

```bash
pnpm install         # 安装 react / vite + 复制 sdk 副本（file: 依赖）
pnpm build           # 单次构建到 dist/
pnpm watch           # 监听 src/ 改动增量构建；Studio Preview 自动热接
pnpm exec tsc --noEmit   # 类型检查（vite build 不做类型检查）
```

注意：`sdk/` 是 `file:` 依赖，sdk 副本更新后需要重新 `pnpm install`
才会反映到 node_modules。EVG 契约副本不在 sdk 里——
`src/evg/evg-data.ts` 属于本扩展源码，由工作区根部的
`python sync_evg_data.py` 从 `evg-editor/src/shared/evgData.ts`
整体复制维护，SDK 大版本更新 / 重新生成 sdk 副本不影响它。
sdk 副本本身必须保持官方原样，工作区不向它写入任何内容。
（当前副本的 `sdk/index.ts` 因缺 `extension-inspector.ts` 注释了该导出，
带 NOTE 标记；换用完整官方副本时可恢复。）

当前基于 **SDK 2.0.0**（`extension.json` 声明 `>=2.0.0`）。2.0 的
主要变化对本扩展的影响：存档声明改为 `Extension.withSave(schema)`
（本扩展不用 save，无影响）；方法可选 `this.method()` 绑定写法
（全局 `method()` 保留，暂不迁移）；调度契约收紧——`resolve` 返回的
chapterId 必须来自 `input.chapters`，调度器已按此把地点先与候选章节
求交集（含剧情移动落点校验）；`VariablePersistence` 新增 `session`
（本扩展只用 slot，无影响）。
