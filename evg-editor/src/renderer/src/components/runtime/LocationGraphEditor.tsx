import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  RuntimeGraphNodePosition,
  RuntimeLocationConnection
} from '../../../../shared/runtimeConfig'

/** 连通图编辑器使用的地点候选信息。 */
export interface GraphLocationNode {
  chapterId: string
  name: string
  disabled: boolean
}

export interface LocationGraphEditorProps {
  nodes: GraphLocationNode[]
  connections: RuntimeLocationConnection[]
  nodePositions: Record<string, RuntimeGraphNodePosition>
  disabled?: boolean
  onConnectionsChange: (connections: RuntimeLocationConnection[]) => void
  onPositionsChange: (
    positions: Record<string, RuntimeGraphNodePosition>
  ) => void
}

type GraphTool = 'move' | 'connect' | 'disconnect'

const NODE_WIDTH = 140
const NODE_HEIGHT = 46

/** 节点间的最小间距（碰撞分离用）。 */
const SEPARATE_PAD = 12
/** 碰撞分离的最大轮数（主动避让 + 推动链传播的收敛上限）。 */
const SEPARATE_ROUNDS = 24

interface Size {
  width: number
  height: number
}

function clampToBounds(
  x: number,
  y: number,
  bounds: Size
): RuntimeGraphNodePosition {
  return {
    x: Math.min(Math.max(x, 4), Math.max(4, bounds.width - NODE_WIDTH - 4)),
    y: Math.min(Math.max(y, 4), Math.max(4, bounds.height - NODE_HEIGHT - 4))
  }
}

/**
 * 释放节点后的碰撞分离：
 * - 被拖动的节点（primaryId）优先主动避让——沿远离重叠方的方向挪开自己，
 *   尽量不移动其它节点；
 * - 避让途中压到其它节点时，才把被压的节点沿挤压方向推开，
 *   推动继续压到更远的节点时依次向外传播（BFS）；
 * - 被推的节点到达边界后，不足的避让量由 primary 在后续轮次继续承担。
 */
export function resolveOverlaps(
  nodes: GraphLocationNode[],
  positions: Map<string, RuntimeGraphNodePosition>,
  primaryId: string | null,
  bounds: Size
): Record<string, RuntimeGraphNodePosition> {
  const pos = new Map(positions)
  const ids = nodes.map((node) => node.chapterId)

  const penetration = (a: RuntimeGraphNodePosition, b: RuntimeGraphNodePosition) => ({
    x: Math.min(a.x, b.x) + NODE_WIDTH + SEPARATE_PAD - Math.max(a.x, b.x),
    y: Math.min(a.y, b.y) + NODE_HEIGHT + SEPARATE_PAD - Math.max(a.y, b.y)
  })

  for (let round = 0; round < SEPARATE_ROUNDS; round++) {
    let changed = false

    // 阶段 1：primary 主动避让——只挪自己，远离每一个与自己重叠的节点。
    // 轴取两方块中心连线的主导方向（左右排开就左右让，上下排开就上下让）。
    if (primaryId !== null) {
      for (const id of ids) {
        if (id === primaryId) continue
        const primary = pos.get(primaryId)
        const other = pos.get(id)
        if (!primary || !other) continue

        const overlap = penetration(primary, other)
        if (overlap.x <= 0 || overlap.y <= 0) continue

        const horizontal =
          Math.abs(primary.x - other.x) >= Math.abs(primary.y - other.y)
        const step = (horizontal ? overlap.x : overlap.y) + 2
        const next = horizontal
          ? {
              x: primary.x + (primary.x <= other.x ? -step : step),
              y: primary.y
            }
          : {
              x: primary.x,
              y: primary.y + (primary.y <= other.y ? -step : step)
            }
        pos.set(primaryId, clampToBounds(next.x, next.y, bounds))
        changed = true
      }
    }

    // 阶段 2：从 primary 出发的挤压链——它压到谁，谁被推开；
    // 被推的节点再压到别人时继续传播。
    if (primaryId !== null) {
      const queue = [primaryId]
      // 节点可能被多次推动（例如 primary 同轮把两个节点挤到同一位置），
      // 只限制单个节点的最大被推次数来保证终止。
      const pushCount = new Map<string, number>()
      const MAX_PUSHES_PER_NODE = 8

      while (queue.length > 0) {
        const moverId = queue.shift() as string
        const mover = pos.get(moverId)
        if (!mover) continue

        for (const id of ids) {
          if (id === moverId || id === primaryId) continue
          if ((pushCount.get(id) ?? 0) >= MAX_PUSHES_PER_NODE) continue
          const other = pos.get(id)
          if (!other) continue

          const overlap = penetration(mover, other)
          if (overlap.x <= 0 || overlap.y <= 0) continue

          const horizontal =
            Math.abs(mover.x - other.x) >= Math.abs(mover.y - other.y)
          const next = horizontal
            ? {
                x:
                  mover.x + NODE_WIDTH / 2 <= other.x + NODE_WIDTH / 2
                    ? mover.x + NODE_WIDTH + SEPARATE_PAD
                    : mover.x - NODE_WIDTH - SEPARATE_PAD,
                y: other.y
              }
            : {
                x: other.x,
                y:
                  mover.y + NODE_HEIGHT / 2 <= other.y + NODE_HEIGHT / 2
                    ? mover.y + NODE_HEIGHT + SEPARATE_PAD
                    : mover.y - NODE_HEIGHT - SEPARATE_PAD
              }
          pos.set(id, clampToBounds(next.x, next.y, bounds))
          pushCount.set(id, (pushCount.get(id) ?? 0) + 1)
          queue.push(id)
          changed = true
        }
      }
    }

    if (!changed) break
  }

  return Object.fromEntries(pos)
}

