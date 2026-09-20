# EVG Editor 项目设计说明

本文记录 EVG Editor 的整体设计、关键约定和后续修改入口。它是项目结构、进程边界、数据模型和 UI 规范的长期参考文档。

## 1. 项目定位

EVG Editor 是一个 Electron 桌面应用，目标是编辑类似 `playground` 的 EVG 工程文件。当前阶段已完成：

- Electron 桌面壳
- React 多页面框架
- 项目历史记录
- 项目目录选择与结构校核
- 项目摘要模型
- 亮 / 暗主题切换与双皮肤（Fluent / Windows 98）
- 扁平化 Fluent 风格 UI
- `project.variables.json` / `characters.json` / `evg-data` 表的读取、编辑与原子写回
- 条件 / 动作 / 事件 / 地点（含热点）的可视化编辑
- 章节摘要、场景摘要与 assets 资源预览

当前尚未实现工程文件树浏览和任意文件的内容编辑，这些属于后续迭代。

## 2. 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面运行时 | Electron 44 |
| UI | React 19 |
| 语言 | TypeScript 7 |
| 构建 | Vite 7 + electron-vite 5 |
| 包管理 | pnpm 11 |
| 状态管理 | Zustand 5 |

关键配置：

- `electron.vite.config.ts`：分别配置 main / preload / renderer 三个构建目标
- `build.externalizeDeps`：main、preload 中不打包 Node / Electron 依赖
- `@vitejs/plugin-react`：renderer 的 React 支持
- `pnpm-workspace.yaml`：允许 `electron` 和 `esbuild` 构建脚本

## 3. 常用命令

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm build
pnpm start
```

命令说明：

- `pnpm dev`：electron-vite 开发模式，启动主进程 + renderer dev server
- `pnpm typecheck`：分别检查 node 侧和 web 侧 TypeScript
- `pnpm build`：构建到 `out/`
- `pnpm start`：预览构建结果

## 4. 目录结构

```text
evg-editor/
  AGENTS.md                     项目设计说明
  README.md                    面向用户的简要说明
  package.json                 依赖与脚本
  electron.vite.config.ts      三目标构建配置
  pnpm-workspace.yaml          pnpm 构建白名单
  tsconfig.json                TS project references
  tsconfig.node.json           main / preload / shared 类型配置
  tsconfig.web.json            renderer / shared 类型配置
  .env.example                 环境变量模板，不含真实凭据
  .gitignore                   依赖、构建产物、凭据文件排除规则

  src/
    shared/                    main / preload / renderer 共用类型与纯函数
      project.ts               项目摘要、校核结果模型
      ipc.ts                   IPC 频道名与共享 API 类型
      evgData.ts               EVG Data 公共契约（零依赖，可同步到 runtime）
      evgDataValidate.ts       契约结构校验（写入前调用，零依赖）
      database.ts              数据库定义、descriptor 与 evg-data 行模型
      chapter.ts               章节摘要模型
      scene.ts                 场景摘要模型
      variable.ts              项目变量模型与创建工具
      attribute.ts             角色属性模型与创建工具
      runtimeSystems.ts        Runtime 系统子系统所需的变量声明、检查与修复
      runtimeConfig.ts         Runtime 运行配置模型（evg-data type=1000）、
                               默认值与结构校验
      runtimeMethods.ts        evg-runtime 扩展方法清单（move-location /
                               add-item / remove-item），
                               extensionMethod 可视化编辑依据

    main/
      index.ts                 主进程入口、窗口创建、服务初始化
      ipc/
        projects.ts            项目相关 IPC handler
        editorData.ts          变量 / 属性 / evg-data / 章节 / 场景 / assets IPC
        window.ts              窗口控制 IPC handler
      services/
        projectService.ts      项目加载、校核、历史写入编排
        projectStructure.ts    项目必需目录 / JSON 文件清单
        projectValidator.ts    目录和 JSON 文件校核
        projectSummaryParser.ts 解析 project.json 并生成摘要
        projectHistoryStore.ts 项目历史持久化
        projectFileWriter.ts   统一原子写入 + 项目级写锁
        projectDatabaseParser.ts 解析 project-data.database.json 并校验 evg-data 表
        databaseCollectionStore.ts evg-data 读取、全量写入、插入记录
        projectChapterParser.ts 扫描 chapters/ 生成章节摘要
        projectSceneParser.ts  解析 scenes.json 生成场景摘要
        projectAssetStore.ts   读取 assets/ 资源为 data URL
        projectVariablesStore.ts project.variables.json 读写
        characterAttributeStore.ts characters.json 属性部分读写

    preload/
      index.ts                 contextBridge 暴露 window.api

    renderer/
      index.html               renderer HTML 与 CSP
      src/
        main.tsx               React 入口，先应用主题再挂载
        App.tsx                应用壳、页面切换、全局错误提示
        env.d.ts               window.api 全局类型声明
        assets/main.css        全局主题变量与所有样式
        components/
          Icons.tsx            SVG 图标
          Sidebar.tsx          侧边导航
          TitleBar.tsx         自定义标题栏与主题切换
          GlobalToolbar.tsx    全局工具栏（刷新）
          data/                通用数据编辑组件
            EditorDialog.tsx       通用弹窗
            ReferenceDeleteDialog.tsx 删除保护弹窗（引用警示 + 两种处理模式）
            DraftHeaderActions.tsx 草稿页右上角动作组（未保存/取消修改/保存）
            VariableEditor.tsx     变量实时编辑器（绑定草稿）
            AttributeEditor.tsx    属性模板实时编辑器（绑定草稿）
            CharacterAttributeValueEditor.tsx 角色初始值编辑
            ValueEditor.tsx        按类型编辑默认值
          home/
            RuntimeSystemsPanel.tsx 主页 Runtime 系统变量检查与同步面板
          runtime/
            TimeConfigEditor.tsx     运行配置 · 时间页签编辑器
            InventoryConfigEditor.tsx 运行配置 · 物品页签编辑器
            LocationConfigEditor.tsx 运行配置 · 地点页签编辑器
            LocationGraphEditor.tsx  连通图导航的可视化编辑器（SVG）
          evg/                 EVG 数据编辑组件
            Combobox.tsx / VariableCombobox.tsx 下拉选择
            ExtensionMethodEditor.tsx 扩展方法编辑（条件操作数 /
                               CallExtensionMethod 动作共用）
            condition/         ConditionEditor、ConditionBindingEditor、
                               操作数编辑、条件引用选择器、运算符与类型推断
            effect/            ActionEditor、ActionDataEditor（按 purpose 分发）、
                               ActionBindingEditor、动作引用选择器
            event/             EventEditor、EventBindingEditor、事件引用选择器
            scene/             HotspotPropertyEditor（px ↔ 归一化换算）
        hooks/
          useAssetUrl.ts       assets 资源 data URL 加载（带模块级缓存）
        lib/
          format.ts            时间格式化等工具
          evgReferences.ts     evg-data 引用扫描与级联清理（renderer 侧）
        pages/
          HomePage.tsx         首页、最近项目、项目总览
          VariablesPage.tsx    变量与角色属性编辑页
          ConditionsPage.tsx   条件定义列表与递归编辑
          ActionsPage.tsx      动作定义列表与编辑
          EventsPage.tsx       事件定义列表与编辑
          LocationsPage.tsx    地点编辑页（chapter 即 location，含热点）
          RuntimeConfigPage.tsx 运行数据配置页（时间 / 物品 / 地点页签）
          SettingsPage.tsx     设置页、外观字段
        stores/
          useAppStore.ts       应用全局状态（页面 / 主题 / 项目 / 历史）
          useVariableEditorStore.ts 变量与角色属性编辑状态
          useEvgDataStore.ts   evg-data 记录的读取、编辑与保存
          useChapterStore.ts   章节摘要
          useSceneStore.ts     场景摘要
