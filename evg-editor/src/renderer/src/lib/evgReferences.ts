import type { EvgDataRecord } from '../../../shared/database'
import type { ChapterSummary } from '../../../shared/chapter'
import {
  EVG_DATA_KIND,
  EVG_ACTION_PURPOSE,
  type ConditionBinding,
  type ConditionExpression,
  type ConditionType,
  type ActionType,
  type EventType,
  type SceneHotspot,
  type LocationMap
} from '../../../shared/evgData'

/**
 * evg-data 记录之间的引用扫描与级联清理。
 *
 * 服务于删除保护流程：
 * - find*RefLocations 找出某个业务 id 还被哪些位置引用，用于删除前警示；
 * - remove*References 按“级联清理”模式从引用位置移除该引用：
 *   - 条件：canExecute / guard 还原为 true，条件树中删除对应分支，
 *     变空的 and / or / not 节点一并移除；
 *   - 动作：从引用它的 actions 列表中移除对应项；
 *   - 事件：解绑引用它的场景热点（热点保留，事件绑定置空）。
 *
 * 所有函数只操作传入的记录数组（即未保存的内存态），不做 IO。
 * 对非法 / 未知结构保持宽容：原样保留，不抛错。
 */

export interface EvgReferenceLocation {
  /** 引用方记录的行 id。 */
  recordId: string
  /** 引用方展示名，如 `事件 event-abc`、`章节 ch-1 · 热点「开门」`。 */
  target: string
  /** 引用位置描述，如 `执行条件 canExecute`。 */
  location: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 统计同类型记录中使用某个业务 key 的行数。
 * 大于 1 说明 key 重复，写入会被主进程拒绝；用于编辑器内的即时提示。
 */
export function countSameTypeKey(
  records: readonly EvgDataRecord[],
  type: number,
  key: string
): number {
  return records.filter((record) => record.type === type && record.key === key)
    .length
}

/* ==========================================================================
 * 条件引用（ConditionRef）
 * ========================================================================== */

function conditionExpressionReferences(
  expression: unknown,
  key: string
): boolean {
  if (typeof expression === 'string') return expression === key
  if (!isRecord(expression)) return false

  switch (expression.kind) {
    case 'predicate':
    case 'constant':
      return false
    case 'not':
      return conditionExpressionReferences(expression.child, key)
    case 'and':
    case 'or':
      return (
        Array.isArray(expression.children) &&
        expression.children.some((child) =>
          conditionExpressionReferences(child, key)
        )
      )
    default:
      return false
  }
}

function conditionBindingReferences(binding: unknown, key: string): boolean {
  if (binding === true) return false
  return conditionExpressionReferences(binding, key)
}

function describeActionBinding(binding: unknown, index: number): string {
  const fallback = `动作 ${index + 1}`
  if (!isRecord(binding)) return fallback
  const label =
    typeof binding.label === 'string' && binding.label
      ? binding.label
      : typeof binding.id === 'string' && binding.id
        ? binding.id
        : ''
  return label ? `${fallback}（${label}）` : fallback
}

function collectConditionRefsInEvent(
  event: EventType,
  recordId: string,
  target: string,
  key: string,
  out: EvgReferenceLocation[]
): void {
  if (conditionBindingReferences(event.canExecute, key)) {
    out.push({ recordId, target, location: '执行条件 canExecute' })
  }

  if (!Array.isArray(event.actions)) return
  event.actions.forEach((binding, index) => {
    if (typeof binding === 'string' || !isRecord(binding)) return
    if (conditionBindingReferences(binding.guard, key)) {
      out.push({
        recordId,
        target,
        location: `${describeActionBinding(binding, index)} 的 guard`
      })
    }
  })
}

function forEachHotspotInlineEvent(
  map: LocationMap,
  visit: (event: EventType, target: string) => void
): void {
  if (!Array.isArray(map.hotspots)) return
  for (const hotspot of map.hotspots) {
    if (!isRecord(hotspot)) continue
    if (typeof hotspot.event === 'object' && hotspot.event !== null) {
      const label =
        typeof hotspot.label === 'string' && hotspot.label
          ? hotspot.label
          : String(hotspot.id ?? '')
      visit(hotspot.event as EventType, `热点「${label}」`)
    }
  }
}

export function findConditionRefLocations(
  records: readonly EvgDataRecord[],
  key: string
): EvgReferenceLocation[] {
  const out: EvgReferenceLocation[] = []

  for (const record of records) {
    if (!isRecord(record.data)) continue

    if (record.type === EVG_DATA_KIND.Event) {
      collectConditionRefsInEvent(
        record.data as unknown as EventType,
        record.id,
        `事件 ${record.key}`,
        key,
        out
      )
    } else if (record.type === EVG_DATA_KIND.Action) {
      if (conditionBindingReferences(record.data.guard, key)) {
        out.push({
          recordId: record.id,
          target: `动作 ${record.key}`,
          location: 'guard'
        })
      }
    } else if (record.type === EVG_DATA_KIND.LocationMap) {
      const map = record.data as unknown as LocationMap
      forEachHotspotInlineEvent(map, (event, hotspotLabel) => {
        collectConditionRefsInEvent(
          event,
          record.id,
          `章节 ${record.key} · ${hotspotLabel}`,
          key,
          out
        )
      })
    }
  }

  return out
}

function stripConditionExpression(
  expression: ConditionExpression,
  key: string
): { expression: ConditionExpression | null; changed: boolean } {
  if (typeof expression === 'string') {
    return expression === key
      ? { expression: null, changed: true }
      : { expression, changed: false }
  }
  const inner = stripConditionNode(expression, key)
  return { expression: inner.node, changed: inner.changed }
}

function stripConditionNode(
  node: ConditionType,
  key: string
): { node: ConditionType | null; changed: boolean } {
  if (!isRecord(node)) return { node, changed: false }

  switch (node.kind) {
    case 'predicate':
    case 'constant':
      return { node, changed: false }

    case 'not': {
      const inner = stripConditionExpression(node.child, key)
      if (!inner.changed) return { node, changed: false }
      if (!inner.expression) return { node: null, changed: true }
      return {
        node: { ...node, child: inner.expression },
        changed: true
      }
    }

    case 'and':
    case 'or': {
      const children = Array.isArray(node.children) ? node.children : []
      let changed = false
      const nextChildren: ConditionExpression[] = []

      for (const child of children) {
        const inner = stripConditionExpression(child, key)
        if (inner.changed) changed = true
        if (inner.expression) nextChildren.push(inner.expression)
      }

      if (!changed) return { node, changed: false }
      // 逻辑节点被清空时一并移除，由上层把还原后的绑定落为 true。
      if (nextChildren.length === 0) return { node: null, changed: true }
      return { node: { ...node, children: nextChildren }, changed: true }
    }

    default:
      return { node, changed: false }
  }
}

function stripConditionBinding(
  binding: ConditionBinding,
  key: string
): { binding: ConditionBinding; changed: boolean } {
  if (binding === true) return { binding, changed: false }
  const inner = stripConditionExpression(binding, key)
  return { binding: inner.expression ?? true, changed: inner.changed }
}

function stripConditionRefsInEvent(
  event: EventType,
  key: string
): { event: EventType; changed: boolean } {
  let changed = false

  const canExecuteResult = stripConditionBinding(event.canExecute, key)
  if (canExecuteResult.changed) changed = true

  let actions = event.actions
  if (Array.isArray(actions)) {
    const nextActions = actions.map((binding) => {
      if (typeof binding === 'string' || !isRecord(binding)) return binding
      const guardResult = stripConditionBinding(binding.guard, key)
      if (!guardResult.changed) return binding
      changed = true
      return { ...binding, guard: guardResult.binding }
    })
    if (changed) actions = nextActions as typeof actions
  }

  if (!changed) return { event, changed: false }
  return {
    event: { ...event, canExecute: canExecuteResult.binding, actions },
    changed: true
  }
}

export function removeConditionReferences(
  records: readonly EvgDataRecord[],
  key: string
): EvgDataRecord[] {
  return records.map((record) => {
    if (!isRecord(record.data)) return record

    if (record.type === EVG_DATA_KIND.Event) {
      const result = stripConditionRefsInEvent(
        record.data as unknown as EventType,
        key
      )
      return result.changed ? { ...record, data: result.event } : record
    }

    if (record.type === EVG_DATA_KIND.Action) {
      const action = record.data as unknown as {
        guard: ConditionBinding
      }
      const guardResult = stripConditionBinding(action.guard, key)
      if (!guardResult.changed) return record
      return {
        ...record,
        data: { ...record.data, guard: guardResult.binding }
      }
    }

    if (record.type === EVG_DATA_KIND.LocationMap) {
      const map = record.data as unknown as LocationMap
      if (!Array.isArray(map.hotspots)) return record

      let changed = false
      const hotspots = map.hotspots.map((hotspot) => {
        if (
          !isRecord(hotspot) ||
          typeof hotspot.event !== 'object' ||
          hotspot.event === null
        ) {
          return hotspot
        }
        const result = stripConditionRefsInEvent(
          hotspot.event as EventType,
          key
        )
        if (!result.changed) return hotspot
        changed = true
        return { ...hotspot, event: result.event }
      })

      return changed ? { ...record, data: { ...map, hotspots } } : record
    }

    return record
  })
}

/* ==========================================================================
 * 动作引用（ActionRef）
 * ========================================================================== */

function collectActionRefsInEvent(
  event: EventType,
  recordId: string,
  target: string,
  key: string,
  out: EvgReferenceLocation[]
): void {
  if (!Array.isArray(event.actions)) return
  event.actions.forEach((binding, index) => {
    if (typeof binding === 'string' && binding === key) {
      out.push({
        recordId,
        target,
        location: `动作列表第 ${index + 1} 项`
      })
    }
  })
}

export function findActionRefLocations(
  records: readonly EvgDataRecord[],
  key: string
): EvgReferenceLocation[] {
  const out: EvgReferenceLocation[] = []

  for (const record of records) {
    if (!isRecord(record.data)) continue

    if (record.type === EVG_DATA_KIND.Event) {
      collectActionRefsInEvent(
        record.data as unknown as EventType,
        record.id,
        `事件 ${record.key}`,
        key,
        out
      )
    } else if (record.type === EVG_DATA_KIND.LocationMap) {
      const map = record.data as unknown as LocationMap
      forEachHotspotInlineEvent(map, (event, hotspotLabel) => {
        collectActionRefsInEvent(
          event,
          record.id,
          `章节 ${record.key} · ${hotspotLabel}`,
          key,
          out
        )
      })
    }
  }

  return out
}

function stripActionRefsInEvent(
  event: EventType,
  key: string
): { event: EventType; changed: boolean } {
  if (!Array.isArray(event.actions)) return { event, changed: false }

  const nextActions = event.actions.filter(
    (binding) => !(typeof binding === 'string' && binding === key)
  )
  if (nextActions.length === event.actions.length) {
    return { event, changed: false }
  }

  return { event: { ...event, actions: nextActions }, changed: true }
}

export function removeActionReferences(
  records: readonly EvgDataRecord[],
  key: string
): EvgDataRecord[] {
  return records.map((record) => {
    if (!isRecord(record.data)) return record

    if (record.type === EVG_DATA_KIND.Event) {
      const result = stripActionRefsInEvent(
        record.data as unknown as EventType,
        key
      )
      return result.changed ? { ...record, data: result.event } : record
    }

    if (record.type === EVG_DATA_KIND.LocationMap) {
      const map = record.data as unknown as LocationMap
      if (!Array.isArray(map.hotspots)) return record

      let changed = false
      const hotspots = map.hotspots.map((hotspot) => {
        if (
          !isRecord(hotspot) ||
          typeof hotspot.event !== 'object' ||
          hotspot.event === null
        ) {
          return hotspot
        }
        const result = stripActionRefsInEvent(hotspot.event as EventType, key)
        if (!result.changed) return hotspot
        changed = true
        return { ...hotspot, event: result.event }
      })

      return changed ? { ...record, data: { ...map, hotspots } } : record
    }

    return record
  })
}

/* ==========================================================================
 * 事件引用（EventRef）
 * ========================================================================== */

export function findEventRefLocations(
  records: readonly EvgDataRecord[],
  key: string
): EvgReferenceLocation[] {
  const out: EvgReferenceLocation[] = []

  for (const record of records) {
    if (record.type !== EVG_DATA_KIND.LocationMap) continue
    if (!isRecord(record.data)) continue

    const map = record.data as unknown as LocationMap
    if (!Array.isArray(map.hotspots)) continue

    for (const hotspot of map.hotspots) {
      if (!isRecord(hotspot)) continue
      if (hotspot.event === key) {
        const label =
          typeof hotspot.label === 'string' && hotspot.label
            ? hotspot.label
            : String(hotspot.id ?? '')
        out.push({
          recordId: record.id,
          target: `章节 ${record.key} · 热点「${label}」`,
          location: '点击事件 event'
        })
      }
    }
  }

  return out
}

export function removeEventReferences(
  records: readonly EvgDataRecord[],
  key: string
): EvgDataRecord[] {
  return records.map((record) => {
    if (record.type !== EVG_DATA_KIND.LocationMap) return record
    if (!isRecord(record.data)) return record

    const map = record.data as unknown as LocationMap
    if (!Array.isArray(map.hotspots)) return record

    let changed = false
    const hotspots = map.hotspots.map((hotspot): SceneHotspot => {
      if (!isRecord(hotspot) || hotspot.event !== key) {
        return hotspot as SceneHotspot
      }
      changed = true
      const { event: _removed, ...rest } = hotspot
      return rest as SceneHotspot
    })

    return changed ? { ...record, data: { ...map, hotspots } } : record
  })
}

/* ==========================================================================
 * 变量引用（只扫描，用于删除前警示；不做级联）
 * ========================================================================== */

function conditionExpressionUsesVariable(
  expression: unknown,
  name: string
): boolean {
  if (typeof expression === 'string') return false
  if (!isRecord(expression)) return false

  switch (expression.kind) {
    case 'predicate':
      return (
        Array.isArray(expression.operands) &&
        expression.operands.some(
          (operand) =>
            isRecord(operand) &&
            operand.kind === 'variable' &&
            operand.variable === name
        )
      )
    case 'not':
      return conditionExpressionUsesVariable(expression.child, name)
    case 'and':
    case 'or':
      return (
        Array.isArray(expression.children) &&
        expression.children.some((child) =>
          conditionExpressionUsesVariable(child, name)
        )
      )
    default:
      return false
  }
}

function conditionBindingUsesVariable(
  binding: unknown,
  name: string
): boolean {
  if (binding === true) return false
  return conditionExpressionUsesVariable(binding, name)
}

function actionUsesVariable(action: unknown, name: string): boolean {
  if (!isRecord(action)) return false

  if (action.type === EVG_ACTION_PURPOSE.SetVariable && isRecord(action.data)) {
    if (action.data.variable === name) return true
    const value = action.data.value
    return (
      isRecord(value) && value.kind === 'variable' && value.variable === name
    )
  }

  return false
}

function collectVariableRefsInEvent(
  event: EventType,
  recordId: string,
  target: string,
  name: string,
  out: EvgReferenceLocation[]
): void {
  if (conditionBindingUsesVariable(event.canExecute, name)) {
    out.push({ recordId, target, location: '执行条件 canExecute' })
  }

  if (!Array.isArray(event.actions)) return
  event.actions.forEach((binding, index) => {
    if (typeof binding === 'string' || !isRecord(binding)) return
    if (actionUsesVariable(binding, name)) {
      out.push({
        recordId,
        target,
        location: `${describeActionBinding(binding, index)} 的 data`
      })
      return
    }
    if (conditionBindingUsesVariable(binding.guard, name)) {
      out.push({
        recordId,
        target,
        location: `${describeActionBinding(binding, index)} 的 guard`
      })
    }
  })
}

/**
 * 找出仍在使用某个项目变量的位置（条件操作数 / SetVariable 数据）。
 * 变量删除只做警示，不做级联：引用原样保留。
 */
export function findVariableRefLocations(
  records: readonly EvgDataRecord[],
  name: string
): EvgReferenceLocation[] {
  const out: EvgReferenceLocation[] = []

  for (const record of records) {
    if (!isRecord(record.data)) continue

    if (record.type === EVG_DATA_KIND.Event) {
      collectVariableRefsInEvent(
        record.data as unknown as EventType,
        record.id,
        `事件 ${record.key}`,
        name,
        out
      )
    } else if (record.type === EVG_DATA_KIND.Action) {
      const target = `动作 ${record.key}`
      if (actionUsesVariable(record.data, name)) {
        out.push({ recordId: record.id, target, location: 'data' })
      } else if (conditionBindingUsesVariable(record.data.guard, name)) {
        out.push({ recordId: record.id, target, location: 'guard' })
      }
    } else if (record.type === EVG_DATA_KIND.Condition) {
      if (conditionExpressionUsesVariable(record.data, name)) {
        out.push({
          recordId: record.id,
          target: `条件 ${record.key}`,
          location: '条件树操作数'
        })
      }
    } else if (record.type === EVG_DATA_KIND.LocationMap) {
      const map = record.data as unknown as LocationMap
      forEachHotspotInlineEvent(map, (event, hotspotLabel) => {
        collectVariableRefsInEvent(
          event,
          record.id,
          `章节 ${record.key} · ${hotspotLabel}`,
          name,
          out
        )
      })
    }
  }

  return out
}

/* ==========================================================================
 * 变量引用改写（重命名变量的传递性同步）
 *
 * 与上面的扫描（findVariableRefLocations）走完全相同的遍历口径：
 * 扫描报出的每一处引用，改写都能落到。就地修改传入的克隆，原记录
 * 不动；结构非法 / 未知保持宽容，原样保留。
 * ========================================================================== */

function renameVariablesInOperand(
  operand: unknown,
  oldName: string,
  newName: string
): number {
  if (!isRecord(operand)) return 0
  if (operand.kind === 'variable' && operand.variable === oldName) {
    operand.variable = newName
    return 1
  }
  return 0
}

function renameVariablesInConditionExpression(
  expression: unknown,
  oldName: string,
  newName: string
): number {
  if (typeof expression === 'string') return 0
  if (!isRecord(expression)) return 0

  switch (expression.kind) {
    case 'predicate': {
      if (!Array.isArray(expression.operands)) return 0
      return expression.operands.reduce(
        (count, operand) =>
          count + renameVariablesInOperand(operand, oldName, newName),
        0
      )
    }
    case 'not':
      return renameVariablesInConditionExpression(
        expression.child,
        oldName,
        newName
      )
    case 'and':
    case 'or': {
      if (!Array.isArray(expression.children)) return 0
      return expression.children.reduce(
        (count, child) =>
          count + renameVariablesInConditionExpression(child, oldName, newName),
        0
      )
    }
    default:
      return 0
  }
}

function renameVariablesInConditionBinding(
  binding: unknown,
  oldName: string,
  newName: string
): number {
  if (binding === true) return 0
  return renameVariablesInConditionExpression(binding, oldName, newName)
}

function renameVariablesInAction(
  action: unknown,
  oldName: string,
  newName: string
): number {
  if (!isRecord(action)) return 0
  let count = 0

  if (action.type === EVG_ACTION_PURPOSE.SetVariable && isRecord(action.data)) {
    if (action.data.variable === oldName) {
      action.data.variable = newName
      count += 1
    }
    const value = action.data.value
    if (isRecord(value) && value.kind === 'variable' && value.variable === oldName) {
      value.variable = newName
      count += 1
    }
  }

  return count
}

function renameVariablesInActionBinding(
  binding: unknown,
  oldName: string,
  newName: string
): number {
  // ActionRef（字符串）指向独立的 Action 行，那些行会被整体遍历到
  if (typeof binding === 'string' || !isRecord(binding)) return 0

  let count = renameVariablesInAction(binding, oldName, newName)
  count += renameVariablesInConditionBinding(binding.guard, oldName, newName)
  return count
}

function renameVariablesInEvent(
  event: unknown,
  oldName: string,
  newName: string
): number {
  if (!isRecord(event)) return 0
  let count = renameVariablesInConditionBinding(event.canExecute, oldName, newName)

  if (Array.isArray(event.actions)) {
    count += event.actions.reduce(
      (sum, binding) =>
        sum + renameVariablesInActionBinding(binding, oldName, newName),
      0
    )
  }
  return count
}

export interface VariableRenameResult {
  /** 改写后的记录数组；无改写时为原数组的浅拷贝。 */
  records: EvgDataRecord[]
  /** 是否有记录被改写（调用方据此决定是否置脏）。 */
  changed: boolean
  /** 改写的引用出现次数（操作数粒度；比 findVariableRefLocations 的
   * 位置口径更细——一个扫描位置可能包含多处出现）。 */
  renamedCount: number
}

/**
 * 把 evg-data 记录中对变量 oldName 的引用全部改写为 newName。
 *
 * 覆盖：条件树操作数、事件 canExecute / guard、SetVariable 的目标变量
 * 与值操作数、地点热点内联事件；ActionRef / EventRef / ConditionRef 指向
 * 的独立行由整体遍历覆盖。用于变量重命名的传递性同步。
 */
export function renameVariableReferences(
  records: readonly EvgDataRecord[],
  oldName: string,
  newName: string
): VariableRenameResult {
  if (oldName === '' || oldName === newName) {
    return { records: [...records], changed: false, renamedCount: 0 }
  }

  let changed = false
  let renamedCount = 0

  const next = records.map((record) => {
    if (!isRecord(record.data)) return record
    if (
      record.type !== EVG_DATA_KIND.Event &&
      record.type !== EVG_DATA_KIND.Action &&
      record.type !== EVG_DATA_KIND.Condition &&
      record.type !== EVG_DATA_KIND.LocationMap
    ) {
      return record
    }

    // 就地改写前先深克隆；无命中时丢弃克隆、原记录原样返回。
    const clone = JSON.parse(JSON.stringify(record.data)) as Record<string, unknown>
    let count = 0

    if (record.type === EVG_DATA_KIND.Event) {
      count = renameVariablesInEvent(clone, oldName, newName)
    } else if (record.type === EVG_DATA_KIND.Action) {
      count = renameVariablesInAction(clone, oldName, newName)
      count += renameVariablesInConditionBinding(clone.guard, oldName, newName)
    } else if (record.type === EVG_DATA_KIND.Condition) {
      count = renameVariablesInConditionExpression(clone, oldName, newName)
    } else {
      const hotspots = Array.isArray(clone.hotspots) ? clone.hotspots : []
      for (const hotspot of hotspots) {
        if (!isRecord(hotspot)) continue
        if (typeof hotspot.event === 'string' || !isRecord(hotspot.event)) continue
        count += renameVariablesInEvent(hotspot.event, oldName, newName)
      }
    }

    if (count === 0) return record
    changed = true
    renamedCount += count
    return { ...record, data: clone }
  })

  return { records: next, changed, renamedCount }
}

/* ==========================================================================
 * 热点片段章节静态检查
 * ========================================================================== */

function parseRowData(data: unknown): Record<string, unknown> {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data)
      return isRecord(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return isRecord(data) ? data : {}
}

/**
 * 热点事件动作链中 CallFragment 的章节静态检查（只读，不阻塞编辑）。
 *
 * 对热点绑定的事件（内联或 EventRef）及其 actions（内联或 ActionRef）
 * 里的每个 CallFragment：目标章节 = 动作显式 chapterId ?? 热点所在章节；
 * 目标章节不存在或不含该 fragment 时给出警告——运行时“自动”解析会在
 * 当前章节查找 fragment，跨章节调用必须显式指定 chapterId。
 */
export function collectHotspotFragmentIssues(
  locationChapterId: string,
  hotspot: SceneHotspot,
  records: readonly EvgDataRecord[],
  chapters: readonly ChapterSummary[]
): string[] {
  const events = new Map<string, EventType>()
  const actions = new Map<string, ActionType>()
  for (const record of records) {
    const data = parseRowData(record.data)
    if (record.type === EVG_DATA_KIND.Event) {
      events.set(record.key, data as unknown as EventType)
    } else if (record.type === EVG_DATA_KIND.Action) {
      actions.set(record.key, data as unknown as ActionType)
    }
  }

  const issues: string[] = []

  const resolveEvent = (): EventType | null => {
    const binding = hotspot.event
    if (binding === undefined) return null
    if (typeof binding === 'string') {
      const resolved = events.get(binding)
      if (!resolved) {
        issues.push(`热点事件引用断链（${binding}），事件不会执行`)
        return null
      }
      return resolved
    }
    return binding
  }

  const event = resolveEvent()
  if (!event) return issues

  const actionBindings = Array.isArray(event.actions) ? event.actions : []
  for (const binding of actionBindings) {
    let action: ActionType | null
    if (typeof binding === 'string') {
      action = actions.get(binding) ?? null
      if (!action) {
        issues.push(`动作引用断链（${binding}），该动作将被跳过`)
        continue
      }
    } else {
      action = binding
    }

    if (action.type !== EVG_ACTION_PURPOSE.CallFragment) continue

    const data = isRecord(action.data) ? action.data : {}
    const fragmentId = typeof data.fragmentId === 'string' ? data.fragmentId : ''
    if (fragmentId === '') {
      issues.push(`动作「${action.label || action.id}」未选择片段`)
      continue
    }

    const explicitChapterId =
      typeof data.chapterId === 'string' && data.chapterId !== ''
        ? data.chapterId
        : null
    const targetChapterId = explicitChapterId ?? locationChapterId
    const target = chapters.find((chapter) => chapter.id === targetChapterId)

    if (!target) {
      issues.push(
        `动作「${action.label || action.id}」的目标章节 ${targetChapterId} 不存在`
      )
      continue
    }

    if (!target.fragments.some((fragment) => fragment.id === fragmentId)) {
      const owner = chapters.find((chapter) =>
        chapter.fragments.some(
          (fragment) => fragment.id === fragmentId && fragment.isMain !== true
        )
      )
      const actionName = action.label || action.id
      if (!owner) {
        issues.push(
          `动作「${actionName}」的片段 ${fragmentId} 在工程章节中不存在（可能已被删除）`
        )
      } else if (explicitChapterId) {
        issues.push(
          `动作「${actionName}」显式指定了章节「${target.name}」，但片段 ${fragmentId} 属于章节「${owner.name}」`
        )
      } else {
        issues.push(
          `动作「${actionName}」的片段 ${fragmentId} 属于章节「${owner.name}」，不在热点所在章节中；运行时按当前章节解析会找不到该片段，跨章节调用请在动作里显式指定章节`
        )
      }
    }
  }

  return issues
}
