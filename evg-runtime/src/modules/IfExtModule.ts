/**
 * 条件分支模块 —— EVG 自己的 If。
 *
 * 引擎自带的 If 面向线性 AVG：一个判断只执行一次，后续复入（SLG 循环里
 * 反复调用的片段、读档回放）会沿用第一次的判断结果。本模块用扩展方法
 * 实现 If/else：每次调用都重新求值，再利用引擎「片段即函数调用」的语义
 * 分别跳转真 / 假分支——分支片段返回后继续执行本调用之后的流程。
 *
 * 比较逻辑见 src/evg/compare.ts。
 */

import { Extension, extension, method } from "@avg-studio/sdk";
import { compareValue } from "../evg/compare";

@extension({
  id: "if-ext",
  label: "条件分支",
  description: "每次调用都重新求值的 If/else：按变量与对比值的比较结果跳转片段。",
  category: "EVG",
})
export class IfExtModule extends Extension {
  static cond = method({
    title: "条件分支",
    id: "cond-jump-custom",
    description:
      "读取变量，与对比值比较；满足时跳 trueFrag，不满足时跳 falseFrag。" +
      "分支片段返回后继续执行本调用之后的流程。",
    schema: {
      variable: { type: "variable", label: "变量" },
      opr: {
        type: "enum",
        label: "操作",
        options: [
          { label: ">", value: "g" },
          { label: ">=", value: "ge" },
          { label: "<", value: "l" },
          { label: "<=", value: "le" },
          { label: "==", value: "eq" },
          { label: "!=", value: "ne" },
        ],
      },
      compare: {
        type: "string",
        label: "对比值",
        description: "按变量的类型解析：数字、布尔值（true/false）或字符串。",
      },
      trueFrag: { type: "fragment", label: "√ 满足条件时跳转", required: false },
      falseFrag: { type: "fragment", label: "× 不满足条件时跳转", required: false },
    },
    async run(ctx, params) {
      const value = ctx.variables.get(params.variable);
      const result = compareValue(value, params.compare, params.opr);

      if (result && params.trueFrag !== undefined) {
        await ctx.flow.callFragment(params.trueFrag);
      } else if (!result && params.falseFrag !== undefined) {
        await ctx.flow.callFragment(params.falseFrag);
      }
    },
  });
}
