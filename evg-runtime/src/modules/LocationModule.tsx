/**
 * 地点系统模块。
 *
 * - scheduleStrategy「EVG 地点调度」：调度环节的实现（见 evg/dispatch.ts），
 *   Studio 项目设置里把项目根调度节点选到本策略即可启用 SLG 式循环；
 * - move-location 方法：剧情性移动（动作 / 方法调用）；
 * - render：地点层界面（左上时间卡 + 热点 + 底部常驻栏 + 导航弹窗），
 *   调度等待期间由策略经 ctx.ui.show 打开，pointer-events 穿透，
 *   只有热点与常驻控件可点。
 *
 * 视觉按编辑器 Fluent 皮肤对齐，提供浅色 / 深色两套 token
 * （对应编辑器的两套外观）；主题是项目数据——运行数据配置
 * location.theme（auto 跟随系统深浅色）经调度快照进入界面层。
 * 样式全部集中在 token 对象与
 * OVERLAY_SAFE_AREAS（常驻区契约，编辑器热点编辑据此画安全区，
 * Common.md §9.3）。将来开放主题 / 排版编辑时，从设置或界面 JSON
 * 注入同形 token 即可，组件只消费 token，不需要改结构。
 */

import React, { useEffect, useState, useSyncExternalStore } from "react";
import {
  Extension,
  extension,
  method,
  scheduleStrategy,
  useExtensionContext,
  type ExtensionProps,
  type ExtensionRenderData,
  type ExtensionContext,
  type ScheduleStrategyInput,
} from "@avg-studio/sdk";
import { dispatchController, type DispatchSnapshot, type HotspotView } from "../evg/dispatch";
import { buildMethodEvaluators, evaluateMoveLocation } from "../evg/methods";
import { loadWeatherTable, type RuntimeWeatherEntry } from "../evg/runtime-config";
import {
  EVG_DATA_COLLECTION_ALIAS,
  LOCATION_MODULE_ID,
  WEATHER_VARIABLE,
} from "../evg/constants";
import {
  formatGameTime,
  loadTimeSettings,
  type RuntimeTimeSettings,
} from "../evg/time";

@extension({
  id: LOCATION_MODULE_ID,
  label: "地点系统",
  description: "chapter 即地点：调度环节打开地点层，热点交互 + 导航移动。",
  category: "EVG",
})
export class LocationModule extends Extension {
  static moveLocation = method({
    id: "move-location",
    title: "移动地点",
    description:
      "切换当前地点：写入 evg.location.current；调度等待中立即切章，" +
      "否则本轮剧本走完后由调度器切过去。",
    schema: {
      chapterId: { type: "string", label: "目标章节 ID", required: true },
      chapterName: { type: "string", label: "目标章节名（移动提示展示用）" },
    },
    async run(ctx: ExtensionContext, params: { chapterId: string; chapterName: string }) {
      // 实现本体在 evg/methods.ts（与 evg-data 动作路径共用），这里只转发。
      await evaluateMoveLocation(ctx, params);
    },
  });

  static locationDispatch = scheduleStrategy({
    id: "location-dispatch",
    title: "EVG 地点调度",
    description:
      "按运行数据配置的地点设置调度章节：关闭位置调度时按章节顺序推进；" +
      "启用时打开地点层等待玩家移动或触发热点。",
    async resolve(ctx: ExtensionContext, input: ScheduleStrategyInput) {
      return dispatchController.run(ctx, input, buildMethodEvaluators(ctx));
    },
  });

  render(): ExtensionRenderData<ExtensionProps> {
    return {
      component: LocationDispatchLayer,
      props: this.data ?? {},
    };
  }
}

/* ==========================================================================
 * 主题 token 与常驻区契约
 * ========================================================================== */

/** 地点层主题 token。未来开放主题编辑时由设置 / 界面 JSON 注入同形对象。 */
export interface LocationOverlayTheme {
  surface: string;
  surfaceBorder: string;
  surfaceShadow: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  /** accent 之上的文字色（深色主题的 accent 是浅色，需配深字）。 */
  accentText: string;
  accentTint: string;
  pausedColor: string;
  radius: number;
  /** 常驻元素与屏幕边缘的距离（px）。 */
  margin: number;
  /** 底部导航按钮高度（px），安全区契约的一部分。 */
  barHeight: number;
  hotspotBg: string;
  hotspotBorder: string;
  hotspotText: string;
  hotspotBgDisabled: string;
  hotspotBorderDisabled: string;
  hotspotTextDisabled: string;
}

