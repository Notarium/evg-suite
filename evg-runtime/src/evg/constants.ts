/**
 * EVG Runtime 包内共享常量。
 *
 * EXTENSION_ID 必须与 extension.json 的 id 一致：编辑器侧的方法清单
 * （evg-editor/src/shared/runtimeMethods.ts）按它注册扩展方法，
 * ctx.ui 也以 "<extensionId>/<moduleId>" 寻址模块界面。
 */

export const EXTENSION_ID = "com.notarium.evg-runtime";

/** 地点调度模块（LocationModule）的子模块 id / 界面 id。 */
export const LOCATION_MODULE_ID = "location";
export const LOCATION_UI_PATH = `${EXTENSION_ID}/${LOCATION_MODULE_ID}`;

/** 当前地点变量：存 chapterId，空串 = 未初始化（Common.md §9.2）。 */
export const CURRENT_LOCATION_VARIABLE = "evg.location.current";

/**
 * 物品持有量变量前缀：每个物品一个 number 变量 `evg.item.<itemId>`
 * （Common.md §9.3）。变量声明由编辑器从物品清单同步生成。
 */
export const ITEM_VARIABLE_PREFIX = "evg.item.";

/**
 * 当前天气变量：存天气 id（Common.md §9.3）。天气清单为空时本变量
 * 不声明、不 roll；声明由编辑器从清单同步生成。
 */
export const WEATHER_VARIABLE = "evg.weather.current";

/**
 * evg-data 数据表的 dependency alias（manifest dataDependencies 的 key）。
 *
 * 注意 SDK 的 `db.collection(alias)` 接收的是 manifest 里的 alias 而不是
 * 项目内 collection id / name——三者当前恰好都源于 "evdata" 与 "evg-data"：
 * alias = evdata；项目内 collection id = evdata；collection 展示名
 * （extension.json autoCreate.name）= evg-data。改 manifest 的 key 时必须
 * 同步这里与工程 dataBindings 的 key。
 */
export const EVG_DATA_COLLECTION_ALIAS = "evdata";

/** runtime-config 行的固定 type / key（Common.md §9.3）。 */
export const RUNTIME_CONFIG_DATA_TYPE = 1000;
export const RUNTIME_CONFIG_ROW_KEY = "runtime-config";
