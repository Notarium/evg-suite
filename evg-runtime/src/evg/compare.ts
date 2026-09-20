/**
 * IfExt 条件分支的比较逻辑（纯函数，便于测试与将来复用）。
 *
 * 比较按变量值的运行时类型分流；对比值统一以字符串填写，运行时解析为
 * 目标类型，解析失败（或变量缺失）一律视为不满足。
 */

export type ComparisonOperator = "g" | "ge" | "l" | "le" | "eq" | "ne";

function compareNumbers(a: number, b: number, op: ComparisonOperator): boolean {
  switch (op) {
    case "g": return a > b;
    case "ge": return a >= b;
    case "l": return a < b;
    case "le": return a <= b;
    case "eq": return a === b;
    case "ne": return a !== b;
  }
}

function compareBooleans(a: boolean, b: boolean, op: ComparisonOperator): boolean {
  switch (op) {
    case "eq": return a === b;
    case "ne": return a !== b;
    default: return false;
  }
}

function compareStrings(a: string, b: string, op: ComparisonOperator): boolean {
  switch (op) {
    case "g": return a > b;
    case "ge": return a >= b;
    case "l": return a < b;
    case "le": return a <= b;
    case "eq": return a === b;
    case "ne": return a !== b;
  }
}

/** 纯比较入口：按变量值的运行时类型解析 compare 并比较。 */
export function compareValue(
  value: string | number | boolean | null | undefined,
  compare: string,
  op: ComparisonOperator
): boolean {
  if (value === null || value === undefined) return false;

  if (typeof value === "number") {
    const toNum = Number(compare);
    if (Number.isNaN(toNum)) return false;
    return compareNumbers(value, toNum, op);
  }

  if (typeof value === "boolean") {
    if (compare === "true") return compareBooleans(value, true, op);
    if (compare === "false") return compareBooleans(value, false, op);
    return false;
  }

  return compareStrings(value, compare, op);
}