/** 浅色主题：编辑器 Fluent 浅色皮肤同源（surface / #0067b8 accent）。 */
export const LIGHT_OVERLAY_THEME: LocationOverlayTheme = {
  surface: "rgba(255, 255, 255, 0.94)",
  surfaceBorder: "rgba(0, 0, 0, 0.1)",
  surfaceShadow: "0 2px 10px rgba(0, 0, 0, 0.16)",
  textPrimary: "#1b1b1b",
  textSecondary: "#5b6167",
  accent: "#0067b8",
  accentText: "#ffffff",
  accentTint: "rgba(0, 103, 184, 0.1)",
  pausedColor: "#9a6700",
  radius: 6,
  margin: 16,
  barHeight: 40,
  hotspotBg: "rgba(255, 255, 255, 0.88)",
  hotspotBorder: "rgba(0, 0, 0, 0.28)",
  hotspotText: "#1b1b1b",
  hotspotBgDisabled: "rgba(255, 255, 255, 0.55)",
  hotspotBorderDisabled: "rgba(0, 0, 0, 0.12)",
  hotspotTextDisabled: "rgba(27, 27, 27, 0.45)",
};

/** 深色主题：编辑器 Fluent 深色皮肤同源（#2b2b2b surface / #60cdff accent）。 */
export const DARK_OVERLAY_THEME: LocationOverlayTheme = {
  surface: "rgba(43, 43, 43, 0.94)",
  surfaceBorder: "rgba(255, 255, 255, 0.14)",
  surfaceShadow: "0 2px 10px rgba(0, 0, 0, 0.45)",
  textPrimary: "#ffffff",
  textSecondary: "#b9bdc4",
  accent: "#60cdff",
  accentText: "#06283a",
  accentTint: "rgba(96, 205, 255, 0.16)",
  pausedColor: "#ffe08a",
  radius: 6,
  margin: 16,
  barHeight: 40,
  hotspotBg: "rgba(38, 38, 38, 0.82)",
  hotspotBorder: "rgba(255, 255, 255, 0.4)",
  hotspotText: "#ffffff",
  hotspotBgDisabled: "rgba(38, 38, 38, 0.5)",
  hotspotBorderDisabled: "rgba(255, 255, 255, 0.14)",
  hotspotTextDisabled: "rgba(255, 255, 255, 0.45)",
};

/** 兼容旧引用：默认浅色。 */
export const DEFAULT_OVERLAY_THEME = LIGHT_OVERLAY_THEME;

/**
 * 常驻元素占用的屏幕区域（场景参考分辨率下的 px）。
 *
 * 编辑器热点编辑的安全区参考线按这组数字换算（LocationsPage 内有镜像
 * 常量）；契约与数值见 Common.md §9.3「地点层常驻区与热点安全区」。
 * 改这里必须同步 Common.md 与编辑器常量。
 */
export const OVERLAY_SAFE_AREAS = {
  /** 左上时间信息卡：贴边放置，预留 384×112。 */
  topLeft: { x: 0, y: 0, width: 384, height: 112 },
  /** 底部常驻栏：整宽，预留 72px 高。 */
  bottom: { height: 72 },
} as const;

/* ==========================================================================
 * 地点层界面
 * ========================================================================== */

function LocationDispatchLayer(_props: ExtensionProps) {
  const snapshot = useSyncExternalStore(
    dispatchController.subscribe,
    dispatchController.getSnapshot,
  );

  if (snapshot.status !== "active") return null;
  return <OverlayShell snapshot={snapshot} />;
}

const rootStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
  fontFamily:
    "-apple-system, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  fontSize: 13,
};

/** 主题偏好 → 实际 token；auto 跟随系统深浅色（系统切换时经 hook 刷新）。 */
function useOverlayTheme(snapshot: DispatchSnapshot): LocationOverlayTheme {
  // 主题是项目数据（runtime-config 的 location.theme），随调度快照带来；
  // auto 时跟随玩家系统深浅色。
  const pref = snapshot.overlayTheme;

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent): void =>
      setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  if (pref === "dark") return DARK_OVERLAY_THEME;
  if (pref === "light") return LIGHT_OVERLAY_THEME;
  return systemDark ? DARK_OVERLAY_THEME : LIGHT_OVERLAY_THEME;
}

