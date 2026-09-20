/**
 * 物品系统模块。
 *
 * 持有状态 = 每物品一个 number 变量 `evg.item.<itemId>`（编辑器从物品
 * 清单同步声明，见 Common.md §9.3）。因此本模块不再提供 has-item：
 * - 剧本 fragment 内：引擎原生变量条件（`evg.item.key >= 1`），或
 *   IfExtModule 的条件分支（循环复入场景）；
 * - fragment 外：canExecute / guard 里直接用变量操作数。
 *
 * add-item / remove-item 保留方法形态，负责按物品清单的堆叠规则封顶；
 * 参数类型是变量（type: variable），引擎侧从变量选择器取物品，编辑器侧
 * 的表单填物品 id，运行时按 `evg.item.` 前缀归一，两种写法等价。
 *
 * 实现本体在 src/evg/methods.ts：与 evg-data 的 CallExtensionMethod 动作
 * （解释器 / 调度路径）共用一份，这里只声明 schema 并转发。
 */

import { Extension, extension, method } from "@avg-studio/sdk";
import { evaluateAddItem, evaluateRemoveItem } from "../evg/methods";

@extension({
  id: "inventory",
  label: "物品系统",
  description: "物品持有量的增减方法；堆叠规则来自运行数据配置的物品清单。",
  category: "EVG",
})
export class InventoryModule extends Extension {
  static addItem = method({
    id: "add-item",
    title: "获得物品",
    description: "增加持有量；数量按物品清单的堆叠规则封顶。",
    schema: {
      itemId: { type: "variable", label: "物品（持有量变量）", required: true },
      count: { type: "number", label: "数量", default: 1, min: 1, step: 1 },
    },
    async run(ctx, params) {
      await evaluateAddItem(ctx, { itemId: params.itemId, count: params.count });
    },
  });

  static removeItem = method({
    id: "remove-item",
    title: "移除物品",
    description: "扣减持有量；下限 0。",
    schema: {
      itemId: { type: "variable", label: "物品（持有量变量）", required: true },
      count: { type: "number", label: "数量", default: 1, min: 1, step: 1 },
    },
    async run(ctx, params) {
      await evaluateRemoveItem(ctx, { itemId: params.itemId, count: params.count });
    },
  });
}
