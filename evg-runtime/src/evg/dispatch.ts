/**
 * 地点调度控制器 —— scheduleStrategy「调度环节」的实现核心。
 *
 * 职责（Common.md §9.3 调度设计）：
 * - 启用时：校验 / 初始化 evg.location.current → 打开常驻地点层
 *   （热点 + 导航）→ 挂起等待玩家决策；玩家移动后返回章节决策。
 *
 * 玩家自由移动经导航面板发生；剧情性移动（事件动作 / 方法调用里的
 * move-location）校验目标后直接写变量并结束本次等待。
 *
 * 控制器是包级单例：scheduleStrategy 与界面组件分别由宿主实例化，
 * 两者只能通过它共享会话状态；持久状态只落在 ctx.variables。
 * 模块为此提供 createDispatchController 工厂（测试用），默认导出单例。
 */

import type {
  ExtensionContext,
  ScheduleStrategyDecision,
  ScheduleStrategyInput,
} from "@avg-studio/sdk";
import type { SceneHotspot } from "./evg-data";
import {
  CURRENT_LOCATION_VARIABLE,
  EVG_DATA_COLLECTION_ALIAS,
  LOCATION_UI_PATH,
} from "./constants";
import {
  listEnabledLocations,
  loadEvgIndexes,
  reachableLocations,
  setChapterOrderHint,
  type EvgIndexes,
  type LocationOption,
} from "./evdata";
import {
  evalConditionBinding,
  runEventBinding,
  type EvgEnv,
  type ExtensionMethodEvaluatorMap,
} from "./interpreter";
import { loadLocationSettings, type RuntimeLocationSettings } from "./runtime-config";
import { rollCurrentWeather } from "./time";

export interface HotspotView {
  id: string;
  label: string;
  /** 点击是否有效：热点启用 + 绑定了事件 + canExecute 通过。 */
  interactive: boolean;
  /** interactive = false 时的原因（调试展示用）。 */
  reason: "no-event" | "hotspot-disabled" | "can-execute" | null;
  shape: SceneHotspot["shape"];
}

export interface DispatchSnapshot {
  status: "idle" | "active";
  /** 地点层主题偏好（runtime-config 的 location.theme，项目数据）。 */
  overlayTheme: "auto" | "light" | "dark";
  currentChapterId: string;
  currentLabel: string;
  /** 全部启用地点（导航面板数据源；实际可去以 reachable 为准）。 */
  locations: LocationOption[];
  /** 可从当前地点前往的 chapterId 集合。 */
  reachable: ReadonlyArray<string>;
  hotspots: HotspotView[];
  movement: RuntimeLocationSettings["movement"];
}

const IDLE_SNAPSHOT: DispatchSnapshot = {
  status: "idle",
  overlayTheme: "auto",
  currentChapterId: "",
  currentLabel: "",
  locations: [],
  reachable: [],
  hotspots: [],
  movement: "free",
};

function warn(message: string): void {
  console.warn(`[evg-dispatch] ${message}`);
}