```

## 5. 分层职责

### 5.1 shared

`src/shared` 只放主进程和渲染进程都能复用的类型与常量：

- 项目摘要模型
- 项目校核结果模型
- IPC 频道名
- preload API 类型

shared 中不写 Electron API、不写 DOM API、不写业务逻辑。

### 5.2 main

`src/main` 是唯一拥有 Node / Electron 权限的层：

- 创建 `BrowserWindow`
- 调用系统目录选择器
- 访问文件系统
- 读写项目历史
- 注册 IPC handler
- 打开外部链接

业务规则尽量放在 `services/`，IPC 层只做参数校验和结果包装。

### 5.3 preload

`src/preload/index.ts` 通过 `contextBridge` 暴露：

```ts
window.api
```

Renderer 不直接使用 `ipcRenderer`、`fs`、`path` 等 Node 能力，只通过 `window.api` 调用受控接口。

### 5.4 renderer

`src/renderer` 是 React 应用：

- `App.tsx` 负责应用壳和页面切换
- `pages/` 负责页面级 UI
- `components/` 负责复用组件
- `stores/useAppStore.ts` 负责全局状态
- `assets/main.css` 负责主题与视觉

## 6. 启动流程

1. Electron 主进程执行 `src/main/index.ts`
2. `app.whenReady()` 后创建：
   - `ProjectHistoryStore`
   - `ProjectService`
3. 注册：
   - 窗口控制 IPC
   - 项目相关 IPC
   - 编辑数据 IPC（变量 / 属性 / evg-data / 章节 / 场景 / assets）
4. 创建 `BrowserWindow`
5. preload 通过 `contextBridge` 注入 `window.api`
6. renderer 挂载 React
7. `App` 调用 Zustand 的 `initialize()`
8. renderer 通过 `window.api.projects.list()` 拉取历史项目
9. 首页展示最近项目

窗口配置要点：

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false,
  contextIsolation: true,
  nodeIntegration: false
}
```

- `contextIsolation: true`：preload 与页面 JS 隔离
- `nodeIntegration: false`：renderer 无 Node 权限
- `sandbox: false`：当前 preload 使用 `process.platform`，后续如需可评估收紧

外部链接处理：

```ts
mainWindow.webContents.setWindowOpenHandler((details) => {
  void shell.openExternal(details.url)
  return { action: 'deny' }
})
```

不在应用内打开新窗口，交给系统浏览器。

## 7. IPC 设计

### 7.1 频道定义

所有频道名集中在 `src/shared/ipc.ts`：

```ts
IPC_CHANNELS = {
  projects: {
    list: 'projects:list',
    open: 'projects:open',
    openRecent: 'projects:open-recent',
    reload: 'projects:reload',
    remove: 'projects:remove',
    clear: 'projects:clear'
  },
  variables: {
    read: 'variables:read',
    write: 'variables:write'
  },
  attributes: {
    read: 'attributes:read',
    write: 'attributes:write'
  },
  evgData: {
    read: 'evg-data:read',
    write: 'evg-data:write'
  },
  schedule: {
    read: 'schedule:read'
  },
  chapters: {
    read: 'chapters:read'
  },
  scenes: {
    read: 'scenes:read'
  },
  assets: {
    read: 'assets:read'
  },
  window: {
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggle-maximize',
    close: 'window:close',
    maximizeChanged: 'window:maximize-changed'
  }
}
```

### 7.2 统一结果类型

项目相关 IPC 使用：

```ts
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
```

main 侧通过 `run()` 包装异常：

- 成功：`{ ok: true, data }`
- 失败：`{ ok: false, error }`

renderer 的 `unwrap()` 再统一转成 `throw new Error(error)`。

这样可以让业务错误经过 IPC 后仍然保持可展示的信息。

### 7.3 preload API

暴露结构：

```ts
window.api = {
  platform: process.platform,
  window: {
    minimize,
    toggleMaximize,
    close,
    onMaximizeChange
  },
  projects: {
    list,
    open,
    openRecent,
    reload,
    remove,
    clear
  },
  variables: {
    read,
    write
  },
  attributes: {
    read,
    write
  },
  evgData: {
    read,
    write
  },
  schedule: {
    read
  },
  chapters: {
    read
  },
  scenes: {
    read
  },
  assets: {
    read
  }
}
```

渲染进程只依赖这个 API，不感知具体 IPC 频道名。

## 8. 安全规范

- 所有 token、私钥、password 等敏感凭据禁止写入代码或提交仓库
- 需要第三方凭据时使用环境变量
- `.gitignore` 排除：
  - `.env` / `.env.*`（保留 `.env.example`）
  - `*.pem` / `*.key` / `*.p12` / `*.pfx`
  - `credentials*.json` / `secrets*.json`
  - `node_modules/`、`out/`、`dist/`、`release/`
- renderer 中不得直接访问 Node / fs / Electron API
- main 侧对外部输入做校验，例如项目目录必须存在并满足工程结构规则
- 外部链接通过 `shell.openExternal` 交给系统浏览器

`renderer/index.html` 当前包含 CSP：

```html
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self' data:;
connect-src 'self' ws: http: https:
```

`unsafe-inline` 是为开发期 Vite / React Refresh 保留的，后续可评估按环境拆分配置。

## 9. 项目打开与结构校核

### 9.1 样例工程

样例工程位于工作区：

```text
../playground
```

根目录当前结构：

```text
project.json
characters.json
extensions.json
project.variables.json
scenes.json

assets/
  .manifest.json
  backgrounds/
  bgm/
  characters/
  dynamic/
  fonts/
  particles/
  se/
  transitions/
  ui/
  video/
  voice/

chapters/
databases/
config/
extensions/
ui/

.studio/
.studio-history/
```

用户已确认 `asset/` 是笔误，工程实际只使用 `assets/`。

### 9.2 当前校核规则

必需目录：

```text
assets/
chapters/
databases/
```

必需根 JSON：

```text
project.json
characters.json
scenes.json
```

`extensions.json` 与 `project.variables.json` 不在必需清单：前者是引擎的
遗留聚合文件，新式工程没有；**后者由引擎在用户设置变量时创建**——引擎
新建的工程没有它。读取缺失按空清单处理，同时给出 warning 级 issue 提醒
“去引擎端设置变量”；变量页签在文件缺失时锁定并显示引导（store 的
`variablesFileExists` 驱动）；编辑器保存变量会创建 / 写回该文件
（schema version 2 与引擎写出的格式一致）。

校验要求：

- 目录必须存在且是目录
- JSON 文件必须存在且是合法 JSON
- EVG Runtime 扩展快照（`extensions/com.notarium.evg-runtime/extension.json`）
  缺失 / id 不符 / JSON 损坏时给 warning 级 issue（不拦截打开，issue.code
  前缀 `warning-`，valid 判定不计入）
- `project.variables.json` 缺失同样给 warning 级 issue（该文件由引擎在
  用户设置变量时创建）
- `project.json` 必须能解析为对象
- `project.json` 的 `id` 和 `name` 必须是非空字符串
- 重新打开历史项目时也会重新校核

规则集中在：

```ts
src/main/services/projectStructure.ts
```

修改频率较高的地方：

- 必需目录：`REQUIRED_PROJECT_DIRECTORIES`
- 必需根 JSON：`REQUIRED_ROOT_JSON_FILES`
- 项目清单文件名：`PROJECT_MANIFEST_FILENAME`

### 9.3 校核流程

```text
选择项目 / 打开最近项目
  → ProjectService.loadProjectSummary
  → validateProjectStructure
  → parseProjectSummary
  → 写入项目历史
```

文件职责：

- `projectValidator.ts`：检查目录与 JSON 是否存在、是否可解析
- `projectSummaryParser.ts`：读取 `project.json`，提取 `id`、`name`，生成摘要
- `projectService.ts`：编排校验、解析、历史写入
- `projectHistoryStore.ts`：持久化历史

校验失败时：

- 不写入历史
- 错误消息通过 `IpcResult.error` 返回 renderer
- renderer 在全局错误提示中展示

## 10. 项目数据模型

当前只保存摘要，后续再扩展。

```ts
interface ProjectSummary {
  id: string          // 唯一记录 ID
  projectId: string   // project.json 的 id
  name: string        // project.json 的 name
  folderName: string  // 项目目录名
  path: string        // 项目绝对路径
}

interface ProjectRecord extends ProjectSummary {
  lastOpenedAt: string
}
```

唯一记录 ID 当前由以下内容生成 sha1：

