/**
 * Studio 工程调度蓝图（project.json 的 schedule 节）的只读解析。
 *
 * 权威格式由引擎定义（graph.version = 1）；编辑器只读检查、不写入——
 * 地点章节是否加入调度由编辑者在 Studio 蓝图里维护，本模块把
 * "已编辑地点是否被调度"的判断所需的解析收敛在这里（宽容解析，
 * 结构异常一律按"检查不适用"处理而不是抛错）。
 *
 * 节点 kind：start / end / chapter（带 chapterId）/ extension
 * （带 strategyTarget 与 chapterIds[]）；边 { source, port, target }，
 * 端口当前只有 "next"（缺省也按 next 处理）。"有效调度节点" =
 * 从 start 节点沿边可达的 extension 节点；没有 start 节点时回退为
 * 全部 extension 节点（避免异常草稿误报）。
 */

export interface ScheduleGraphInfo {
  /** strategy.type；没有 schedule 节时为 null。 */
  strategyType: string | null
  /** strategy.type === 'graph' 且 graph 结构可解析。 */
  hasGraph: boolean
  /** 可达的 extension 调度节点数。 */
  validNodeCount: number
  /** 有效节点 chapterIds 的并集（按首次出现顺序去重）。 */
  scheduledChapterIds: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function collectChapterIds(node: Record<string, unknown>): string[] {
  const ids: string[] = []
  const raw = node.chapterIds
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string' && item !== '' && !ids.includes(item)) {
        ids.push(item)
      }
    }
  }
  return ids
}

export function analyzeSchedule(schedule: unknown): ScheduleGraphInfo {
  const empty: ScheduleGraphInfo = {
    strategyType: null,
    hasGraph: false,
    validNodeCount: 0,
    scheduledChapterIds: []
  }
  if (!isRecord(schedule)) return empty

  const strategyType =
    isRecord(schedule.strategy) && typeof schedule.strategy.type === 'string'
      ? schedule.strategy.type
      : null
  if (strategyType !== 'graph' || !isRecord(schedule.graph)) {
    return { ...empty, strategyType }
  }

  const graph = schedule.graph
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.filter(isRecord) : []
  const edges = Array.isArray(graph.edges) ? graph.edges : []
  if (nodes.length === 0) return { ...empty, strategyType }

  const extensionNodes = nodes.filter((node) => node.kind === 'extension')

  // 从 start 节点沿边可达（port 缺省视为 next）；无 start 时回退全部 extension。
  const startIds = nodes
    .filter((node) => node.kind === 'start')
    .map((node) => node.id)
    .filter((id): id is string => typeof id === 'string')

  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    if (!isRecord(edge)) continue
    if (edge.port !== undefined && edge.port !== 'next') continue
    if (typeof edge.source !== 'string' || typeof edge.target !== 'string') continue
    const list = adjacency.get(edge.source) ?? []
    list.push(edge.target)
    adjacency.set(edge.source, list)
  }

  let validNodes: Array<Record<string, unknown>>
  if (startIds.length === 0) {
    validNodes = extensionNodes
  } else {
    const reachable = new Set<string>()
    const queue = [...startIds]
    while (queue.length > 0) {
      const current = queue.shift() as string
      if (reachable.has(current)) continue
      reachable.add(current)
      queue.push(...(adjacency.get(current) ?? []))
    }
    validNodes = extensionNodes.filter((node) => reachable.has(node.id as string))
  }

  const scheduledChapterIds: string[] = []
  for (const node of validNodes) {
    for (const id of collectChapterIds(node)) {
      if (!scheduledChapterIds.includes(id)) scheduledChapterIds.push(id)
    }
  }

  return {
    strategyType,
    hasGraph: true,
    validNodeCount: validNodes.length,
    scheduledChapterIds
  }
}
