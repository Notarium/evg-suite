/**
 * 游戏内时间信息的读取与格式化（地点层左上角信息卡用）。
 *
 * 时间变量（evg.time.*）与运行配置（runtime-config 的 time 节）的权威
 * 契约见 Common.md §9.2 / §9.3；这里做宽容解析 + 纯函数格式化，
 * 变量缺失（项目未启用时间系统）时安静降级。
 */

import type { DatabaseAPI, VariablesAPI } from "@avg-studio/sdk";
import {
  EVG_DATA_COLLECTION_ALIAS,
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  WEATHER_VARIABLE,
} from "./constants";
import { loadWeatherTable, safeParse, type RuntimeWeatherEntry } from "./runtime-config";

/** 时间变量名（Common.md §9.2）。 */
export const TIME_DAY_VARIABLE = "evg.time.day";
export const TIME_SLOT_VARIABLE = "evg.time.slot";
export const TIME_PAUSED_VARIABLE = "evg.time.paused";

export interface RuntimeStartDateLite {
  year: number;
  month: number;
  day: number;
}

export interface RuntimeTimeSlotLite {
  id: string;
  label: string;
}

/** 时间运行设置的运行时视图（RuntimeTimeConfig 的宽容投影）。 */
export interface RuntimeTimeSettings {
  /** elapsed 累计天数 / calendar 真实年月日。 */
  mode: "elapsed" | "calendar";
  startDate: RuntimeStartDateLite;
  weekdayEnabled: boolean;
  /** 1-7，周一 = 1。 */
  startWeekday: number;
  slots: RuntimeTimeSlotLite[];
}

export const DEFAULT_TIME_SETTINGS: RuntimeTimeSettings = {
  mode: "elapsed",
  startDate: { year: 2026, month: 1, day: 1 },
  weekdayEnabled: true,
  startWeekday: 1,
  slots: [
    { id: "morning", label: "早上" },
    { id: "afternoon", label: "下午" },
    { id: "evening", label: "晚上" },
    { id: "night", label: "深夜" },
  ],
};

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function parseTimeSettings(docs: Array<Record<string, unknown>>): RuntimeTimeSettings {
  for (const doc of docs) {
    if (doc.type !== RUNTIME_CONFIG_DATA_TYPE || doc.key !== RUNTIME_CONFIG_ROW_KEY) {
      continue;
    }

    const raw = typeof doc.data === "string" ? safeParse(doc.data) : doc.data;
    if (!isRecord(raw) || !isRecord(raw.time)) break;

    const time = raw.time;
    const startDate = isRecord(time.startDate)
      ? {
          year: clampInt(time.startDate.year, 2026, 1, 9999),
          month: clampInt(time.startDate.month, 1, 1, 12),
          day: clampInt(time.startDate.day, 1, 1, 31),
        }
      : DEFAULT_TIME_SETTINGS.startDate;

    const slots = Array.isArray(time.slots)
      ? time.slots
          .filter(isRecord)
          .filter((slot) => typeof slot.id === "string" && slot.id !== "")
          .map((slot) => ({
            id: slot.id as string,
            label: typeof slot.label === "string" && slot.label !== "" ? slot.label : (slot.id as string),
          }))
      : [];

    return {
      mode: time.mode === "calendar" ? "calendar" : "elapsed",
      startDate,
      weekdayEnabled: time.weekdayEnabled !== false,
      startWeekday: clampInt(time.startWeekday, 1, 1, 7),
      slots: slots.length > 0 ? slots : DEFAULT_TIME_SETTINGS.slots,
    };
  }
  return { ...DEFAULT_TIME_SETTINGS };
}

export async function loadTimeSettings(db: DatabaseAPI): Promise<RuntimeTimeSettings> {
  const docs = await db.collection(EVG_DATA_COLLECTION_ALIAS).find();
  return parseTimeSettings(docs as Array<Record<string, unknown>>);
}

/** 时段 id → 展示名；清单里查不到回退 id 本身。 */
export function slotLabel(slotId: string | undefined, settings: RuntimeTimeSettings): string | null {
  if (!slotId) return null;
  return settings.slots.find((slot) => slot.id === slotId)?.label ?? slotId;
}

/** 第 day 天（1 起）对应的星期标签；未启用星期返回 null。 */
export function weekdayLabel(day: number, settings: RuntimeTimeSettings): string | null {
  if (!settings.weekdayEnabled) return null;
  const offset = (settings.startWeekday - 1 + (day - 1)) % 7;
  return `周${WEEKDAY_LABELS[((offset % 7) + 7) % 7]}`;
}