```text
projectId
name
folderName
absolutePath
```

这样可以：

- 区分不同位置的项目副本
- 项目元数据变化后重新生成摘要
- 在历史记录中保持稳定的记录模型

## 11. 项目历史持久化

实现文件：

```text
src/main/services/projectHistoryStore.ts
```

存储位置：

```text
app.getPath('userData')/project-history.json
```

当前行为：

- 最多保留 30 条
- 按 `lastOpenedAt` 排序
- 按 `path` 去重
- 支持移除单条、清空全部
- 文件写入使用临时文件 + rename
- 文件不存在时返回空列表
- JSON 解析失败时返回空列表
- 旧模型、字段缺失的记录会被过滤

历史记录不是工程文件本身，只是项目路径和摘要的本地缓存。

## 12. Renderer 状态设计

实现文件：

```text
src/renderer/src/stores/useAppStore.ts
```

变量与角色属性页面另使用：

```text
src/renderer/src/stores/useVariableEditorStore.ts
```

使用 Zustand，不做 Provider 嵌套。组件通过 selector 订阅需要的 state / action。

### 12.1 State

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `activePage` | `'home' \| 'variables' \| 'conditions' \| 'actions' \| 'events' \| 'locations' \| 'runtime' \| 'settings'` | 当前页面 |
| `theme` | `'light' \| 'dark'` | Fluent 皮肤下的主题 |
| `skin` | `'fluent' \| 'win98'` | 外观皮肤，`win98` 固定浅色 |
| `sidebarCollapsed` | `boolean` | 侧边栏折叠状态 |
| `history` | `ProjectRecord[]` | 最近项目 |
| `currentProject` | `ProjectRecord \| null` | 当前打开项目 |
| `loading` | `boolean` | 异步操作锁与按钮状态 |
| `initialized` | `boolean` | 是否已完成历史加载 |
| `errorMessage` | `string \| null` | 全局错误提示 |

`theme` / `skin` / `sidebarCollapsed` 分别持久化到
`localStorage['evg-editor:theme']` / `['evg-editor:skin']` / `['evg-editor:sidebar-collapsed']`。

### 12.2 Actions

| Action | 说明 |
| --- | --- |
| `setActivePage` | 切换页面 |
| `setTheme` | 设置并持久化主题 |
| `toggleTheme` | 亮暗主题切换 |
| `setSkin` | 设置并持久化外观皮肤 |
| `toggleSidebar` | 折叠 / 展开侧边栏 |
| `initialize` | 首次加载项目历史 |
| `openProject` | 调用目录选择、校核、打开项目 |
| `openRecent` | 通过历史记录重新打开项目 |
| `removeProject` | 移除单条历史 |
| `clearHistory` | 清空历史 |
| `closeProject` | 关闭当前项目，unload 全部数据 store 并返回首页 |
| `refreshProject` | 重新读取项目摘要、变量、角色属性、evg-data、章节与场景 |
| `clearError` | 关闭错误提示 |

### 12.3 selector 与重渲染

典型写法：

```ts
const loading = useAppStore((state) => state.loading)
```

`useAppStore(selector)` 不仅读取 state，还订阅该 selector 的结果。

流程：

```text
action 调用 set(...)
  → store 更新
  → selector 重新执行
  → Object.is 比较新旧结果
  → 变了才触发组件重新渲染
```

因此推荐逐一选择字段，避免返回新对象导致额外重渲染：

```ts
const history = useAppStore((state) => state.history)
const loading = useAppStore((state) => state.loading)
```

如果确实需要一次选择多个字段，可使用 `zustand/react/shallow` 的 `useShallow`，避免对象引用每次都变化。

## 13. 页面与导航

当前页面：

- 首页 `HomePage`
  - 未打开项目时：展示最近项目
  - 打开项目后：展示项目总览与“关闭项目”按钮
  - 打开项目后：展示“Runtime 系统变量”面板，检查各 Runtime 子系统
    （时间 / 物品系统等）所需变量的就绪状态，并提供一键写入
    （见 22.5）
  - 选择项目
  - 清空历史
  - 从历史打开项目
  - 移除单条历史
- 变量与角色属性页 `VariablesPage`
  - 通过页签切换“变量”和“角色属性模板”两个视图
  - 变量页签为主从布局（与条件 / 动作 / 事件页同款骨架）：左列表沿用
    变量卡片样式（整卡可点选，选中态高亮），右栏为编辑表单；卡片首行
    为变量名，第二行为彩色类型小标签（type-tag：数字蓝 / 字符串绿 /
    布尔紫粉，文本色用 color-mix 掺主题文字色保证亮暗可读，win98 覆盖为
    深 98 色板文字 + 同色实线描边 + 白底）+ 默认值；仅 shared 持久化的
    变量在行尾（删除按钮旁）显示“跨存档”徽章
  - 左列表按 kind 分组：kind=project（evg. 前缀标识）（运行时子系统声明，命名 evg.*）单独
    成组置底；只有存在系统变量时才显示分组标题
  - 右栏：VariableEditor 实时编辑器（控件直接绑定草稿，无表单内保存
    按钮；重名 / 空名即时提示为展示性，不阻塞保存）+ 系统变量归属提示
    （内置清单可查到声明系统时展示系统名，动态派生的如 evg.item.* 给
    通用提示）+ 引用位置面板（findVariableRefLocations 扫描条件 / 动作 /
    事件 / 热点内联事件，附注说明）
  - 改名传递性同步：改名会调用 renameVariableReferences（evgReferences，
    与引用扫描同口径）改写 evg-data 草稿中该变量的全部引用——条件树
    操作数、canExecute / guard、SetVariable 目标与值操作数、热点内联
    事件；被改写的 evg-data 草稿置脏并纳入本页保存 / 取消修改；名字
    被清空的中间态不改写（源名取 lastNameRef）；引擎剧本内的变量引用
    不在同步范围
  - 系统变量（kind=project（evg. 前缀标识））在页面内只读：VariableEditor 的 readOnly
    禁用名字 / 类型 / 持久化 / 默认值，行内删除按钮隐藏；维护走主页的
    系统变量同步
  - 草稿模式（与条件页一致）：所有增删改只改内存草稿并置脏——
    useVariableEditorStore 的 dirtyVariables / dirtyAttributes 按文件分开
    记账；页面右上角出现“未保存”提示、「取消修改」（reload 重读文件
    回滚）与「保存」（saveChanged 只写脏的文件）；草稿在页面切换间保留
    （load 同路径跳过）
  - 新建 = 直接创建草稿条目并选中（自动命名 new-variable / new-attribute，
    重复时追加 -2、-3…），无弹窗
  - 删除变量前通过 ReferenceDeleteDialog 展示仍被条件 / 动作使用的位置
    （仅警示，不做级联，文案为草稿口径）；删除当前选中的变量时清空右栏
  - 角色属性模板页签：与变量页签同款主从布局；左列表为拍扁的可点选
    卡片（同款 type-tag 类型标签，属性模板无持久化概念、无跨存档徽章），
    不再有展开按钮；右栏上半为 AttributeEditor 实时编辑器，下方
    “角色初始值”小节平铺每个角色的初始值编辑（未设置的角色跟随模板
    默认值）；同变量页签的草稿模式，updateAttributeType 按 id 定位
    （实时改名过程中名字不可靠），改名时自动迁移角色初始值的键名
  - 两个页签的内容区高度固定，只有内部列表容器滚动
- 条件页 `ConditionsPage`
  - 以列表展示 evg-data 中 `type=Condition` 的行
  - 支持新增、删除、修改条件定义
  - 通过 ConditionEditor 递归编辑比较 / 逻辑 / 常量节点
  - 操作数支持字面量 / 变量 / 扩展方法三种来源（扩展方法见 22.7）
  - 使用本地草稿，点击保存后写回 evg-data；右上角动作组为共享的
    DraftHeaderActions（“未保存”提示 +「取消修改」+「保存」），条件 /
    动作 / 事件 / 地点 / 运行数据配置 / 变量与角色属性页共用——
    「取消修改」重读文件回滚草稿（页面级），无未保存修改时不渲染
  - 删除时展示引用位置，支持保留引用或级联清理两种模式
  - key 编辑提供为空 / 重复的即时提示
