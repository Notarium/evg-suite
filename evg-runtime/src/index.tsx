/**
 * EVG Runtime 扩展入口。
 *
 * 导出的每个 Extension 子类 = 一个子模块，宿主按 "<extensionId>/<moduleId>"
 * 引用；方法按 "<extensionId>/<methodId>" 全局注册，与编辑器方法清单
 * （evg-editor/src/shared/runtimeMethods.ts）一一对应。
 *
 * - LocationModule  地点系统：项目调度策略 + move-location + 地点层界面
 * - InventoryModule 物品系统：add-item / remove-item（每物品变量承载）
 * - IfExtModule     条件分支：每次调用都重新求值的 If/else
 * - TimeModule      时间系统：advance-time 按时段顺序推进 day / slot
 *
 * 跨模块状态一律放 ctx.variables（evg.* 命名空间，Common.md §9），
 * 不使用扩展 save —— 见 src/evg/inventory.ts 顶部的说明。
 *
 * 旧工程样例（welcome-ui.tsx / NameBasedScheduler）已从入口移除；
 * welcome-ui.tsx 暂留作界面写法参考，稳定后可删除。
 */

import { LocationModule } from "./modules/LocationModule";
import { InventoryModule } from "./modules/InventoryModule";
import { IfExtModule } from "./modules/IfExtModule";
import { TimeModule } from "./modules/TimeModule";

export { LocationModule };
export { InventoryModule };
export { IfExtModule };
export { TimeModule };
export default LocationModule;