/** 渲染前把节点位置夹取到当前画布范围内（画布尺寸变化时避免出界）。 */
function clampPosition(
  position: RuntimeGraphNodePosition,
  bounds: Size
): RuntimeGraphNodePosition {
  return clampToBounds(position.x, position.y, bounds)
}

/** 没有保存过坐标的节点按网格自动排布。 */
function autoPosition(index: number): RuntimeGraphNodePosition {
  return {
    x: 40 + (index % 4) * 190,
    y: 46 + Math.floor(index / 4) * 132
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * 连通图导航的可视化编辑器（runtime.location.connections）。
 *
 * - 移动模式：拖动地点方块调整布局（拖动中只更新预览，松手才提交）；
 * - 连接模式：依次点击两个地点，建立 from → to 的有向通路；
 * - 断开模式：依次点击两个地点，移除两点之间的通路（双向）。
 *
 * 坐标只服务编辑器布局（nodePositions），运行时只读取 connections。
 */
export function LocationGraphEditor({
  nodes,
  connections,
  nodePositions,
  disabled = false,
  onConnectionsChange,
  onPositionsChange
}: LocationGraphEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const canvasBoxRef = useRef<HTMLDivElement | null>(null)
  const [canvasSize, setCanvasSize] = useState<Size>({ width: 800, height: 560 })
  const [tool, setTool] = useState<GraphTool>('move')
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{
    nodeId: string
    startSvgX: number
    startSvgY: number
    originX: number
    originY: number
  } | null>(null)
  const [dragPreview, setDragPreview] = useState<{
    nodeId: string
    x: number
    y: number
  } | null>(null)

  // 画布逻辑坐标 1:1 对应实际渲染尺寸，消除信箱留白导致的“拖不到边”。
  useEffect(() => {
    const element = canvasBoxRef.current
    if (!element) return

    const update = (): void => {
      const width = element.clientWidth
      const height = element.clientHeight
      if (width > 0 && height > 0) {
        setCanvasSize((prev) =>
          prev.width === width && prev.height === height ? prev : { width, height }
        )
      }
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const resolvedPositions = new Map<string, RuntimeGraphNodePosition>()
  nodes.forEach((node, index) => {
    const saved = nodePositions[node.chapterId]
    const position = saved ?? autoPosition(index)
    resolvedPositions.set(node.chapterId, clampPosition(position, canvasSize))
  })

  const positionOf = (chapterId: string): RuntimeGraphNodePosition => {
    if (dragPreview && dragPreview.nodeId === chapterId) {
      return { x: dragPreview.x, y: dragPreview.y }
    }
    return resolvedPositions.get(chapterId) ?? autoPosition(0)
  }

  const toSvgPoint = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const transformed = point.matrixTransform(ctm.inverse())
    return { x: transformed.x, y: transformed.y }
  }

  const clampToView = (x: number, y: number): RuntimeGraphNodePosition =>
    clampToBounds(x, y, canvasSize)

  const handleNodePointerDown = (
    node: GraphLocationNode,
    event: ReactPointerEvent<SVGGraphicsElement>
  ): void => {
    if (disabled) return
    event.stopPropagation()

    if (tool === 'move') {
      const point = toSvgPoint(event.clientX, event.clientY)
      if (!point) return
      const origin = positionOf(node.chapterId)
      setDrag({
        nodeId: node.chapterId,
        startSvgX: point.x,
        startSvgY: point.y,
        originX: origin.x,
        originY: origin.y
      })
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (tool === 'connect') {
      if (!pendingNodeId) {
        setPendingNodeId(node.chapterId)
        return
      }
      if (pendingNodeId === node.chapterId) {
        setPendingNodeId(null)
        return
      }
      const exists = connections.some(
        (connection) =>
          connection.from === pendingNodeId && connection.to === node.chapterId
      )
      if (!exists) {
        onConnectionsChange([
          ...connections,
          { from: pendingNodeId, to: node.chapterId }
        ])
      }
      setPendingNodeId(null)
      return
    }

    // disconnect：移除两点之间的通路（双向）。
    if (!pendingNodeId) {
      setPendingNodeId(node.chapterId)
      return
    }
    if (pendingNodeId === node.chapterId) {
      setPendingNodeId(null)
      return
    }
    onConnectionsChange(
      connections.filter(
        (connection) =>
          !(
            (connection.from === pendingNodeId && connection.to === node.chapterId) ||
            (connection.from === node.chapterId && connection.to === pendingNodeId)
          )
      )
    )
    setPendingNodeId(null)
  }

  const handleNodePointerMove = (
    event: ReactPointerEvent<SVGGraphicsElement>
  ): void => {
    if (!drag || disabled) return
    const point = toSvgPoint(event.clientX, event.clientY)
    if (!point) return
    const next = clampToView(
      drag.originX + (point.x - drag.startSvgX),
      drag.originY + (point.y - drag.startSvgY)
    )
    setDragPreview({ nodeId: drag.nodeId, x: next.x, y: next.y })
  }

  const handleNodePointerUp = (
    event: ReactPointerEvent<SVGGraphicsElement>
  ): void => {
    if (drag) {
      const dropped = dragPreview ?? {
        nodeId: drag.nodeId,
        x: drag.originX,
        y: drag.originY
      }
      const positions = new Map(resolvedPositions)
      positions.set(dropped.nodeId, { x: dropped.x, y: dropped.y })
      onPositionsChange(
        resolveOverlaps(nodes, positions, dropped.nodeId, canvasSize)
      )
      setDrag(null)
      setDragPreview(null)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const centerOf = (chapterId: string) => {
    const position = positionOf(chapterId)
    return {
      x: position.x + NODE_WIDTH / 2,
      y: position.y + NODE_HEIGHT / 2
    }
  }

  return (
    <div className="location-graph">
      <div className="location-graph__toolbar">
        <div className="segmented">
          {(
            [
              { value: 'move', label: '移动' },
              { value: 'connect', label: '连接' },
              { value: 'disconnect', label: '断开' }
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented__item${tool === option.value ? ' segmented__item--active' : ''}`}
              disabled={disabled}
              onClick={() => {
                setTool(option.value)
                setPendingNodeId(null)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="location-graph__hint">
          {tool === 'move' && '拖动地点方块调整布局；布局只影响编辑器显示。'}
          {tool === 'connect' && '依次点击两个地点，建立“起点 → 终点”的通行方向。'}
          {tool === 'disconnect' && '依次点击两个地点，移除它们之间的通行（双向）。'}
        </span>

        <span className="location-graph__count">
          {connections.length} 条通路
        </span>
      </div>

      <div ref={canvasBoxRef} className="location-graph__canvas-box">
      <svg
        ref={svgRef}
        className="location-graph__canvas"
        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
        role="application"
        aria-label="地点连通图编辑器"
      >
        <defs>
          <marker
            id="location-graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="location-graph__arrow" />
          </marker>
        </defs>

        {connections.map((connection) => {
          const from = centerOf(connection.from)
          const to = centerOf(connection.to)
          return (
            <line
              key={`${connection.from}\u2192${connection.to}`}
              className="location-graph__edge"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              markerEnd="url(#location-graph-arrow)"
            />
          )
        })}

        {nodes.map((node) => {
          const position = positionOf(node.chapterId)
          const isPending = pendingNodeId === node.chapterId
          return (
            <g
              key={node.chapterId}
              className={
                `location-graph__node` +
                (node.disabled ? ' location-graph__node--disabled' : '') +
                (isPending ? ' location-graph__node--pending' : '')
              }
              onPointerDown={(event) => handleNodePointerDown(node, event)}
              onPointerMove={handleNodePointerMove}
              onPointerUp={handleNodePointerUp}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
            >
              <rect
                x={position.x}
                y={position.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={6}
              />
              <text
                x={position.x + NODE_WIDTH / 2}
                y={position.y + 19}
                textAnchor="middle"
                className="location-graph__node-name"
              >
                {truncate(node.name, 10)}
              </text>
              <text
                x={position.x + NODE_WIDTH / 2}
                y={position.y + 36}
                textAnchor="middle"
                className="location-graph__node-id"
              >
                {truncate(node.chapterId, 16)}
              </text>
            </g>
          )
        })}
      </svg>
      </div>

      {nodes.length === 0 && (
        <div className="data-empty">
          还没有地点。先在“地点”页把章节设为地点，再回来编辑连通图。
        </div>
      )}
    </div>
  )
}