- 动作页 `ActionsPage`
  - 以列表展示 evg-data 中 `type=Action` 的行
  - 支持新增、删除、修改动作定义
  - 选中“扩展方法”类型后，类型行下方显示“内置方法”快捷条（灰色
    非交互说明字 + 竖线分隔）：自带方法（移动地点 / 推进时间 /
    获得物品 / 移除物品）一键预填，数据上仍是 CallExtensionMethod
    （按 runtimeMethods 清单生成缺省 args）；通用入口保留给其它扩展
  - SetVariable 的值支持字面量 / 变量 / 扩展方法返回值（复用
    ConditionOperandEditor；已登记方法未声明 returns 时编辑器提示
    “运行时将跳过写入”，运行时对 undefined / 非基础类型结果跳过写入并告警）
  - CallFragment 候选过滤 main 片段（章节入口），选项常显所属章节，
    片段缺失 / 指向 main 时给警告
  - 通过 ActionEditor 按 action purpose 分发到对应的数据编辑器
  - CallExtensionMethod 数据编辑走 ExtensionMethodEditor（内置方法清单，见 22.7）
  - guard 复用 ConditionBindingEditor
  - 组件层已准备 ActionBindingEditor / ActionEditorDialog / ActionRefPickerDialog，供后续事件页处理内联和引用动作
  - 删除时展示引用位置，支持保留引用或级联清理两种模式
  - key 编辑提供为空 / 重复的即时提示
- 事件页 `EventsPage`
  - 以列表展示 evg-data 中 `type=Event` 的行
  - 支持新增、删除、修改事件定义，并保持 row.key === data.id
  - 通过 EventEditor 编辑 label、canExecute 和有序 actions 列表；
    动作卡片头部带排序把手（拖拽 + 插入指示线，拖拽中不提交松手落位，
    与运行配置时段行同款交互）与上移 / 下移快捷按钮，行首序号实时显示
    执行顺序——执行顺序即数组顺序，契约不做 order 包装
  - 每个 effect 通过 ActionBindingEditor 选择内联或引用
  - EventEditorDialog 已准备好，供后续地点热点编辑弹窗复用
  - 删除时展示热点引用位置，支持保留引用或级联解绑两种模式
  - key 编辑提供为空 / 重复的即时提示
- 地点页 `LocationsPage`（chapter 即 location）
  - 按章节维护 evg-data 中 `type=LocationMap` 的行；**存在该行即注册为地点**，
    hotspots 为空表示无交互点的地点
  - 章节顺序优先参考 project.json 的 chapterTreeOrder / chapterOrder
  - 默认不注册地点；选中章节后必须显式点击“设为地点”才创建 LocationMap
  - 地点属性：显示名 label（导航 / 移动提示用，缺省回退章节名）与
    disabled 开关（禁用的地点不可移动、不执行调度，可用于 demo 导出）
  - 只有创建/已存在 LocationMap 后，才读取 scenes.json 与 assets 预览
  - 支持圆形 / 方框热点放置、拖动、尺寸编辑和事件绑定
  - 热点片段章节静态检查：事件动作链中的 CallFragment 目标章节
    （显式 chapterId ?? 热点所在章节）不存在或不含该片段时，在热点
    属性面板给警告（`collectHotspotFragmentIssues`，只读不阻塞）
  - 调度挂接检查（只读）：解析 `schedule:read` 读到的 project.json
    调度蓝图（`shared/schedule.ts`，从 start 沿 next 边可达的 extension
    节点为有效调度节点），地点章节不在有效节点 chapterIds 并集、或
    找不到有效调度节点时，页面顶部显示警示条 + 刷新按钮；**不写回
    蓝图**，章节加入调度由编辑者在 Studio 侧完成
  - 预览可叠加「Overlay 安全区」参考线（工具栏开关）：按 Common.md §9.3
    的常驻区契约（左上 384×112 时间卡 + 底部 72px 常驻栏）提示热点避让
    runtime 地点层常驻元素；尺寸与 runtime `OVERLAY_SAFE_AREAS` 镜像
  - 场景预览支持右键菜单：空白处插入圆形 / 方框热点，热点上删除热点
  - 章节列表支持右键菜单：设为地点 / 编辑 / 移除地点，移除使用 EditorDialog 确认
  - 尺寸编辑框按 project.json.resolution 显示 px，保存时换算为归一化坐标
  - 支持扩大模式：占满窗口，只保留场景预览和右侧热点列表 / 属性
  - 一个章节一条记录，row.key === data.chapterId
  - 已注册地点在列表中显示标记和热点数量
- 运行数据配置页 `RuntimeConfigPage`
  - 维护 Runtime 子系统的运行设置，整体作为一条 evg-data 行落盘
    （type=1000、key=runtime-config，见 22.6）
  - 页签驱动：时间 / 物品 / 地点，后续子系统在 CONFIG_TABS 追加页签
  - 没有配置条目时提供“创建默认配置”；编辑后走统一的 evg-data 保存路径
  - 结构校验（时段非空且 id 唯一、calendar 必须有起始日期、物品 id 唯一等）
    由主进程写入校验兜底，非法结构保存时会报错提示
- 全局工具栏 `GlobalToolbar`
  - 仅在打开项目后显示
  - 提供刷新按钮，重新读取项目摘要、变量与角色属性
- 设置页 `SettingsPage`
  - 默认主题字段
  - 技术栈信息
  - 历史记录位置说明
  - 凭据安全说明

页面切换由 `App.tsx` 根据 `activePage` 条件渲染，当前未引入 React Router。

侧边栏支持折叠 / 展开：

```ts
sidebarCollapsed: boolean
localStorage['evg-editor:sidebar-collapsed']
```

折叠后只保留图标按钮，隐藏文案、设置下方的项目信息框；展开后恢复完整导航。

## 14. 主题与外观系统

外观和主题状态都由 Zustand 管理：

```ts
skin: 'fluent' | 'win98'
theme: 'light' | 'dark'
```

- `skin`：整体视觉皮肤，当前提供 `win98`（Windows 98，默认）和 `fluent`（Fluent 扁平）。
- `theme`：Fluent 皮肤下的亮 / 暗主题；Windows 98 皮肤固定使用浅色配色。

持久化：

```ts
localStorage['evg-editor:skin']
localStorage['evg-editor:theme']
```

应用方式：

```ts
document.documentElement.dataset.skin = skin
document.documentElement.dataset.theme = theme
document.documentElement.style.colorScheme =
  skin === 'win98' ? 'light' : theme
```

CSS 中：

- `:root` 定义 Fluent 暗色变量
- `:root[data-theme='light']` 覆盖 Fluent 亮色变量
- `:root[data-skin='win98']` 覆盖 Windows 98 皮肤变量和一部分结构样式
- Windows 98 皮肤使用灰色矩形、深蓝色强调色、直角边框和 3D 高光/阴影边

所有 UI 颜色尽量通过 CSS 变量引用，包括：

- 背景、表面、悬浮表面
- 边框、文字、弱化文字
- 强调色、危险色、警告色
- 滚动条、焦点轮廓

`main.tsx` 在 React 挂载前先应用初始主题，避免启动时闪烁。

## 15. UI 设计规范

当前整体方向是：

- 扁平化 Fluent Design
- 方正控件
- 小圆角
- 无多层阴影
- 无顶部强光源
- 卡片 hover 使用高亮边缘
- 按下时轻微倾斜反馈

页面布局约定：

- 页头（page-hero）保持紧凑：小标题字号、小间距，不占用过多纵向空间；
- 页头以外的编辑区占满页面剩余高度（`flex: 1` + `min-height: 0`），
  溢出在编辑区内部滚动（`overflow-y: auto`），页面本身不整体滚动；
  例外：设置页保留整页滚动；
- 新增页面时沿用该模式（参考 conditions-layout / runtime-config-layout）；
- 主从两列编辑模板：master-detail-layout + master-detail-list-panel /
  master-detail-editor-panel / master-detail-list（变量与角色属性页、
  运行数据配置的物品清单共用）；列表卡片用 data-item--selectable，
  行内删除按钮遵循上方悬停显隐约定；
