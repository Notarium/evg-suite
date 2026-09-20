/**
 * evg-data 集合的读取与索引。
 *
 * collection 文档形状 = EvgDataRow { id, key, type, data }；data 在落盘时是
 * JSON 字符串（编辑器写回时 stringify），读取时宽容解析。runtime 不做结构
 * 校验（写入侧已保证），解析失败的行跳过并告警。
 *
 * 索引按业务 key（行 key）组织：
 * - events     type=1   key === data.id
 * - actions    type=2   key === data.id
 * - conditions type=3   行 key 即条件 id
 * - locations  type=4   key === data.chapterId
 */

import type { DatabaseAPI } from "@avg-studio/sdk";
import type {
  ConditionType,
  ActionType,
  EventType,
  LocationMap,
} from "@avg-studio/sdk";
import { EVG_DATA_KIND } from "@avg-studio/sdk";
import { safeParse } from "./runtime-config";

export interface EvgIndexes {
  events: Map<string, EventType>;
  actions: Map<string, ActionType>;
  conditions: Map<string, ConditionType>;
  /** chapterId → LocationMap（含 disabled 行，由调用方自行过滤）。 */
  locations: Map<string, LocationMap>;
}

export function createEmptyIndexes(): EvgIndexes {
  return {
    events: new Map(),
    actions: new Map(),
    conditions: new Map(),
    locations: new Map(),
  };
}

export async function loadEvgIndexes(db: DatabaseAPI): Promise<EvgIndexes> {
  const docs = await db.collection("evdata").find();
  return buildIndexes(docs as Array<Record<string, unknown>>);
}

export function buildIndexes(docs: Array<Record<string, unknown>>): EvgIndexes {
  const indexes = createEmptyIndexes();

  for (const doc of docs) {
    const { key, type } = doc;
    if (typeof key !== "string") continue;

    const data =
      typeof doc.data === "string" ? safeParse(doc.data) : doc.data;
    if (data === undefined || data === null || typeof data !== "object") continue;

    switch (type) {
      case EVG_DATA_KIND.Event:
        indexes.events.set(key, data as EventType);
        break;
      case EVG_DATA_KIND.Action:
        indexes.actions.set(key, data as ActionType);
        break;
      case EVG_DATA_KIND.Condition:
        indexes.conditions.set(key, data as ConditionType);
        break;
      case EVG_DATA_KIND.LocationMap:
        indexes.locations.set(key, data as LocationMap);
        break;
      default:
        // 其它行类型（引擎保留 / runtime-config / 扩展自定义）不建索引。
        break;
    }
  }

  return indexes;
}

/**
 * 启用的地点列表（disabled !== true），按候选章节顺序排序；
 * label 回退章节名，再回退 chapterId。
 */
export interface LocationOption {
  chapterId: string;
  label: string;
}

export function listEnabledLocations(
  indexes: EvgIndexes,
  chapterNames: Map<string, string>,
): LocationOption[] {
  const out: LocationOption[] = [];
  for (const [chapterId, map] of indexes.locations) {
    if (map.disabled === true) continue;
    out.push({
      chapterId,
      label: map.label || chapterNames.get(chapterId) || chapterId,
    });
  }
  out.sort((a, b) => compareByIdOrder(a.chapterId, b.chapterId, chapterNames));
  return out;
}

let chapterOrderHint: ReadonlyArray<string> = [];

/** 让地点排序跟调度候选章节顺序一致；dispatch 每次会话前调用一次。 */
export function setChapterOrderHint(order: ReadonlyArray<string>): void {
  chapterOrderHint = order;
}

function compareByIdOrder(
  a: string,
  b: string,
  chapterNames: Map<string, string>,
): number {
  const ia = chapterOrderHint.indexOf(a);
  const ib = chapterOrderHint.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  const la = chapterNames.get(a) ?? a;
  const lb = chapterNames.get(b) ?? b;
  return la.localeCompare(lb, "zh-Hans-CN");
}

/**
 * 导航可达集合：
 * - free : 除当前外全部启用地点；
 * - graph: 从当前地点沿 connections（有向）BFS，只经过启用地点。
 */
export function reachableLocations(
  currentChapterId: string,
  settings: { movement: "free" | "graph"; connections: Array<{ from: string; to: string }> },
  enabledChapterIds: ReadonlySet<string>,
): Set<string> {
  const out = new Set<string>();
  if (!enabledChapterIds.has(currentChapterId)) return out;

  if (settings.movement === "free") {
    for (const id of enabledChapterIds) {
      if (id !== currentChapterId) out.add(id);
    }
    return out;
  }

  const adjacency = new Map<string, string[]>();
  for (const edge of settings.connections) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  const queue = [currentChapterId];
  const visited = new Set([currentChapterId]);
  while (queue.length > 0) {
    const node = queue.shift() as string;
    for (const next of adjacency.get(node) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      if (!enabledChapterIds.has(next)) continue; // 禁用地点不可达，也不再向外扩散
      out.add(next);
      queue.push(next);
    }
  }
  return out;
}
