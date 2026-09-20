/**
 * 扩展方法求值表装配。
 *
 * 解释器（extensionMethod 操作数 / CallExtensionMethod 动作）不认识具体
 * 方法；这里把 evg-runtime 自己提供的方法注册进去。编辑器侧的清单见
 * evg-editor/src/shared/runtimeMethods.ts，两侧的方法 id 必须一致。
 */

import type { ExtensionContext } from "@avg-studio/sdk";
import { EXTENSION_ID } from "./constants";
import { dispatchController } from "./dispatch";
import type { ExtensionMethodEvaluatorMap } from "./interpreter";
import { addItem, normalizeItemId, removeItem, type StackRule } from "./inventory";
import { loadItemRules } from "./runtime-config";
import {
  advanceGameTime,
  loadTimeSettings,
  rollCurrentWeather,
  TIME_PAUSED_VARIABLE,
} from "./time";

function readArgs(args: unknown): Record<string, unknown> {
  return typeof args === "object" && args !== null && !Array.isArray(args)
    ? (args as Record<string, unknown>)
    : {};
}

/* ==========================================================================
 * 方法实现本体
 *
 * 每个方法只有这一份实现：解释器 / 调度器的求值表与各 Module 的
 * method() 注册（引擎原生方法块）都委托到这里，避免两条执行路径
 * 各写一套逻辑后漂移。引擎方法块一侧有 schema 校验，这里的参数解析
 * 保持宽容（缺省 / 非法值回退缺省行为）。
 * ========================================================================== */

/** 物品堆叠规则：runtime-config 查得到用规则值，查不到按可堆叠 / 999。 */
async function stackRuleFor(
  ctx: ExtensionContext,
  itemId: string,
): Promise<StackRule> {
  const rules = await loadItemRules(ctx.database);
  const rule = rules.get(itemId);
  return rule
    ? { stackable: rule.stackable, maxStack: rule.maxStack }
    : { stackable: true, maxStack: 999 };
}

/** move-location：剧情性移动（不校验连通性，目标合法性由调度器把关）。 */
export async function evaluateMoveLocation(
  ctx: ExtensionContext,
  args: unknown,
): Promise<undefined> {
  const data = readArgs(args);
  const chapterId = typeof data.chapterId === "string" ? data.chapterId : "";
  const chapterName =
    typeof data.chapterName === "string" && data.chapterName !== ""
      ? data.chapterName
      : undefined;
  await dispatchController.storyMove(ctx, chapterId, chapterName);
  return undefined;
}

/** add-item：增加持有量，按物品清单的堆叠规则封顶。 */
export async function evaluateAddItem(
  ctx: ExtensionContext,
  args: unknown,
): Promise<undefined> {
  const data = readArgs(args);
  const ref = typeof data.itemId === "string" ? data.itemId : "";
  const itemId = normalizeItemId(ref);
  const count =
    typeof data.count === "number" && Number.isFinite(data.count)
      ? Math.floor(data.count)
      : 1;
  if (itemId === "") return undefined;
  await addItem(ctx.variables, itemId, count, await stackRuleFor(ctx, itemId));
  return undefined;
}

/** remove-item：扣减持有量，下限 0。 */
export async function evaluateRemoveItem(
  ctx: ExtensionContext,
  args: unknown,
): Promise<undefined> {
  const data = readArgs(args);
  const ref = typeof data.itemId === "string" ? data.itemId : "";
  const itemId = normalizeItemId(ref);
  const count =
    typeof data.count === "number" && Number.isFinite(data.count)
      ? Math.floor(data.count)
      : 1;
  if (itemId === "") return undefined;
  removeItem(ctx.variables, itemId, count);
  return undefined;
}

/** advance-time：按时段顺序推进；evg.time.paused 为 true 时空转。 */
export async function evaluateAdvanceTime(
  ctx: ExtensionContext,
  args: unknown,
): Promise<undefined> {
  const data = readArgs(args);
  const paused = ctx.variables.get<boolean>(TIME_PAUSED_VARIABLE);
  if (paused === true) {
    console.info("[evg-time] 时间已暂停（evg.time.paused），跳过推进");
    return undefined;
  }
  const count =
    typeof data.count === "number" && Number.isFinite(data.count) ? data.count : 1;
  const settings = await loadTimeSettings(ctx.database);
  const result = advanceGameTime(ctx.variables, count, settings);
  if (result) {
    console.info(`[evg-time] 推进 → 第 ${result.day} 天 / ${result.slotId}`);
  }
  return undefined;
}

/** 注册 evg-runtime 自己提供的方法；策略 resolve / 动作执行共用一份。 */
export function buildMethodEvaluators(
  ctx: ExtensionContext,
): ExtensionMethodEvaluatorMap {
  const evaluators: ExtensionMethodEvaluatorMap = new Map();

  evaluators.set(`${EXTENSION_ID}/move-location`, (args) =>
    evaluateMoveLocation(ctx, args),
  );
  evaluators.set(`${EXTENSION_ID}/add-item`, (args) =>
    evaluateAddItem(ctx, args),
  );
  evaluators.set(`${EXTENSION_ID}/remove-item`, (args) =>
    evaluateRemoveItem(ctx, args),
  );
  evaluators.set(`${EXTENSION_ID}/advance-time`, (args) =>
    evaluateAdvanceTime(ctx, args),
  );

  return evaluators;
}