function OverlayShell({ snapshot }: { snapshot: DispatchSnapshot }) {
  const theme = useOverlayTheme(snapshot);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div style={rootStyle}>
      <TimeInfoCard theme={theme} />

      {snapshot.hotspots.map((hotspot) => (
        <HotspotChip key={hotspot.id} hotspot={hotspot} theme={theme} />
      ))}

      {snapshot.currentLabel !== "" && (
        <div style={chromeCardStyle(theme, { position: "absolute", left: theme.margin, bottom: theme.margin })}>
          {snapshot.currentLabel}
        </div>
      )}

      <button
        type="button"
        style={navButtonStyle(theme)}
        onClick={() => setNavOpen((open) => !open)}
      >
        导航{snapshot.movement === "graph" ? " · 连通图" : ""}
      </button>

      {navOpen && (
        <NavPanel
          snapshot={snapshot}
          theme={theme}
          onClose={() => setNavOpen(false)}
        />
      )}
    </div>
  );
}

/* ---- 左上：时间信息卡 ---------------------------------------------------- */

function TimeInfoCard({ theme }: { theme: LocationOverlayTheme }) {
  const ctx = useExtensionContext();
  const [day] = ctx.variables.useValue<number>("evg.time.day");
  const [slot] = ctx.variables.useValue<string>("evg.time.slot");
  const [paused] = ctx.variables.useValue<boolean>("evg.time.paused");
  const [weather] = ctx.variables.useValue<string>(WEATHER_VARIABLE);

  const [settings, setSettings] = useState<RuntimeTimeSettings | null>(null);
  const [weatherNames, setWeatherNames] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    let live = true;
    // 诊断（临时）：对照调度路径，验证 UI 上下文的 database 注入情况，问题清楚后移除
    ctx.database
      .collection(EVG_DATA_COLLECTION_ALIAS)
      .find()
      .then((docs) => console.info("[evg-debug][ui] collection().find() =", docs.length, "条"))
      .catch((error) => console.error("[evg-debug][ui] database 访问失败:", error));
    loadTimeSettings(ctx.database)
      .then((next) => {
        if (live) setSettings(next);
      })
      .catch(() => {
        /* 时间设置缺失时按默认配置展示 */
      });
    // 天气清单载入一次：id → 展示名；清单为空（未使用天气）时名称为 null
    loadWeatherTable(ctx.database)
      .then((table: RuntimeWeatherEntry[]) => {
        if (live) {
          setWeatherNames(
            table.length > 0 ? new Map(table.map((entry) => [entry.id, entry.name])) : null,
          );
        }
      })
      .catch(() => {
        /* 天气清单缺失时安静降级 */
      });
    return () => {
      live = false;
    };
  }, [ctx]);

  const info = formatGameTime(day, slot, settings);
  if (info.primary === null) return null;

  const weatherLabel =
    weatherNames && typeof weather === "string" && weather !== ""
      ? (weatherNames.get(weather) ?? weather)
      : null;

  return (
    <div style={chromeCardStyle(theme, { position: "absolute", left: theme.margin, top: theme.margin })}>
      <div style={{ color: theme.textPrimary, fontWeight: 600, fontSize: 14 }}>
        {info.primary}
        {weatherLabel && (
          <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: theme.textPrimary }}>
            {weatherLabel}
          </span>
        )}
        {paused === true && (
          <span style={{ color: theme.pausedColor, fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
            已暂停
          </span>
        )}
      </div>
      {info.secondary && (
        <div style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>
          {info.secondary}
        </div>
      )}
    </div>
  );
}

/* ---- 热点 --------------------------------------------------------------- */

