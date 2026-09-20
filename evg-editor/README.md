# EVG Editor

Electron + React + TypeScript + Vite + pnpm 桌面应用框架，用于后续实现项目文件编辑能力。

## 当前完成内容

- Electron 主进程 / preload / React 渲染进程分层结构。
- React 19 + TypeScript + Vite + electron-vite + pnpm。
- Zustand 全局状态管理（页面切换、最近项目、当前项目）。
- 多页面壳：首页、变量与角色属性页、设置页。
- 界面采用扁平化 Fluent Design 风格：方正控件、卡片悬停高亮边缘与按下倾斜反馈。
- 支持亮色 / 暗色主题切换，标题栏提供快捷切换按钮，设置页提供默认主题字段，并使用 localStorage 持久化。
- 首页展示最近打开项目历史，支持“选择项目”（仅打开已有目录，不提供新建项目）。
- 打开项目后首页切换为项目总览，并提供“关闭项目”按钮；应用顶部会显示仅在项目打开时可见的全局工具栏，当前包含“刷新”按钮，用于重新读取项目摘要、变量和角色属性。
- 打开项目时校验结构：必需 `assets/`、`chapters/`、`databases/`，以及根目录必需 JSON 文件；详细规则见 `AGENTS.md`。
- 已实现 `databases/project-data.database.json` 中 `evg-data` 表的模板校验，以及固定文件 `project-data--evdata.collection.json` 的 `key` / `type` / `data` 记录读写；`type` 为 number，`data` 会按 JSON 解析和序列化，写入统一走 `writeEvgDataRecords()`。
- 已建立 EVG Data 公共契约 `src/shared/evgData.ts`，定义 EventType / EffectType / ConditionType 及 evg-data 行映射；可通过工作目录根部的 `sync_evg_data.py` 同步到 evg-runtime。
- 已抽象 `project.variables.json` 的变量模型：支持 `string` / `number` / `bool` / `pending`，持久化范围支持 `slot` / `shared`，主进程提供读取、全量写回和新增变量能力。
- 已抽象 `characters.json` 的角色属性模型：`attributeTemplate` 支持 `string` / `number` / `bool`，角色初始值写入对应 `attributeValues`；主进程提供读取、全量写回和新增属性能力。
- 新增“变量与角色属性”页面：变量支持列表、增删改和类型化默认值编辑；角色属性模板支持折叠展开并编辑每个角色的初始值。
- 新增“条件”页面：列表化管理 evg-data 中 type=Condition 的条件定义，支持递归编辑比较 / 逻辑 / 常量条件，并在保存后写回数据库文件。
- 新增“效果”页面：列表化管理 evg-data 中 type=Effect 的效果定义，按 effect purpose 编辑数据，guard 复用条件绑定编辑器；组件层已准备内联 / 引用效果的编辑和选择对话框。
- 新增“事件”页面：列表化管理 evg-data 中 type=Event 的事件定义，编辑 canExecute 条件和有序 effects 列表；EventEditorDialog 可供后续场景热点编辑器复用。
- 新增“场景热点”页面：按章节维护 SceneHotspotMap，读取 scenes.json 与 assets 预览，支持圆形 / 方框热点摆放、尺寸编辑和事件绑定。
- 主进程 JSON 落盘已统一到 `projectFileWriter.ts`：项目写操作串行化，所有 JSON 文件共用同一个原子写入实现。
- 已实现 `chapters/` 目录下章节 JSON 的摘要解析，记录 chapter 的 id、name 以及 fragments 的 id、name。
- 主进程负责目录选择、历史记录持久化与 IPC；历史记录写入 Electron `userData` 目录。
- `.gitignore` 已排除依赖、构建产物、`.env`、私钥和 credential 文件。

- 外观皮肤：设置页可选择 Windows 98（默认）/ Fluent 扁平，皮肤和主题均持久化到 localStorage。

## 命令

```bash
pnpm install
pnpm dev        # 开发
pnpm build      # 构建
pnpm typecheck  # 类型检查
pnpm start      # 预览构建结果
```

## 安全约定

所有 token、私钥、password 等敏感凭据一律不得写入代码或提交到仓库。后续接入第三方服务时，请使用环境变量，并确保相关文件已被 `.gitignore` 排除。

## 目录

```text
src/
  main/        Electron 主进程：窗口、IPC、项目历史持久化
  preload/     contextBridge 安全 API
  renderer/    React 页面与 Zustand store
  shared/      main/renderer 共用的数据模型与 IPC 类型
```
