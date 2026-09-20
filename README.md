# uieidorx — EVG Framework

针对 LetsGal Studio 的 SLG 化扩展框架：把章节包装成地点、把
fragment 包装成事件、用项目变量承载运行状态，使 AVG 项目能以
「地点移动 → 热点交互 → 时间推进」的循环运行。

## 组成

| 目录 | 说明 |
| --- | --- |
| `evg-editor/` | Electron 桌面编辑器：打开并编辑 EVG 工程（变量 / 条件 / 动作 / 事件 / 地点 / 运行数据配置） |
| `evg-runtime/` | AVG+ Light Engine 扩展：地点调度、时间 / 天气 / 物品系统、IfExt 条件分支 |
| `playground/` | 示例工程（本地测试用，不入库） |
| `Common.md` | EVG Data 公共契约——编辑器与 runtime 之间的权威文档 |
| `sync_evg_data.py` | 把编辑器的契约实现同步到 runtime 的 sdk 副本 |

## 快速开始

```bash
# 编辑器
cd evg-editor && pnpm install && pnpm dev

# runtime
cd evg-runtime && pnpm install && pnpm build

# 契约改动后同步
python sync_evg_data.py
```

各目录的详细说明见其 `AGENTS.md`（设计与协作约定）与 `README.md`
（使用说明）；跨端数据契约以 `Common.md` 为准。