export class DispatchController {
  private ctx: ExtensionContext | null = null;
  private env: EvgEnv | null = null;
  private settings: RuntimeLocationSettings | null = null;
  private locations: LocationOption[] = [];
  private chapterNames = new Map<string, string>();
  private hotspotById = new Map<string, SceneHotspot>();
  /** 本轮调度的候选章节集合（SDK 2.0 契约：决策必须来自这里）。 */
  private candidateIds: ReadonlySet<string> = new Set();
  private pending: ((chapterId: string) => void) | null = null;
  private onAbort: (() => void) | null = null;
  private snapshot: DispatchSnapshot = IDLE_SNAPSHOT;
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): DispatchSnapshot => this.snapshot;

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** 当前是否处于「等待玩家决策」状态。 */
  get awaiting(): boolean {
    return this.pending !== null;
  }

  /**
   * scheduleStrategy.resolve 的执行体。
   *
   * @param methodEvaluators 扩展方法求值表（模块装配，见 evg/methods.ts）。
   */
  async run(
    ctx: ExtensionContext,
    input: ScheduleStrategyInput,
    methodEvaluators: ExtensionMethodEvaluatorMap,
  ): Promise<ScheduleStrategyDecision> {
    console.log(`[evg-dispatch]ctx check:${ctx.game.title()}`);
    console.log("[evg-dispatch] dispatch entered")
    // let colll = ctx.database.collection("evdata")
    // console.log(`[evg-dispatch] test data access ${colll}`)
    if (this.pending) {
      warn("上一次调度尚未结束，忽略并发 resolve");
      return { kind: "end", reason: "调度重入" };
    }

    this.ctx = ctx;
    this.chapterNames = new Map(input.chapters.map((c) => [c.id, c.name]));
    setChapterOrderHint(input.chapters.map((c) => c.id));

    // 诊断（临时）：定位 ctx.database.collection 链路问题，问题清楚后移除
    try {
      const col = ctx.database.collection(EVG_DATA_COLLECTION_ALIAS);
      console.info("[evg-debug] collection() 已返回:", typeof col);
      const docs = await col.find();
      console.info("[evg-debug] find() 返回", docs.length, "条");
    } catch (error) {
      console.error("[evg-debug] database 访问失败:", error);
    }

    this.settings = await loadLocationSettings(ctx.database);
    const indexes = await loadEvgIndexes(ctx.database);
    this.env = { ctx, indexes, methodEvaluators };

    // SDK 2.0 调度契约：resolve 返回的 chapterId 必须来自 input.chapters。
    // 地点先与调度候选章节求交集——启用但未挂到调度节点的地点本轮不可达。
    const candidateIds = new Set(input.chapters.map((chapter) => chapter.id));
    this.candidateIds = candidateIds;
    const allEnabled = listEnabledLocations(indexes, this.chapterNames);
    this.locations = allEnabled.filter((location) =>
      candidateIds.has(location.chapterId),
    );
    if (this.locations.length === 0) {
      return {
        kind: "end",
        reason:
          allEnabled.length > 0
            ? "启用的地点都没有挂到调度节点的候选章节中"
            : "没有可用地点（LocationMap 行缺失或全部禁用）",
      };
    }

    const enabledIds = new Set(this.locations.map((location) => location.chapterId));
    const current = this.ensureCurrentLocation(enabledIds);
    if (!current) {
      return { kind: "end", reason: "无法确定初始地点" };
    }

    if (input.activeChapterId === null) {
      // 开局：先进初始地点的章节做场景铺垫，下一轮再进入调度等待。
      // current 已保证在候选列表内（见上方的交集过滤）。
      // 开局即 roll 一次天气，让开场剧本的天气分支立即可用。
      await rollCurrentWeather(ctx);
      return { kind: "chapter", chapterId: current, diagnostics: { location: current } };
    }

    const signal = ctx.flow.signal;
    if (signal.aborted) {
      return { kind: "end", reason: "调度被取消" };
    }

    // 进入触发：到达地点（章节主 fragment 已播完、地点层放置前）按序
    // 尝试执行 onEnter 事件链，每项 canExecute 独立判定；单个触发失败
    // 不中断导航。随后基于触发后的状态刷新快照（热点可用性等）。
    const env = this.env;
    if (env) {
      const enterMap = env.indexes.locations.get(current);
      for (const [index, binding] of (enterMap?.onEnter ?? []).entries()) {
        try {
          await runEventBinding(binding, env);
        } catch (error) {
          warn(`进入触发 #${index + 1} 执行失败，跳过: ${String(error)}`);
        }
      }
    }

    await this.buildSnapshot(current);
    await ctx.ui.show(LOCATION_UI_PATH, {}, { pointerEventsPassthrough: true });

    const decisionPromise = new Promise<string>((resolve) => {
      this.pending = resolve;
    });
    const onAbort = (): void => {
      warn("脚本运行周期被重置，地点层等待中止");
      this.settle(current);
    };
    this.onAbort = onAbort;
    signal.addEventListener("abort", onAbort, { once: true });

    const decision = await decisionPromise;
    signal.removeEventListener("abort", onAbort);
    this.onAbort = null;

    await ctx.ui.hide(LOCATION_UI_PATH);
    this.snapshot = IDLE_SNAPSHOT;
    this.notify();
    return { kind: "chapter", chapterId: decision, diagnostics: { location: decision } };
  }

  /** 校验 / 初始化当前地点；失败（无地点可回退）返回 undefined。 */
  private ensureCurrentLocation(enabledIds: ReadonlySet<string>): string | null {
    const ctx = this.ctx;
    const settings = this.settings;
    if (!ctx || !settings) return null;

    const stored = ctx.variables.get<string>(CURRENT_LOCATION_VARIABLE);
    if (typeof stored === "string" && enabledIds.has(stored)) {
      return stored;
    }

    const fallback =
      settings.initialLocation !== "" && enabledIds.has(settings.initialLocation)
        ? settings.initialLocation
        : this.locations[0]?.chapterId;

    if (!fallback) return null;

    if (stored !== undefined && stored !== "") {
      warn(`当前地点 ${stored} 不可用，回退到 ${fallback}`);
    }
    ctx.variables.set(CURRENT_LOCATION_VARIABLE, fallback);
    return fallback;
  }

  private async buildSnapshot(currentChapterId: string): Promise<void> {
    const env = this.env;
    const settings = this.settings;
    if (!env || !settings) return;

    const enabledIds = new Set(this.locations.map((location) => location.chapterId));
    const reachable = reachableLocations(currentChapterId, settings, enabledIds);
    const reachableOrdered = this.locations
      .map((location) => location.chapterId)
      .filter((chapterId) => reachable.has(chapterId));

    const map = env.indexes.locations.get(currentChapterId);
    this.hotspotById = new Map();
    const hotspots: HotspotView[] = [];

    for (const hotspot of map?.hotspots ?? []) {
      this.hotspotById.set(hotspot.id, hotspot);
      hotspots.push(await this.buildHotspotView(hotspot));
    }

    this.snapshot = {
      status: "active",
      overlayTheme: settings.theme,
      currentChapterId,
      currentLabel:
        map?.label || this.chapterNames.get(currentChapterId) || currentChapterId,
      locations: [...this.locations],
      reachable: reachableOrdered,
      hotspots,
      movement: settings.movement,
    };
    this.notify();
  }

  private async buildHotspotView(hotspot: SceneHotspot): Promise<HotspotView> {
    if (hotspot.enabled === false) {
      return {
        id: hotspot.id,
        label: hotspot.label,
        interactive: false,
        reason: "hotspot-disabled",
        shape: hotspot.shape,
      };
    }
    if (!hotspot.event) {
      return {
        id: hotspot.id,
        label: hotspot.label,
        interactive: false,
        reason: "no-event",
        shape: hotspot.shape,
      };
    }
    if (!this.env) {
      return {
        id: hotspot.id,
        label: hotspot.label,
        interactive: false,
        reason: null,
        shape: hotspot.shape,
      };
    }

    const event =
      typeof hotspot.event === "string"
        ? this.env.indexes.events.get(hotspot.event)
        : hotspot.event;

    // 事件缺失 / canExecute 未通过 → 不显示为可交互（guard 在点击时再查一次）。
    if (!event) {
      return {
        id: hotspot.id,
        label: hotspot.label,
        interactive: false,
        reason: "no-event",
        shape: hotspot.shape,
      };
    }

    const canExecute = await evalConditionBinding(event.canExecute, this.env);
    return {
      id: hotspot.id,
      label: hotspot.label,
      interactive: canExecute,
      reason: canExecute ? null : "can-execute",
      shape: hotspot.shape,
    };
  }

  private settle(chapterId: string): void {
    const resolve = this.pending;
    this.pending = null;
    resolve?.(chapterId);
  }

  /**
   * 剧情性移动：move-location 方法与动作解释器的统一入口。
   * 校验目标存在且未禁用（不走连通性——剧情可以强制前往），
   * 写入当前地点变量；若正处于调度等待则直接结束等待并切章。
   */
  async storyMove(
    ctx: ExtensionContext,
    chapterId: string,
    chapterName?: string,
  ): Promise<void> {
    if (!chapterId) {
      warn("move-location 缺少 chapterId，忽略");
      return;
    }

    const map = this.env?.indexes.locations.get(chapterId);
    if (!map || map.disabled === true) {
      warn(`move-location 目标不是可用地点: ${chapterId}`);
      return;
    }

    // 调度等待中的移动会直接作为章节决策返回，落点必须在本轮候选内
    // （SDK 2.0 契约）；非调度期的移动只写变量，由下一轮调度兜底回退。
    if (this.pending && !this.candidateIds.has(chapterId)) {
      warn(
        `move-location 目标 ${chapterId} 不在本轮调度候选章节中，忽略移动`,
      );
      return;
    }

    ctx.variables.set(CURRENT_LOCATION_VARIABLE, chapterId);

    if (this.awaiting) {
      this.settle(chapterId);
    } else {
      // 非调度期调用（如某章节 main fragment 里的剧情移动）：
      // 只写变量，本轮剧本走完后由调度器切过去。
      console.info(
        `[evg-dispatch] 剧情移动 → ${chapterName || map.label || chapterId}`,
      );
    }
  }

  /** 导航面板点选目的地；只放行可达 + 未禁用的地点。 */
  chooseDestination(chapterId: string): void {
    if (!this.pending || this.snapshot.status !== "active") {
      warn("当前不在调度等待中，忽略导航请求");
      return;
    }
    if (!this.snapshot.reachable.includes(chapterId)) {
      warn(`目标地点不可达: ${chapterId}`);
      return;
    }
    this.ctx?.variables.set(CURRENT_LOCATION_VARIABLE, chapterId);
    this.settle(chapterId);
  }

  /** 点击热点：执行绑定事件；事件若发生移动，会直接结束本次等待。 */
  async triggerHotspot(hotspotId: string): Promise<void> {
    if (!this.pending || this.snapshot.status !== "active" || !this.env) {
      warn("当前不在调度等待中，忽略热点请求");
      return;
    }

    const hotspot = this.hotspotById.get(hotspotId);
    const view = this.snapshot.hotspots.find((item) => item.id === hotspotId);
    if (!hotspot || !view || !view.interactive) {
      warn(`热点不可交互: ${hotspotId}`);
      return;
    }

    await runEventBinding(hotspot.event, this.env);

    // 事件可能改了变量 / 持有物 → 未移动时刷新热点可用状态。
    if (this.awaiting) {
      await this.buildSnapshot(this.snapshot.currentChapterId);
    }
  }
}

/** 包级单例：模块（策略 / 方法 / 界面）与界面组件共享的会话状态。 */
export const dispatchController = new DispatchController();