- 删除按钮显隐按视觉密度区分：主列表（变量 / 条件 / 动作 / 事件等
  一列重复的行）的行级删除按钮默认隐藏，悬停或键盘聚焦到行时显示
  （`:focus-within` 保键盘可达，避免整列红色按钮的视觉噪音）；
  内联编辑卡片（如事件编辑器的动作小卡）面积大、不重复，删除按钮
  保持常显。

关键约定：

- `--radius-sm: 2px`
- `--radius-md: 4px`
- `--radius-lg: 4px`
- 禁止重新引入大面积 `box-shadow` 和 `backdrop-filter`
- 卡片悬浮反馈优先使用 `border-color` 变化
- 按下倾斜只在交互控件上使用
- 支持 `prefers-reduced-motion`
- 主题切换使用 CSS 变量，不在组件中硬编码颜色

## 16. 数据与解析器分离约定

项目校核相关的代码遵守“数据模型 / 规则 / 解析器 / 编排”分离：

| 文件 | 类型 |
| --- | --- |
| `src/shared/project.ts` | 数据模型 |
| `src/main/services/projectStructure.ts` | 规则常量 |
| `src/main/services/projectValidator.ts` | 校验器 |
| `src/main/services/projectSummaryParser.ts` | 解析器 |
| `src/main/services/projectService.ts` | 业务编排 |

后续新增工程文件格式时，优先沿用这个分层，不要把读取、解析和业务逻辑混在一个文件里。

## 17. 后续扩展入口

### 17.1 真实文件树

建议新增：

- `main/services/projectFileService.ts`
- 受控 IPC API：`window.api.projectFiles`
- 限制只能读取当前项目目录内的文件

### 17.2 打开 / 编辑 / 保存文件

建议：

- 模型与解析器分开
- 保存前校验路径不能越出项目根目录
- 使用原子写入或临时文件 + rename
- 错误通过 `IpcResult` 返回

### 17.3 编辑器内核

候选：

- Monaco Editor
- CodeMirror

应在具体的编辑页面内引入，不要把编辑器实例直接放进 Zustand store。

### 17.4 项目状态恢复

后续可在 `userData` 中记录：

- 最近打开文件
- 光标位置
- 页面状态

但不要与项目文件本身混在一起。

## 18. 项目数据表解析与写入

### 18.1 目标文件

项目数据定义文件：

```text
databases/project-data.database.json
```

该文件的 `collections` 中，`name` 为 `evg-data` 的 collection 是编辑器需要的数据表模板。

实际数据表文件固定为：

```text
databases/project-data--evdata.collection.json
```

`evdata` 是生成器固定的 collection id，不再需要根据 `local-<str>` 动态推导文件名。

这是当前项目编辑中唯一需要写入的文件。

### 18.2 evg-data 校验规则

针对 `name === 'evg-data'` 的 collection：

- `project-data.database.json` 根对象的 `id` 必须为 `project-data`
- collection 的 `id` 必须为 `evdata`
- `schema.columns` 必须恰好有 3 列
- 三列的 `key` 必须分别为 `key`、`type` 和 `data`
- `key` 列类型必须是 `text`
- `type` 列类型必须是 `number`
- `data` 列类型必须是 `long-text`
- `label` 不再参与字段名判断，可以是“键 / 类型 / 数据”等展示文本
- 必须存在固定文件 `databases/project-data--evdata.collection.json`

校验通过后，解析出的 descriptor 包含：

```ts
interface EvgDataTableDescriptor {
  projectPath: string
  databaseDefinitionPath: string
  databaseId: string
  collectionId: string
  collectionName: 'evg-data'
  collectionFilePath: string
  keyColumnKey: string
  typeColumnKey: string
  dataColumnKey: string
}
```

其中：

- `keyColumnKey` 固定为 `key`
- `typeColumnKey` 固定为 `type`
- `dataColumnKey` 固定为 `data`

数据记录直接使用这三个固定字段名，不再依赖 `label`。

### 18.3 数据记录模板

样例记录：

```json
{
  "id": "62516ce2-b318-4120-aff5-942a51e169db",
  "key": "desc1",
  "type": 1,
  "data": "{\"desc\":\"type\"}"
}
```

对应规则：

- `id`：GUID，新增记录使用 `randomUUID()` 生成
- `key`：固定字段名 `key`
- `type`：固定字段名 `type`，内容为 number
- `data`：固定字段名 `data`，内容是 JSON 字符串

模板已经固定，不再根据动态 column key 拼字段名。

### 18.4 JSON 读写校验

`data` 列在文件里是 `long-text`，但业务上按 JSON 使用，所以读写两侧都做校验：

读取 `readEvgDataRecords()`：

- `key` 列必须存在且为字符串
- `type` 列必须存在且为有限 number
- `data` 列必须存在且为字符串
- `data` 字符串必须能通过 `JSON.parse`
- 解析成功后返回：

```ts
interface EvgDataRecord {
  id: string
  key: string
  type: number
  data: unknown
}
```

写入统一入口 `writeEvgDataRecords(table, records)`：

- `id` 必须是非空字符串，且同一次写入中不能重复
- `key` 必须是非空字符串，且同类型行内不能重复（业务 key 的命名空间按行
  `type` 隔离：ConditionRef / ActionRef / EventRef 都在各自 type 的行中解析）
- `type` 必须是有限 number
- `data` 是真正的 JSON 值，不要求调用方自己 `JSON.stringify`
- 写入前通过 `JSON.stringify(data)` 生成 long-text 字符串
- 如果 `data` 无法序列化，例如循环引用或 `undefined`，会抛出错误
- 嵌套对象、数组会被完整保留
- 写入前对 `type=1..4` 的记录执行公共契约结构校验（见 18.5 / 18.6），
  结构不合法的记录会被拒绝落盘

`insertEvgDataRecord(table, input)` 是 `writeEvgDataRecords` 的语法糖：
它先读取当前记录，再用 `randomUUID()` 生成 id，最后仍然走同一个落盘入口。

因此读写过程中不会把嵌套 JSON 当成普通字符串直接写入，也不会把非法 JSON 当成有效记录读出来。

### 18.5 实现文件

| 文件 | 作用 |
| --- | --- |
| `src/shared/database.ts` | 数据库定义、descriptor、原始文档与解析后记录模型 |
| `src/shared/evgDataValidate.ts` | 公共契约的结构校验（零依赖，随契约共享） |
| `src/main/services/projectDatabaseParser.ts` | 解析 `project-data.database.json` 并校验 evg-data |
| `src/main/services/databaseCollectionStore.ts` | 读取 collection 文件、JSON 校验、插入记录、原子写入 |

主要函数：

- `parseEvgDataTable(projectPath)`：解析并返回数据表 descriptor
- `readEvgDataRecords(table)`：读取 records，并把 `data` 解析成 JSON 值
- `writeEvgDataRecords(table, records)`：全量写入 records，是所有写操作的统一入口
- `insertEvgDataRecord(table, input)`：新增记录，内部同样走统一的落盘路径

### 18.6 写入约定

- 对外统一通过 `writeEvgDataRecords()` 写入；`insertEvgDataRecord()` 等新增操作最终复用同一条落盘路径
- 内部唯一负责序列化 documents 和写文件的是 `commitEvgDataRecords()`，只有它会调用 `writeCollectionFile()`
- 只写 `.collection.json` 文件
- 不修改 `project-data.database.json`
- 保留 collection 文件原有顶层字段；同 id 记录会保留除 `key/type/data` 外的未知字段
- 使用临时文件 + rename 写入
- 新增记录 id 使用 `crypto.randomUUID()`，输出标准 GUID 格式
- 对外 API 使用解析后的 JSON `data`，落盘时才序列化为字符串
- 新增额外的 update / delete / import 操作时，先 `readEvgDataRecords()`，修改数组后再 `writeEvgDataRecords()`，不要直接拼 documents

### 18.6 写入约定