function HotspotChip({
  hotspot,
  theme,
}: {
  hotspot: HotspotView;
  theme: LocationOverlayTheme;
}) {
  const [hover, setHover] = useState(false);
  const interactive = hotspot.interactive;

  const base: React.CSSProperties = {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "3px 12px",
    borderRadius: theme.radius,
    border: `1px solid ${interactive ? theme.hotspotBorder : theme.hotspotBorderDisabled}`,
    background: interactive && hover ? theme.accentTint : theme.hotspotBg,
    color: interactive ? theme.hotspotText : theme.hotspotTextDisabled,
    boxShadow: theme.surfaceShadow,
    fontSize: 13,
    cursor: interactive ? "pointer" : "default",
    pointerEvents: "auto",
    whiteSpace: "nowrap",
    opacity: interactive ? 1 : 0.55,
  };

  if (hotspot.shape.kind === "rect") {
    Object.assign(base, {
      left: `${hotspot.shape.x * 100}%`,
      top: `${hotspot.shape.y * 100}%`,
      width: `${hotspot.shape.width * 100}%`,
      height: `${hotspot.shape.height * 100}%`,
    });
  } else {
    // circle：radius 相对场景短边；界面铺满游戏视口时用 min(vw, vh) 近似。
    const diameter = `min(${hotspot.shape.radius * 200}vw, ${hotspot.shape.radius * 200}vh)`;
    Object.assign(base, {
      left: `calc(${hotspot.shape.x * 100}vw - ${diameter} / 2)`,
      top: `calc(${hotspot.shape.y * 100}vh - ${diameter} / 2)`,
      width: diameter,
      height: diameter,
      borderRadius: "50%",
      padding: 0,
    });
  }

  return (
    <button
      type="button"
      style={base}
      title={hotspot.reason ? `不可交互（${hotspot.reason}）` : hotspot.label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => {
        if (interactive) void dispatchController.triggerHotspot(hotspot.id);
      }}
    >
      {hotspot.label}
    </button>
  );
}

/* ---- 底部：导航弹窗 ------------------------------------------------------ */

function navButtonStyle(theme: LocationOverlayTheme): React.CSSProperties {
  return {
    position: "absolute",
    right: theme.margin,
    bottom: theme.margin,
    height: theme.barHeight,
    padding: "0 22px",
    border: "none",
    borderRadius: theme.radius,
    background: theme.accent,
    color: theme.accentText,
    fontSize: 13,
    fontWeight: 600,
    boxShadow: theme.surfaceShadow,
    cursor: "pointer",
    pointerEvents: "auto",
  };
}

function chromeCardStyle(
  theme: LocationOverlayTheme,
  extra: React.CSSProperties,
): React.CSSProperties {
  return {
    ...extra,
    padding: "7px 14px",
    borderRadius: theme.radius,
    border: `1px solid ${theme.surfaceBorder}`,
    background: theme.surface,
    color: theme.textPrimary,
    boxShadow: theme.surfaceShadow,
    pointerEvents: "none",
  };
}

function NavPanel({
  snapshot,
  theme,
  onClose,
}: {
  snapshot: DispatchSnapshot;
  theme: LocationOverlayTheme;
  onClose: () => void;
}) {
  const labels = new Map(
    snapshot.locations.map((location) => [location.chapterId, location.label]),
  );

  return (
    <div
      style={{
        position: "absolute",
        right: theme.margin,
        bottom: theme.margin + theme.barHeight + 10,
        width: 248,
        maxHeight: "42vh",
        display: "flex",
        flexDirection: "column",
        borderRadius: theme.radius,
        border: `1px solid ${theme.surfaceBorder}`,
        background: theme.surface,
        boxShadow: theme.surfaceShadow,
        pointerEvents: "auto",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: `1px solid ${theme.surfaceBorder}`,
          color: theme.textSecondary,
          fontSize: 12,
        }}
      >
        <span>前往…</span>
        <button
          type="button"
          aria-label="收起导航"
          style={{
            border: "none",
            background: "transparent",
            color: theme.textSecondary,
            fontSize: 14,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
          }}
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: 4 }}>
        {snapshot.reachable.length === 0 && (
          <div style={{ color: theme.textSecondary, fontSize: 12, padding: "8px 10px" }}>
            没有可前往的地点
          </div>
        )}
        {snapshot.reachable.map((chapterId) => (
          <NavRow
            key={chapterId}
            label={labels.get(chapterId) ?? chapterId}
            theme={theme}
            onSelect={() => {
              onClose();
              dispatchController.chooseDestination(chapterId);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NavRow({
  label,
  theme,
  onSelect,
}: {
  label: string;
  theme: LocationOverlayTheme;
  onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "8px 10px",
        border: "none",
        borderRadius: theme.radius,
        background: hover ? theme.accentTint : "transparent",
        color: theme.textPrimary,
        fontSize: 13,
        cursor: "pointer",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
    >
      {label}
    </button>
  );
}
