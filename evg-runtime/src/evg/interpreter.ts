/**
 * EVG Event / Action / Condition 解释器。
 *
 * 服务于「fragment 执行之外」的判断与执行层：调度环节地点热点的
 * canExecute（热点按钮是否显示）/ guard（按下后事件是否执行），以及
 * 事件 actions 的执行。fragment 内部的分支（引擎 If / IfExt 条件分支 /
 * 原生变量条件）由宿主引擎自己完成，不经过这里。
 *
 * extensionMethod 操作数 / CallExtensionMethod 动作通过 methodEvaluators
 * 注入——由 evg/methods.ts 的 buildMethodEvaluators 装配（move-location /
 * add-item / remove-item / advance-time），解释器本身不认识具体方法。
 */

import type { ExtensionContext } from "@avg-studio/sdk";
import type {
  ConditionBinding,
  ConditionExpression,
  ConditionType,
  EvgJsonValue,
  EvgValueOperand,
  EventType,
  ActionType,
} from "./evg-data";
import { EVG_ACTION_PURPOSE } from "./evg-data";
import type { EvgIndexes } from "./evdata";

/** 扩展方法求值器：key = "<extensionId>/<methodId>"。 */
export type ExtensionMethodEvaluator = (
  args: EvgJsonValue | undefined,
) => Promise<EvgJsonValue | undefined>;

export type ExtensionMethodEvaluatorMap = Map<string, ExtensionMethodEvaluator>;

export interface EvgEnv {
  ctx: ExtensionContext;
  indexes: EvgIndexes;
  /** extensionMethod 求值表；未登记的方法回退 undefined + 告警。 */
  methodEvaluators: ExtensionMethodEvaluatorMap;
}

function warn(message: string): void {
  console.warn(`[evg-interpreter] ${message}`);
}

/* ==========================================================================
 * 操作数求值
 * ========================================================================== */

export async function evalOperand(
  operand: EvgValueOperand,
  env: EvgEnv,
): Promise<EvgJsonValue | undefined> {
  if (operand.kind === "literal") return operand.value;

  if (operand.kind === "variable") {
    return env.ctx.variables.get(operand.variable);
  }

  const evaluator = env.methodEvaluators.get(
    `${operand.extensionId}/${operand.methodId}`,
  );
  if (!evaluator) {
    warn(`extensionMethod 未登记，按 undefined 处理: ${operand.extensionId}/${operand.methodId}`);
    return undefined;
  }
  return evaluator(operand.args);
}

/* ==========================================================================
 * 条件求值
 * ========================================================================== */

export async function evalConditionBinding(
  binding: ConditionBinding,
  env: EvgEnv,
): Promise<boolean> {
  if (binding === true) return true;
  if (typeof binding === "string") {
    const referenced = env.indexes.conditions.get(binding);
    if (!referenced) {
      warn(`条件引用断链，按 false 处理: ${binding}`);
      return false;
    }
    return evalConditionExpression(referenced, env, new Set());
  }
  return evalConditionExpression(binding, env, new Set());
}

async function evalConditionExpression(
  expr: ConditionExpression,
  env: EvgEnv,
  visiting: Set<string>,
): Promise<boolean> {
  // 字符串引用在树内继续展开（防环：同一路径上重复引用按 false 截断）。
  if (typeof expr === "string") {
    if (visiting.has(expr)) {
      warn(`条件引用成环，按 false 截断: ${expr}`);
      return false;
    }
    const referenced = env.indexes.conditions.get(expr);
    if (!referenced) {
      warn(`条件引用断链，按 false 处理: ${expr}`);
      return false;
    }
    visiting.add(expr);
    try {
      return await evalConditionExpression(referenced, env, visiting);
    } finally {
      visiting.delete(expr);
    }
  }

  const node = expr as ConditionType;
  switch (node.kind) {
    case "predicate": {
      const values: Array<EvgJsonValue | undefined> = [];
      for (const operand of node.operands) {
        values.push(await evalOperand(operand, env));
      }

      switch (node.operator) {
        case "exists": {
          const only = values[0];
          return only !== undefined && only !== null;
        }
        case "eq":
          return values.every((value) => value !== undefined && value === values[0]);
        case "ne": {
          if (values.some((value) => value === undefined)) return false;
          for (let i = 0; i < values.length; i++) {
            for (let j = i + 1; j < values.length; j++) {
              if (values[i] === values[j]) return false;
            }
          }
          return true;
        }
        case "gt":
        case "gte":
        case "lt":
        case "lte": {
          const [left, right] = values;
          if (typeof left !== typeof right || left === undefined || right === undefined) {
            if (left === undefined || right === undefined) return false;
            warn(`大小比较两侧类型不一致: ${String(left)} / ${String(right)}`);
            return false;
          }
          switch (node.operator) {
            case "gt": return (left as number) > (right as number);
            case "gte": return (left as number) >= (right as number);
            case "lt": return (left as number) < (right as number);
            case "lte": return (left as number) <= (right as number);
          }
          return false;
        }
      }
      return false;
    }

    case "and": {
      for (const child of node.children) {
        if (!(await evalConditionExpression(child, env, visiting))) return false;
      }
      return true;
    }

    case "or": {
      for (const child of node.children) {
        if (await evalConditionExpression(child, env, visiting)) return true;
      }
      return false;
    }

    case "not":
      return !(await evalConditionExpression(node.child, env, visiting));

    case "constant":
      return node.value === true;

    default:
      warn(`未知条件节点: ${JSON.stringify(node)}`);
      return false;
  }
}