- 对外统一通过 `writeEvgDataRecords()` 写入；`insertEvgDataRecord()` 等新增操作最终复用同一条落盘路径
- 内部唯一负责序列化 documents 和写文件的是 `commitEvgDataRecords()`，只有它会调用 `writeCollectionFile()`
- 只写 `.collection.json` 文件
- 不修改 `project-data.database.json`
- 保留 collection 文件原有顶层字段；同 id 记录会保留除 `key/type/data` 外的未知字段
- 使用临时文件 + rename 写入
- 新增记录 id 使用 `crypto.randomUUID()`，输出标准 GUID 格式
- 对外 API 使用解析后的 JSON `data`，落盘时才序列化为字符串
- 新增额外的 update / delete / import 操作时，先 `readEvgDataRecords()`，修改数组后再 `writeEvgDataRecords()`，不要直接拼 documents
- 写入是“严格”的：`assertWritableRecords` 会做 id / key / type 基础校验、
  按 type 分组的 key 查重，以及 `findEvgDataRecordContractIssue` 契约结构校验
- 读取是“宽容”的：`readEvgDataRecords()` 只做基础列校验，不做契约结构校验，
  避免旧数据或外部工具产生的记录导致项目打不开
- 契约校验只关注“结构合法”，不关注“业务完整”：例如 SetVariable 的
  `variable` 允许暂时为空字符串（先建后填），扩展 purpose（>=1000）的
  data 形状由扩展自行定义，不做校验

### 18.7 接入状态

evg-data 读写已经通过 `evg-data:read` / `evg-data:write` IPC 接入 renderer 的
`useEvgDataStore`，条件页、动作页、事件页和地点页都基于同一个
store 编辑并全量写回。章节摘要（`chapters:read`）、场景摘要（`scenes:read`）
和资源预览（`assets:read`）也已接入，供 CallFragment 动作和地点页使用。

## 19. 删除保护与引用清理

删除条件 / 动作 / 事件（以及删除变量时的警示）由 renderer 侧的
`src/renderer/src/lib/evgReferences.ts` 与通用组件
`src/renderer/src/components/data/ReferenceDeleteDialog.tsx` 实现。

### 19.1 引用扫描

| 函数 | 找什么 |
| --- | --- |
| `findConditionRefLocations(records, key)` | Event.canExecute、Action.guard、事件 / 热点内联动作 guard，以及条件树 and / or / not 中嵌套的 ConditionRef |
| `findActionRefLocations(records, key)` | Event.actions 与热点内联事件 actions 中指向该动作的 ActionRef |
| `findEventRefLocations(records, key)` | LocationMap 热点上指向该事件的 EventRef |
| `findVariableRefLocations(records, name)` | 条件谓词操作数与 SetVariable data 中使用的项目变量（只警示，不级联） |

扫描返回 `EvgReferenceLocation { recordId, target, location }`，
`target` 是引用方展示名（如 `事件 event-1`、`章节 ch-1 · 热点「开门」`），
`location` 是引用位置描述（如 `执行条件 canExecute`、`动作列表第 2 项`）。

### 19.2 两种删除模式

`ReferenceDeleteDialog` 在存在引用时展示全部引用位置，并提供两种处理模式：

- **保留引用并删除**（`keep`）：引用位置原样保留，成为悬空引用，
  运行时按引用未命中处理；
- **级联清理引用并删除**（`cascade`）：先从所有引用位置移除该引用再删除：
  - 条件：引用它的 `canExecute` / `guard` 还原为 `true`；条件树中删除对应
    分支，被清空的 and / or / not 节点一并移除；
  - 动作：从引用它的 actions 列表中移除对应项；
  - 事件：解绑引用它的热点（热点保留，`event` 字段置空）。

变量没有明确的级联语义，删除变量时只展示引用警示（`cascadeEnabled={false}`）。
所有清理只作用于内存中的未保存记录，需要点击“保存”才写回项目文件；
级联实现见 `removeConditionReferences` / `removeActionReferences` /
`removeEventReferences`，它们对非法结构保持宽容（原样保留，不抛错）。

### 19.3 业务 key 的编辑提示

条件页 / 动作页 / 事件页在编辑 key 时会即时提示两种会被主进程拒绝的情况：

- key 为空；
- 同类型记录中存在相同 key（`countSameTypeKey` 按 `type` 分组计数）。

## 20. 章节摘要解析

### 20.1 目标

扫描项目 `chapters/` 目录下的所有 `.json` 文件，并为每个文件生成一个章节摘要。

文件名不参与摘要生成，也不记录在摘要模型中；文件内容必须是一个 chapter 对象。

### 20.2 摘要模型

```ts
interface ChapterFragmentSummary {
  id: string
  name: string
}

interface ChapterSummary {
  id: string
  name: string
  sceneId: string
  fragments: ChapterFragmentSummary[]
}
```

字段要求：

- chapter 对象必须有非空字符串 `id`
- chapter 对象必须有非空字符串 `name`
- chapter 对象必须有 `fragments` 数组
- 每个 fragment 必须有非空字符串 `id`
- 每个 fragment 必须有非空字符串 `name`
- 必须存在 `name === "main"` 的 fragment
- main fragment 的 `blocks[0]` 必须是 `type === "scene"`
- 该 scene block 的 `props.sceneId` 必须是非空字符串，并写入 `ChapterSummary.sceneId`

`fragments` 中的 `blocks` 其余内容不进入摘要，只额外解析 main fragment 第一个 scene block 的 `sceneId`。

### 20.3 实现文件

| 文件 | 作用 |
| --- | --- |
| `src/shared/chapter.ts` | 章节摘要数据模型 |
| `src/main/services/projectChapterParser.ts` | 扫描 chapters 目录并解析章节摘要 |

主要函数：

```ts
parseChapterSummaries(projectPath: string): Promise<ChapterSummary[]>
```

行为：

- 读取 `chapters/` 下所有 `.json` 文件
- 读取 `project.json` 的 `chapterTreeOrder` / `chapterOrder` 进行排序
- 排序优先级：`chapterTreeOrder` 中的 chapter id -> `chapterOrder` 中的章节名 -> 文件顺序
- 任一文件不是合法 JSON，或缺少必填字段，则整体解析失败并返回错误
- 不关心文件名与章节名是否一致

### 20.4 当前状态

章节摘要的 fragment 带 `isMain` 标记（name === 'main' 的章节入口片段），
片段调用候选会过滤它。

章节摘要已经接入 `chapters:read` IPC，供 CallFragment 动作和地点页使用；地点页会根据 `ChapterSummary.sceneId` 定位 `scenes.json` 中的场景。

## 21. EVG Data 公共契约

EVG 编辑器与运行时共享 EventType / ActionType / ConditionType / LocationMap 的结构定义，文件位于：

```text
src/shared/evgData.ts
```

该文件必须保持零依赖，可以整体复制到 evg-runtime，例如：

```text
evg-runtime/sdk/types/evg-data.ts
```

同步由工作目录根部的本地脚本完成，脚本不进入 evg-editor 发布内容：

```bash
python sync_evg_data.py          # 把契约同步到 evg-runtime
python sync_evg_data.py --check  # 检查两边是否一致
```

同步时会同时检查 `evg-runtime/sdk/types/index.ts`，必要时补上：

```ts
export * from "./evg-data";
```

### 21.1 数据表映射

evg-data 的 `type` 列用于区分行内容：

| type | 含义 | data 结构 |
| --- | --- | --- |
| 1 | Event | `EventType` |
| 2 | Action | `ActionType` |
| 3 | Condition | `ConditionType` |
| 4 | LocationMap | `LocationMap` |

行的 `key` 是业务唯一 id；EventType / ActionType 的 `id` 必须等于行 key，行的 `id` 是数据库内部 GUID。ConditionType 是纯条件树，没有独立 id，行 key 即其 id。LocationMap 的 `chapterId` 必须等于行 key。

### 21.2 关键约定

