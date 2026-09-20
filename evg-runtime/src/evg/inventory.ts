/**
 * 物品持有状态：每个物品一个 number 变量 `evg.item.<itemId>`（slot 持久化，
 * Common.md §9.3）。变量声明由编辑器从运行数据配置的物品清单同步生成，
 * 运行时与剧本直接按变量读写。
 *
 * 选择变量承载的原因（沿用原 holdings 变量方案的结论）：SDK 的模块 save
 * 只在「方法调用」实例上可用，而物品状态要在动作执行、调度层、界面层与
 * 引擎原生 If / 变量条件之间通用；ctx.variables 是唯一全层可用的持久存储。
 * 相比此前试验过的单一 JSON 明细变量，每物品一个 number 让引擎剧本编辑器
 * 可以原生写物品条件（变量条件 / IfExt），这也是最终采用本方案的原因。
 *
 * 堆叠规则来自 runtime-config 的物品清单：可堆叠按 maxStack 封顶，
 * 不可堆叠恒为 1；add-item / remove-item 方法走规则，剧本用 SetVariable
 * 直写变量是作者的自由（绕过堆叠上限，语义上就是改持有量）。
 *
 * 标量（如金钱）不在此机制内：继续用普通变量（如 evg.inventory.gold）+
 * SetVariable 表达。
 */

import type { VariablesAPI } from "@avg-studio/sdk";
import { ITEM_VARIABLE_PREFIX } from "./constants";

/** add-item / remove-item 的堆叠规则（来自 runtime-config 的物品定义）。 */
export interface StackRule {
  stackable: boolean;
  maxStack: number;
}

export const DEFAULT_STACK_RULE: StackRule = { stackable: true, maxStack: 999 };

/** 物品 id → 持有量变量名。 */
export function itemVariableName(itemId: string): string {
  return `${ITEM_VARIABLE_PREFIX}${itemId}`;
}

/**
 * 归一化物品引用：引擎侧的变量选择器会传完整变量名（evg.item.key），
 * 编辑器侧的物品下拉传物品 id（key）；这里统一剥前缀得到物品 id。
 */
export function normalizeItemId(nameOrId: string): string {
  return nameOrId.startsWith(ITEM_VARIABLE_PREFIX)
    ? nameOrId.slice(ITEM_VARIABLE_PREFIX.length)
    : nameOrId;
}

/** 当前持有量；变量未定义按 0。 */
export function countItem(variables: VariablesAPI, itemId: string): number {
  const value = variables.get<number>(itemVariableName(itemId));
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 增加持有量（按堆叠规则封顶），返回写入后的数量。 */
export function addItem(
  variables: VariablesAPI,
  itemId: string,
  count: number,
  rule: StackRule = DEFAULT_STACK_RULE,
): number {
  if (itemId === "" || count <= 0) return countItem(variables, itemId);

  const cap = rule.stackable ? Math.max(1, Math.floor(rule.maxStack)) : 1;
  const next = Math.min(cap, countItem(variables, itemId) + Math.floor(count));
  variables.set(itemVariableName(itemId), next);
  return next;
}

/** 扣减持有量（下限 0），返回写入后的数量。 */
export function removeItem(
  variables: VariablesAPI,
  itemId: string,
  count: number,
): number {
  if (itemId === "" || count <= 0) return countItem(variables, itemId);

  const next = Math.max(0, countItem(variables, itemId) - Math.floor(count));
  variables.set(itemVariableName(itemId), next);
  return next;
}
