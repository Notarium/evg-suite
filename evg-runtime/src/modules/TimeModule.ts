/**
 * 时间系统模块。
 *
 * 时间状态 = evg.time.day / slot / paused 三个变量（声明清单见编辑器
 * runtimeSystems.ts，Common.md §9.2），本模块不使用扩展 save。
 *
 * 推进是显式的：剧本用 CallExtensionMethod 动作（或引擎方法块）调用
 * advance-time，按 runtime-config 时间清单的时段顺序推进 count 个时段，
 * 跨天自动进位。没有自动推进——world clock 只在剧本要求时走动；
 * evg.time.paused = true 时按契约暂停推进（advance-time 空转）。
 * 展示（地点层左上时间卡、calendar 日期换算）在 src/evg/time.ts。
 *
 * 实现本体在 src/evg/methods.ts：与 evg-data 的 CallExtensionMethod 动作
 * （解释器 / 调度路径）共用一份，这里只声明 schema 并转发。
 */

import { Extension, extension, method } from "@avg-studio/sdk";
import { evaluateAdvanceTime } from "../evg/methods";

@extension({
  id: "time",
  label: "时间系统",
  description: "游戏内时间推进：按运行数据配置的时段顺序推进 day / slot。",
  category: "EVG",
})
export class TimeModule extends Extension {
  static advanceTime = method({
    id: "advance-time",
    title: "推进时间",
    description:
      "按时段顺序推进指定数量的时段；跨过当天最后一个时段进入下一天。" +
      "evg.time.paused 为 true 时不推进。",
    schema: {
      count: {
        type: "number",
        label: "推进的时段数",
        default: 1,
        min: 1,
        step: 1,
        description:
          "决定推进几个时间段（period）；1 = 推进到下一个时段。",
      },
    },
    async run(ctx, params) {
      await evaluateAdvanceTime(ctx, { count: params.count });
    },
  });
}
