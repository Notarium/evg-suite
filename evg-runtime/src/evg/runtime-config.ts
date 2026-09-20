/**
 * runtime-config 行（evg-data type=1000 / key=runtime-config）的运行时读取。
 *
 * 与 Common.md §9.3 对齐。runtime 读取保持宽容：只提取需要的字段，
 * 缺失 / 类型不符时回退默认值，不做结构校验（校验是编辑器写入侧的职责）。
 *
 * 注意：只读 location 小节；时间 / 物品的运行设置由各自模块按需扩展本文件。
 */

import type { DatabaseAPI } from "@avg-studio/sdk";
import {
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  EVG_DATA_COLLECTION_ALIAS,
} from "./constants";

export type RuntimeMovementMode = "free" | "graph";

export interface RuntimeConnection {
  /** 起点地点的 chapterId。 */
  from: string;
  /** 终点地点的 chapterId。 */
  to: string;
}

/** 地点层主题偏好（项目数据，Common.md §9.3）。 */
export type RuntimeOverlayTheme = "auto" | "light" | "dark";

/** 位置调度设置（RuntimeConfigData.location 的运行时视图）。 */
export interface RuntimeLocationSettings {
  /** false = 纯视觉小说模式，不做位置调度。 */
  /** 初始地点 chapterId；空串 = 回退第一个可用地点。 */
  initialLocation: string;
  /** free: 全部启用地点互通；graph: 按 connections 的有向边可达。 */
  movement: RuntimeMovementMode;
  connections: RuntimeConnection[];
  /** 地点层（overlay）主题；缺省视为 auto（跟随系统深浅色）。 */
  theme: RuntimeOverlayTheme;
}

export const DEFAULT_LOCATION_SETTINGS: RuntimeLocationSettings = {
  initialLocation: "",
  movement: "free",
  connections: [],
  theme: "auto",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function asMovement(value: unknown, fallback: RuntimeMovementMode): RuntimeMovementMode {
  return value === "graph" || value === "free" ? value : fallback;
}

function parseLocationSettings(value: unknown): RuntimeLocationSettings {
  if (!isRecord(value)) return { ...DEFAULT_LOCATION_SETTINGS };

  const connections: RuntimeConnection[] = Array.isArray(value.connections)
    ? value.connections
        .filter(isRecord)
        .filter((item) => typeof item.from === "string" && typeof item.to === "string")
        .map((item) => ({ from: item.from as string, to: item.to as string }))
    : [];

  const theme =
    value.theme === "light" || value.theme === "dark"
      ? value.theme
      : "auto";

  return {
    initialLocation: asString(value.initialLocation, ""),
    movement: asMovement(value.movement, "free"),
    connections,
    theme,
  };
}

/** 从数据库文档里宽容地解析 runtime-config 行；找不到或结构不对回退默认值。 */
export function parseRuntimeLocationSettings(
  docs: Array<Record<string, unknown>>,
): RuntimeLocationSettings {
  for (const doc of docs) {
    if (doc.type !== RUNTIME_CONFIG_DATA_TYPE || doc.key !== RUNTIME_CONFIG_ROW_KEY) {
      continue;
    }

    const raw = typeof doc.data === "string" ? safeParse(doc.data) : doc.data;
    if (!isRecord(raw)) return { ...DEFAULT_LOCATION_SETTINGS };

    return parseLocationSettings(raw.location);
  }
  return { ...DEFAULT_LOCATION_SETTINGS };
}

export async function loadLocationSettings(db: DatabaseAPI): Promise<RuntimeLocationSettings> {
  const docs = await db.collection(EVG_DATA_COLLECTION_ALIAS).find();
  return parseRuntimeLocationSettings(docs as Array<Record<string, unknown>>);
}

export function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/* ==========================================================================
 * 天气清单（roll 表）
 * ========================================================================== */

export interface RuntimeWeatherEntry {
  id: string;
  name: string;
  weight: number;
}

/** 宽容解析天气清单：结构非法 / 权重非正的条目跳过并告警。 */
export function parseWeatherTable(
  docs: Array<Record<string, unknown>>,
): RuntimeWeatherEntry[] {
  const row = docs.find(
    (doc) => doc.type === RUNTIME_CONFIG_DATA_TYPE && doc.key === RUNTIME_CONFIG_ROW_KEY,
  );
  const raw = isRecord(row) && typeof row.data === "string" ? safeParse(row.data) : row?.data;
  const weather = isRecord(raw) ? raw.weather : undefined;
  if (!isRecord(weather) || !Array.isArray(weather.weathers)) return [];

  const out: RuntimeWeatherEntry[] = [];
  for (const [index, raw] of weather.weathers.entries()) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : "";
    const name = typeof raw.name === "string" && raw.name !== "" ? raw.name : id;
    const weight = typeof raw.weight === "number" && Number.isFinite(raw.weight)
      ? Math.max(0, raw.weight)
      : 0;
    if (id === "" || weight <= 0) {
      console.warn(`[evg-runtime] 天气条目 ${index} 缺 id 或权重为 0，跳过`);
      continue;
    }
    out.push({ id, name, weight });
  }
  return out;
}

export async function loadWeatherTable(
  db: DatabaseAPI,
): Promise<RuntimeWeatherEntry[]> {
  const docs = await db.collection(EVG_DATA_COLLECTION_ALIAS).find();
  return parseWeatherTable(docs as Array<Record<string, unknown>>);
}

/* ==========================================================================
 * 物品清单（堆叠规则用）
 * ========================================================================== */

/** RuntimeItemDef 的运行时视图（只要 id 与堆叠规则）。 */
export interface RuntimeItemRuleLite {
  id: string;
  stackable: boolean;
  maxStack: number;
}

export function parseItemRules(
  docs: Array<Record<string, unknown>>,
): Map<string, RuntimeItemRuleLite> {
  const out = new Map<string, RuntimeItemRuleLite>();
  for (const doc of docs) {
    if (doc.type !== RUNTIME_CONFIG_DATA_TYPE || doc.key !== RUNTIME_CONFIG_ROW_KEY) {
      continue;
    }

    const raw = typeof doc.data === "string" ? safeParse(doc.data) : doc.data;
    if (!isRecord(raw) || !isRecord(raw.inventory) || !Array.isArray(raw.inventory.items)) {
      break;
    }

    for (const item of raw.inventory.items) {
      if (!isRecord(item) || typeof item.id !== "string" || item.id === "") continue;
      out.set(item.id, {
        id: item.id,
        stackable: item.stackable !== false,
        maxStack:
          typeof item.maxStack === "number" && Number.isFinite(item.maxStack) && item.maxStack >= 1
            ? Math.floor(item.maxStack)
            : 1,
      });
    }
    break;
  }
  return out;
}

export async function loadItemRules(db: DatabaseAPI): Promise<Map<string, RuntimeItemRuleLite>> {
  const docs = await db.collection(EVG_DATA_COLLECTION_ALIAS).find();
  return parseItemRules(docs as Array<Record<string, unknown>>);
}
