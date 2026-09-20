/* ==========================================================================
 * EVG Runtime 扩展方法清单
 * ==========================================================================
 *
 * 这里登记 evg-runtime 扩展公开的方法（extensionId + methodId + 参数规格），
 * 是编辑器可视化编辑的依据：
 * - `extensionMethod` 条件操作数（canExecute / guard 判断层）与
 *   SetVariable 的赋值来源（把返回值写入目标变量）；
 * - `CallExtensionMethod` 动作的参数表单。
 *
 * 与 Common.md §9.3 的方法契约保持一致；runtime 侧新增方法时先更新那里，
 * 再回填本清单。与 runtimeSystems.ts / runtimeConfig.ts 一样，本文件当前
 * 不参与 sync_evg_data.py 的自动同步（见 Common.md §9.4）。
 *
 * 清单未登记的扩展方法仍可手填：编辑器回退为“手填 id + JSON 参数”，
 * 不做结构校验以外的限制。
 */

/** evg-runtime 扩展的固定 id（见 evg-runtime/extension.json）。 */
export const EVG_RUNTIME_EXTENSION_ID = 'com.notarium.evg-runtime'

/** 方法参数里单个字段的规格。 */
export interface RuntimeMethodArgField {
  /** 参数对象里的 key。 */
  key: string
  /** 表单标签。 */
  label: string
  /** 参数值类型；复杂参数暂不进清单，走 JSON 回退编辑。 */
  type: 'string' | 'number' | 'boolean'
  /** 必填参数；编辑器在缺省时给出提示。 */
  required?: boolean
  /**
   * string 字段的候选来源：
   * - `chapterId`：项目章节列表（chapter.id）
   * - `itemId`：运行数据配置的物品清单（RuntimeItemDef.id）
   */
  suggest?: 'chapterId' | 'itemId'
  /** 字段补充说明，展示在表单下方。 */
  description?: string
}

/** 一个已登记的扩展方法。 */
export interface RuntimeMethodSpec {
  extensionId: string
  methodId: string
  /** 表单里展示的方法名。 */
  label: string
  /** 方法一句话说明。 */
  description: string
  args: readonly RuntimeMethodArgField[]
  /** 方法声明的返回类型；缺失表示无返回值（动作型方法）。 */
  returns?: 'boolean' | 'number' | 'string'
}

/**
 * 已登记的方法清单。
 *
 * - `move-location`：剧情性移动（动作调用），runtime 校验后写入
 *   `evg.location.current` 并切换章节；
 * - `add-item` / `remove-item`：物品持有量增减（动作调用），持有状态
 *   承载在每物品变量 `evg.item.<itemId>` 上（编辑器从物品清单同步声明），
 *   堆叠规则来自运行数据配置的物品清单。物品判断不再需要方法：剧本内用
 *   引擎原生变量条件 / IfExt 条件分支，canExecute / guard 用变量操作数。
 * - `advance-time`：时间推进（动作调用），按运行数据配置时间节的时段
 *   顺序推进 count 个时段，跨天自动进位；paused 时空转。
 */
export const RUNTIME_METHOD_SPECS: readonly RuntimeMethodSpec[] = [
  {
    extensionId: EVG_RUNTIME_EXTENSION_ID,
    methodId: 'move-location',
    label: '移动地点',
    description: '切换当前地点：runtime 校验目标后写入 evg.location.current 并跳转章节。',
    args: [
      {
        key: 'chapterId',
        label: '目标章节',
        type: 'string',
        required: true,
        suggest: 'chapterId',
        description: '调度依据，填章节 id。'
      },
      {
        key: 'chapterName',
        label: '目标章节名',
        type: 'string',
        description: '可选；移动提示直接展示的名称。'
      }
    ]
  },
  {
    extensionId: EVG_RUNTIME_EXTENSION_ID,
    methodId: 'add-item',
    label: '获得物品',
    description:
      '增加持有量（每物品变量 evg.item.<id>）；数量按物品清单的堆叠规则封顶。',
    args: [
      {
        key: 'itemId',
        label: '物品',
        type: 'string',
        required: true,
        suggest: 'itemId'
      },
      {
        key: 'count',
        label: '数量',
        type: 'number',
        description: '缺省按 1 处理。'
      }
    ]
  },
  {
    extensionId: EVG_RUNTIME_EXTENSION_ID,
    methodId: 'advance-time',
    label: '推进时间',
    description:
      '按时段顺序推进指定数量的时段（跨天自动进位）；evg.time.paused 为 true 时不推进。',
    args: [
      {
        key: 'count',
        label: '推进的时段数',
        type: 'number',
        description: '决定推进几个时间段；1 = 推进到下一个时段，缺省按 1 处理。'
      }
    ]
  },
  {
    extensionId: EVG_RUNTIME_EXTENSION_ID,
    methodId: 'remove-item',
    label: '移除物品',
    description: '扣减持有量（每物品变量 evg.item.<id>）；下限 0。',
    args: [
      {
        key: 'itemId',
        label: '物品',
        type: 'string',
        required: true,
        suggest: 'itemId'
      },
      {
        key: 'count',
        label: '数量',
        type: 'number',
        description: '缺省按 1 处理。'
      }
    ]
  }
]

/** 去重后的扩展 id 列表（按清单声明顺序）。 */
export function listRuntimeExtensionIds(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const spec of RUNTIME_METHOD_SPECS) {
    if (seen.has(spec.extensionId)) continue
    seen.add(spec.extensionId)
    out.push(spec.extensionId)
  }
  return out
}

/** 某个扩展下已登记的方法；未登记的扩展返回空数组。 */
export function listRuntimeMethodSpecs(extensionId: string): readonly RuntimeMethodSpec[] {
  return RUNTIME_METHOD_SPECS.filter((spec) => spec.extensionId === extensionId)
}

/** 精确查找已登记方法；未登记返回 null。 */
export function findRuntimeMethodSpec(
  extensionId: string,
  methodId: string
): RuntimeMethodSpec | null {
  return (
    RUNTIME_METHOD_SPECS.find(
      (spec) => spec.extensionId === extensionId && spec.methodId === methodId
    ) ?? null
  )
}

/** 新建 extensionMethod 时该扩展的缺省方法 id（第一个已登记方法）。 */
export function defaultRuntimeMethodId(extensionId: string): string {
  return listRuntimeMethodSpecs(extensionId)[0]?.methodId ?? ''
}