- `EventType`：`id`、`label`、`canExecute`、`actions`。
- `ActionType`：`id`、`label`、`guard`、`type`、`data`。
- `ConditionType`：谓词节点（原子判定） `predicate` 加 `and` / `or` / `not` / `constant`。
- `actions` 按数组顺序执行，支持内联 `ActionType` 或字符串 `ActionRef`；fragment 调用是普通的 `CallFragment` Effect，不再需要独立的 `hasFragment` / `beforeEffects` / `afterEffects`。
- `canExecute` / `guard` 支持内联条件、字符串 `ConditionRef` 或 `true`。
- 谓词判断的 `eq` / `ne` 支持 2 个以上操作数：`eq` 表示全部相等，`ne` 表示两两不相等。三个变量判断相等的示例：

  ```json
  { "kind": "predicate", "operator": "eq", "operands": [a, b, c] }
  ```

- Action purpose 引擎保留 1-999，扩展从 1000 开始；核心枚举先定义 `SetVariable`、`CallFragment`、`CallExtensionMethod`、`CallSystemSlot`。
- `EventBinding = EventType | EventRef`，地点热点既可以内联事件，也可以引用 `type=Event` 的行。
- `LocationMap`：一个章节一行，`hotspots` 数组保存 `SceneHotspot`；形状当前支持 `circle` / `rect`，坐标使用归一化 `[0, 1]`。

### 21.3 权威文档

完整契约以工作目录根部的 `Common.md` 为准。当前已确定的约定：

- `type`：Event=1 / Action=2 / Condition=3 / LocationMap=4。
- 字段命名统一使用 camelCase。
- EventType / ActionType 的 `data.id` 必须等于行 `key`。
- LocationMap 的 `data.chapterId` 必须等于行 `key`。
- Action / Condition 同时支持内联和引用。
- Event 也可以通过 `EventBinding` 支持内联和引用。

## 22. 变量与角色属性模型

变量模板文件：

```text
project.variables.json
```

公共类型：

```text
src/shared/variable.ts
```

主进程读写：

```text
src/main/services/projectVariablesStore.ts
```

### 22.1 数据模型

变量记录的基础字段：

```ts
interface ProjectVariableBase {
  id: string
  name: string
  kind: string
  createdAt: number
  persistence: 'slot' | 'shared'
}
```

变量类型：

| type | 含义 |
| --- | --- |
| `string` | 字符串 |
| `number` | 数字 |
| `bool` | 布尔 |
| `pending` | 尚未确定类型；识别并允许，但不会主动创建 |

`defaultValue` 与变量类型保持一致；`pending` 允许任意默认值。

`persistence` 只有两个值：

- `slot`：当前存档。
- `shared`：跨存档。

### 22.2 创建约定

- 新变量 `id` 使用 UUID v4 / GUID。
- `createdAt` 使用创建瞬间的毫秒时间戳。
- 新建变量默认 `kind = 'project'`。
- 变量名在项目内唯一。

实现工具：

- `createGuid()`：生成 UUID v4 / GUID。
- `getDefaultVariableValue(type)`：按类型生成默认值。
- `createProjectVariable(input)`：创建一条完整的变量记录。

### 22.3 读写接口

- `readProjectVariables(projectPath)`：读取 `variables` 数组。
- `readProjectVariablesFile(projectPath)`：读取完整文件。
- `writeProjectVariables(projectPath, variables)`：全量写回，保留文件顶层字段和 `version`，使用临时文件 + rename 原子写入。
- `insertProjectVariable(projectPath, input)`：读取、创建、写回一条新变量，并检查重名。

变量模型已通过 `variables:read` / `variables:write` 接入编辑器 UI。

### 22.4 角色属性模型

角色属性模板定义在：

```text
characters.json
```

- `attributeTemplate`：属性模板数组。
- `characters[].attributeValues`：某角色对属性模板的显式初始值。
- `attributeValues` 的 key 是 `attributeTemplate[].name`。
- 没有出现的 key 使用对应属性模板的 `defaultValue`。

属性模板结构：

```ts
interface AttributeTypeBase {
  id: string
  name: string
  createdAt: number
}

type AttributeType =
  | (AttributeTypeBase & { type: 'string'; defaultValue: string })
  | (AttributeTypeBase & { type: 'number'; defaultValue: number })
  | (AttributeTypeBase & { type: 'bool'; defaultValue: boolean })
```

约定：

- `id`：UUID v4 / GUID。
- `createdAt`：创建瞬间的毫秒时间戳。
- 类型只有 `string` / `number` / `bool`，没有 `pending`。
- `defaultValue` 必须与类型匹配。
- 属性名在项目内唯一。

公共类型文件：

```text
src/shared/attribute.ts
```

主进程读写：

```text
src/main/services/characterAttributeStore.ts
```

接口：

- `readCharacterAttributeState(projectPath)`：读取属性模板和所有角色的属性值。
- `writeCharacterAttributeState(projectPath, state)`：全量写回属性相关部分，保留 `characters.json` 其它字段。
- `insertAttributeType(projectPath, input)`：新增一个属性模板并写回，已有角色的属性值保持不变。

角色属性模型已通过 `attributes:read` / `attributes:write` 接入编辑器 UI。

### 22.5 Runtime 系统变量清单与主页检查

实现文件：

```text
src/shared/runtimeSystems.ts                    系统变量声明 + 检查/修复纯函数
src/renderer/src/components/home/RuntimeSystemsPanel.tsx 主页面板
```

背景：evg-runtime 会接管时间、物品系统等系统级功能，这些功能需要一组
约定好的项目变量。编辑器在主页展示这些变量的就绪状态并提供一键写入。
与 Runtime 协调的权威约定见 Common.md 第 9 节；调整清单时两处必须同步更新。

- 变量命名约定：`evg.<systemId>.<name>`，与项目自建变量隔离。
- 当前内置清单（草案，随 runtime 设计演进）：时间系统
  `evg.time.day / slot / paused`，物品系统 `evg.inventory.gold`，
  位置系统 `evg.location.current`（存 chapterId，空串 = 未初始化）；
  均为 slot 持久化。物品持有量是动态清单：每物品一个
  `evg.item.<itemId>`（number / 0 / slot），主页检查时从运行数据配置的
  物品清单现算（`buildItemVariableSystemSpec`），与静态清单合并展示。
  天气变量的动态节同理：天气清单非空时生成“天气变量”节声明
  `evg.weather.current`（`buildWeatherVariableSystemSpec`），空清单不显示。
- 扩展空间：`RuntimeSystemSpec` 为开放结构，后续可追加系统槽位、扩展方法、
  evg-data 行等需求字段；将来 runtime 的 extension.json 若声明所需变量，
  在 `RUNTIME_SYSTEM_SPECS` 处与扩展声明合并即可，UI 与写入逻辑不变。
- 检查维度（`diffRuntimeSystem`）：缺失 / 类型不符 / 持久化范围不符；
  按变量名匹配，不检查 kind 与 defaultValue（用户微调默认值是合法的）。
- 写入（`applyRuntimeSystemFix` + `useVariableEditorStore.saveVariables`）：
  - 缺失变量按规范新增，`kind` 为缺省 `project`（`system` 是引擎保留值，
    绝不能写入——否则剧本编辑器无法引用这些变量）；
  - 类型 / 持久化不符的变量对齐到规范值（type / defaultValue / persistence
    以规范为准，保留 id、name、kind、createdAt 与其它未知字段）；
  - 已就绪的变量原样保留；走统一的变量写入路径（项目级写锁 + 原子写入）。
- 主页面板：每个系统一张卡片，逐变量展示规范 / 当前值 / 状态徽章；
  “同步变量”按系统写入，“全部同步”一次处理所有系统；写入前通过
  EditorDialog 展示新增与修正明细，确认后执行。

### 22.6 运行数据配置（evg-data type=1000）

实现文件：

```text
src/shared/runtimeConfig.ts                       配置模型、默认值、结构校验
src/renderer/src/pages/RuntimeConfigPage.tsx      配置页（页签框架）
src/renderer/src/components/runtime/TimeConfigEditor.tsx
src/renderer/src/components/runtime/InventoryConfigEditor.tsx
src/renderer/src/components/runtime/LocationConfigEditor.tsx
src/renderer/src/components/runtime/LocationGraphEditor.tsx
```

时间 / 物品 / 位置系统的设置整理为一个 `RuntimeConfigData` 设置对象，
作为一条 evg-data 行整体落盘：`type=1000`（扩展区间，不占用引擎保留的
1-999）、`key=runtime-config`（固定，一个项目至多一条）。跨端权威约定见
Common.md 第 9.3 节。