/** calendar 模式下第 day 天的日期（基于起始日期 + day-1）。 */
export function calendarDate(day: number, settings: RuntimeTimeSettings): string {
  const base = Date.UTC(
    settings.startDate.year,
    settings.startDate.month - 1,
    settings.startDate.day,
  );
  const date = new Date(base + (day - 1) * 86_400_000);
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
}

export interface GameTimeText {
  /** 主行：天数（elapsed）或日期（calendar）；时间系统未就绪时为 null。 */
  primary: string | null;
  /** 次行：时段名 + 星期；无可用信息时为 null。 */
  secondary: string | null;
}

/**
 * 时间推进（advance-time 方法的核心运算）。
 *
 * 时段按配置清单的数组顺序循环；跨过当天最后一个时段进入下一天
 * （day + 1、回到第一个时段）。当前 slot 不在清单里（未初始化 / 时段
 * id 被改过）按"位于首时段之前"处理——推进 1 即落到第一个时段，
 * 不额外跳天。推进与计时模式无关：calendar 的日期由展示层从 day 推算。
 *
 * 返回写入后的 { day, slotId }；slots 为空（理论上不会发生，
 * parseTimeSettings 有默认清单）返回 null。
 */
export function advanceGameTime(
  variables: VariablesAPI,
  count: number,
  settings: RuntimeTimeSettings,
): { day: number; slotId: string } | null {
  const slots = settings.slots;
  if (slots.length === 0) return null;

  const step = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
  const day = Math.max(1, Math.floor(day0(variables)));

  const currentSlotId = variables.get<string>(TIME_SLOT_VARIABLE);
  const index = slots.findIndex((slot) => slot.id === currentSlotId);
  const base = index === -1 ? -1 : index;

  const total = base + step;
  const nextDay = day + Math.floor(total / slots.length);
  const nextSlot = slots[total % slots.length];

  variables.set(TIME_DAY_VARIABLE, nextDay);
  variables.set(TIME_SLOT_VARIABLE, nextSlot.id);
  return { day: nextDay, slotId: nextSlot.id };
}

/**
 * 按权重从天气表 roll 一个天气 id；表为空返回 null（未使用天气系统）。
 * 纯函数：随机数由调用方注入（Math.random / 可种子化实现），便于测试。
 */
export function rollWeatherTable(
  table: ReadonlyArray<RuntimeWeatherEntry>,
  random: () => number = Math.random,
): string | null {
  if (table.length === 0) return null;

  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return null;

  let point = random() * total;
  for (const entry of table) {
    point -= entry.weight;
    if (point < 0) return entry.id;
  }
  return table[table.length - 1].id;
}

/**
 * roll 一次天气并写入 evg.weather.current；清单为空（未使用天气系统）
 * 什么都不做。返回写入的天气 id（未使用时 null）。
 */
export async function rollCurrentWeather(
  ctx: { database: DatabaseAPI; variables: VariablesAPI },
  random: () => number = Math.random,
): Promise<string | null> {
  const table = await loadWeatherTable(ctx.database);
  const rolled = rollWeatherTable(table, random);
  if (rolled === null) return null;
  ctx.variables.set(WEATHER_VARIABLE, rolled);
  return rolled;
}

function day0(variables: VariablesAPI): number {
  const value = variables.get<number>(TIME_DAY_VARIABLE);
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

/**
 * 把时间变量与配置合成展示文案。
 * day 缺失（时间系统未启用 / 变量未同步）时返回 null，界面整卡隐藏。
 */
export function formatGameTime(
  day: number | undefined,
  slotId: string | undefined,
  settings: RuntimeTimeSettings | null,
): GameTimeText {
  if (day === undefined || !Number.isFinite(day)) {
    return { primary: null, secondary: null };
  }
  const effective = settings ?? DEFAULT_TIME_SETTINGS;

  const primary =
    effective.mode === "calendar"
      ? calendarDate(day, effective)
      : `第 ${Math.max(1, Math.floor(day))} 天`;

  const parts: string[] = [];
  const slot = slotLabel(slotId, effective);
  if (slot) parts.push(slot);
  const weekday = weekdayLabel(day, effective);
  if (weekday) parts.push(weekday);

  return { primary, secondary: parts.length > 0 ? parts.join(" · ") : null };
}