/* ==========================================================================
 * 动作执行
 * ========================================================================== */

async function resolveActionBinding(
  binding: EventType["actions"][number],
  env: EvgEnv,
): Promise<ActionType | null> {
  if (typeof binding === "string") {
    const referenced = env.indexes.actions.get(binding);
    if (!referenced) {
      warn(`动作引用断链，跳过: ${binding}`);
      return null;
    }
    return referenced;
  }
  return binding;
}

export async function runAction(effect: ActionType, env: EvgEnv): Promise<void> {
  if (!(await evalConditionBinding(effect.guard, env))) return;

  switch (effect.type) {
    case EVG_ACTION_PURPOSE.SetVariable: {
      const data = effect.data as {
        variable?: unknown;
        value?: unknown;
        op?: unknown;
      };
      if (typeof data?.variable !== "string") {
        warn(`SetVariable 缺少目标变量，跳过: ${effect.id}`);
        return;
      }
      const op =
        data.op === "toggle" || data.op === "add" ? data.op : "assign";

      // toggle：布尔翻转；目标当前值不是布尔时告警跳过（不做隐式转换）。
      if (op === "toggle") {
        const current = env.ctx.variables.get(data.variable);
        if (typeof current !== "boolean") {
          warn(`SetVariable toggle 目标不是布尔（${data.variable}），跳过`);
          return;
        }
        env.ctx.variables.set(data.variable, !current);
        return;
      }

      const value = await evalOperand(data.value as EvgValueOperand, env);
      if (value === undefined || (value !== null && typeof value === "object")) {
        warn(`SetVariable 求值结果不是基础类型（${data.variable}），跳过写入`);
        return;
      }

      // add：数值自增；目标当前值与增量都必须是有限数字，不做边界截断
      //（需要边界的剧情语义用条件分支显式表达）。
      if (op === "add") {
        const current = env.ctx.variables.get(data.variable);
        if (
          typeof current !== "number" ||
          typeof value !== "number" ||
          !Number.isFinite(value)
        ) {
          warn(
            `SetVariable add 需要目标当前值与增量都是数字（${data.variable}），跳过`
          );
          return;
        }
        env.ctx.variables.set(data.variable, current + value);
        return;
      }

      env.ctx.variables.set(data.variable, value);
      return;
    }

    case EVG_ACTION_PURPOSE.CallFragment: {
      const data = effect.data as { fragmentId?: unknown; chapterId?: unknown };
      if (typeof data?.fragmentId !== "string" || data.fragmentId === "") {
        warn(`CallFragment 缺少 fragmentId，跳过: ${effect.id}`);
        return;
      }
      const options =
        typeof data.chapterId === "string" && data.chapterId !== ""
          ? { chapterId: data.chapterId }
          : undefined;
      await env.ctx.flow.callFragment(data.fragmentId, options);
      return;
    }

    case EVG_ACTION_PURPOSE.CallExtensionMethod: {
      const data = effect.data as {
        extensionId?: unknown;
        methodId?: unknown;
        args?: EvgJsonValue;
      };
      if (typeof data?.extensionId !== "string" || typeof data?.methodId !== "string") {
        warn(`CallExtensionMethod 缺少 extensionId/methodId，跳过: ${effect.id}`);
        return;
      }
      const evaluator = env.methodEvaluators.get(
        `${data.extensionId}/${data.methodId}`,
      );
      if (!evaluator) {
        warn(`CallExtensionMethod 未登记，跳过: ${data.extensionId}/${data.methodId}`);
        return;
      }
      await evaluator(data.args);
      return;
    }

    case EVG_ACTION_PURPOSE.CallSystemSlot: {
      const data = effect.data as { slot?: unknown; payload?: unknown };
      if (typeof data?.slot !== "string" || data.slot === "") {
        warn(`CallSystemSlot 缺少 slot，跳过: ${effect.id}`);
        return;
      }
      await env.ctx.system.invoke(data.slot, data.payload);
      return;
    }

    default:
      warn(`未支持的 effect purpose（${String(effect.type)}），跳过: ${effect.id}`);
      return;
  }
}

/* ==========================================================================
 * 事件执行
 * ========================================================================== */

export async function runEvent(event: EventType, env: EvgEnv): Promise<void> {
  if (!(await evalConditionBinding(event.canExecute, env))) return;

  for (const binding of event.actions) {
    const effect = await resolveActionBinding(binding, env);
    if (!effect) continue;
    await runAction(effect, env);
  }
}

/** 解析事件绑定（内联或引用 type=Event 行）并执行；未绑定或断链时跳过。 */
export async function runEventBinding(
  eventBinding: EventType | string | undefined,
  env: EvgEnv,
): Promise<void> {
  if (eventBinding === undefined) return;

  const event =
    typeof eventBinding === "string"
      ? env.indexes.events.get(eventBinding)
      : eventBinding;

  if (!event) {
    warn(`事件引用断链，跳过: ${String(eventBinding)}`);
    return;
  }

  await runEvent(event, env);
}