- 时间页签：计时模式（elapsed 累计天数 / calendar 真实年月日）、
  calendar 起始日期、星期开关与起始星期（1-7，周一=1）、单日时段列表
  （时段名称用于展示，时段 id 可编辑为语义 id，带为空 / 重复即时提示；
  运行时按 id 引用，修改 id 会使剧本中按旧 id 写的条件失效；
  数组顺序即推进顺序，行首把手支持拖拽排序（插入指示线，
  拖拽中不提交、松手落位；行首序号随排序实时显示）。
- 天气页签：与物品页签同款 master-detail 主从布局；天气条目
  （id / 名称 / 权重），左卡片 meta 显示 id 标签与 roll 概率（权重 ÷
  总权重），0 权重显示“不出现”徽章；空清单 = 项目不使用天气系统
  （不声明 evg.weather.current、时间推进不 roll）。校验：id 非空唯一、
  权重非负、清单非空时总权重大于 0。
- 物品页签：与变量页签同款 master-detail 主从布局（共享
  master-detail-* 类；左卡片 meta 显示等宽 id 与“不可堆叠”徽章，
  选中态按数组下标追踪——id 是可编辑字段，按 id 追踪会在改名打字
  过程中断链）。物品清单（id 默认自动生成、可编辑为语义 id，带重复
  与断链提示；名称、描述、可堆叠、最大堆叠）。剧本里的物品条件按 id 引用
  （持有量变量 `evg.item.<id>` + 引擎原生变量条件 / IfExt 条件分支）；
  持有量不在配置中表达，由 Runtime 维护在每物品变量上（Common.md §9.3）。
- 地点页签：初始地点下拉（候选 = LocationMap 行，
  label 回退章节名）、导航模板（free 简单导航 / graph 连通图导航）、
  地点层主题（location.theme：跟随系统 / 浅色 / 深色——这是项目数据，
  决定玩家看到的 overlay 画面主题；完整 overlay 排版编辑预期以数据
  结构升级形式追加）。
  graph 模式提供 LocationGraphEditor（SVG canvas）：移动模式拖动地点
  方块（拖动中本地预览、松手提交）、连接模式依次点两节点建立有向通路、
  断开模式移除两节点间通路（双向）；节点布局存
  `location.nodePositions`，通路存 `location.connections`。
- 页面沿用 evg-data 编辑页模式：直接编辑 `useEvgDataStore.records` 中的
  配置行，dirty 后点击“保存”全量写回；没有配置条目时提供
  “创建默认配置”（elapsed、2026-01-01、周一起始、四个默认时段、
  空清单、自由导航）。
- 校验：`validateRuntimeConfigData` + 行 key 约束已接入
  `findEvgDataRecordContractIssue`，非法结构（时段为空 / id 重复、
  calendar 缺起始日期、物品 id 重复等）保存时会被主进程拒绝并在页面报错。
- 扩展方式：新增子系统时在 `RuntimeConfigData` 追加字段、
  `validateRuntimeConfigData` 追加校验、页面 `CONFIG_TABS` 追加页签。

### 22.7 扩展方法清单与 extensionMethod 可视化编辑

实现文件：

```text
src/shared/runtimeMethods.ts                              方法清单（move-location / add-item / remove-item）
src/renderer/src/components/evg/ExtensionMethodEditor.tsx 共用编辑器（扩展/方法选择 + 参数表单 + JSON 回退）
src/renderer/src/components/evg/condition/ConditionOperandEditor.tsx 操作数的“扩展方法”段
src/renderer/src/components/evg/condition/conditionTypeInference.ts 返回类型推断
src/renderer/src/components/evg/effect/ActionDataEditor.tsx CallExtensionMethod 动作数据编辑
```

背景：canExecute / guard 这类 fragment 执行之外的判断层，通过
`extensionMethod` 操作数调用扩展方法感知 runtime 状态（Common.md
§4.1 / §9.3）。编辑器以 `RUNTIME_METHOD_SPECS` 为可视化依据：

- 已登记方法（`EVG_RUNTIME_EXTENSION_ID` 下的 `move-location`、
  `add-item`、`remove-item`、`advance-time`）：扩展 / 方法下拉选择，
  参数按清单生成表单；
  `suggest: 'chapterId'` 的参数给章节候选（useChapterStore），
  `suggest: 'itemId'` 的参数给物品候选（useEvgDataStore 的
  runtime-config 行）；候选列表为空时回退文本输入。必填参数缺省
  时给警示提示。
- 返回类型推断（conditionTypeInference）按清单 `returns` 字段通用
  生效；当前登记的方法均为动作型（无返回），机制保留给未来方法。
- 清单未登记的方法：方法 id 手填、参数以 JSON 文本编辑（解析失败
  提示、失焦还原），保存前仅做契约结构校验。
- 切换扩展 / 方法时清空 args；同一方法内编辑会保留清单外字段。
- 维护约定：runtime 侧新增方法时先更新 Common.md §9.3，再回填
  `RUNTIME_METHOD_SPECS`；runtimeMethods.ts 当前不参与 sync 脚本
  （Common.md §9.4）。

## 23. 项目文件写入统一入口

实现文件：

```text
src/main/services/projectFileWriter.ts

**ProjectFileWriter（写入安全）**：白名单制——只有登记过的项目相对路径
可写，每条目独立声明 create 权限（project.variables.json / characters.json /
evg-data collection 均为 `create: false`，编辑器绝不凭空创建引擎的文件）；
附带目录穿越防护与项目级写锁。编辑器自身数据（userData 历史等）走
`writeJsonFileAtomic` 直通，不受白名单约束。行为由 `_tmp/writer-smoke.ts`
冒烟覆盖。
```

核心 API：

- **`ProjectFileWriter`（项目文件写入器）**：白名单制——只有登记过的项目
  相对路径可写，每条目独立声明 create 权限（project.variables.json /
  characters.json / evg-data collection 均为 `create: false`，编辑器绝不
  凭空创建引擎的文件）；拒绝 `..` / 绝对路径 / 反斜杠等非法路径（防目录
  穿越）。新增写入目标时先在此登记白名单条目。**锁约定**：`write()` 自行
  取项目写锁（适合锁外单步写入）；`writeUnlocked()` 不取锁，供服务层
  "锁内 read-modify-write"复用——在 `withProjectWriteLock` 内调用 `write()`
  会因锁队列互相等待而**死锁**（三个 store 服务均处于锁内，必须用
  `writeUnlocked`）。行为由 `_tmp/writer-smoke.ts`（单元）与
  `_tmp/writer-integration-smoke.ts`（完整链路 + 死锁回归）覆盖。
- `writeJsonFileAtomic(filePath, value)`：整个主进程唯一直接执行
  `writeFile + rename` 落盘 JSON 的地方；编辑器自身数据（userData 历史
  等，非用户项目文件）经此直通。
- `withProjectWriteLock(projectPath, task)`：同一个项目路径下的写操作按
  调用顺序串行执行，避免 read-modify-write 互相覆盖。

当前写入链路：

```text
业务 service（变量 / 角色属性 / evg-data）
  -> 校验并构造 next file
  -> withProjectWriteLock(projectPath)
  -> writeJsonFileAtomic(filePath, nextFile)
  -> 临时文件 + rename
```

所有 JSON 文件写入都经过 `writeJsonFileAtomic`，包括：

- `project.variables.json`
- `characters.json`
- `databases/project-data--evdata.collection.json`
- `userData/project-history.json`

项目目录内的写入额外经过项目级写锁；历史记录不属于项目文件，只复用原子写入。

## 24. 文档维护

本文与以下内容保持同步：

- 项目结构校核规则
- 数据模型字段
- IPC 频道和 API
- 主题 / UI 规范
- 安全约定
- 后续扩展设计

当以下内容改变时，需要同步更新 `AGENTS.md`：

- `REQUIRED_PROJECT_DIRECTORIES`
- `REQUIRED_ROOT_JSON_FILES`
- `ProjectSummary` / `ProjectRecord`
- `window.api`
- `theme` 存储 key 或主题机制
- 构建脚本与依赖版本
