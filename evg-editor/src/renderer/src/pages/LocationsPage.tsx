import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { createPortal } from 'react-dom'
import type { EvgDataRecord } from '../../../shared/database'
import {
  EVG_DATA_KIND,
  type EventBinding,
  type SceneHotspot,
  type LocationMap,
  type SceneHotspotShape
} from '../../../shared/evgData'
import type { SceneLayerSummary, SceneSummary } from '../../../shared/scene'
import { analyzeSchedule, type ScheduleGraphInfo } from '../../../shared/schedule'
import { createGuid } from '../../../shared/variable'
import type { ProjectVariable } from '../../../shared/variable'
import { EditorDialog } from '../components/data/EditorDialog'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import {
  CircleAddIcon,
  CollapseIcon,
  ExpandIcon,
  FolderOpenIcon,
  FrameSafeIcon,
  PencilIcon,
  PlusIcon,
  PointerIcon,
  RectAddIcon,
  RefreshIcon,
  TrashIcon
} from '../components/Icons'
import type { ConditionOption } from '../components/evg/condition/ConditionEditor'
import type { ActionOption } from '../components/evg/action/actionOptions'
import type { EventOption } from '../components/evg/event/eventOptions'
import { HotspotPropertyEditor } from '../components/evg/scene/HotspotPropertyEditor'
import { LocationEnterTriggersEditor } from '../components/evg/scene/LocationEnterTriggersEditor'
import { collectHotspotFragmentIssues } from '../lib/evgReferences'
import { useAssetUrl } from '../hooks/useAssetUrl'
import { useAppStore } from '../stores/useAppStore'
import { useChapterStore } from '../stores/useChapterStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import { useSceneStore } from '../stores/useSceneStore'
import { useVariableEditorStore } from '../stores/useVariableEditorStore'

type LocationMapRecord = EvgDataRecord & {
  type: 4
  data: LocationMap
}

type SceneTool = 'select' | 'circle' | 'rect'

function isLocationMapRecord(
  record: EvgDataRecord
): record is LocationMapRecord {
  return (
    record.type === EVG_DATA_KIND.LocationMap &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function createHotspotShape(
  tool: Exclude<SceneTool, 'select'>,
  x: number,
  y: number
): SceneHotspotShape {
  if (tool === 'circle') {
    return { kind: 'circle', x, y, radius: 0.05 }
  }

  const width = 0.12
  const height = 0.12

  return {
    kind: 'rect',
    x: clamp(x - width / 2, 0, 1 - width),
    y: clamp(y - height / 2, 0, 1 - height),
    width,
    height
  }
}

function clampShapePosition(
  shape: SceneHotspotShape,
  x: number,
  y: number
): SceneHotspotShape {
  if (shape.kind === 'circle') {
    return { ...shape, x: clamp01(x), y: clamp01(y) }
  }

  return {
    ...shape,
    x: clamp(x, 0, 1 - shape.width),
    y: clamp(y, 0, 1 - shape.height)
  }
}

function getShapePosition(shape: SceneHotspotShape): { x: number; y: number } {
  return { x: shape.x, y: shape.y }
}

interface SceneToolSelectorProps {
  tool: SceneTool
  disabled?: boolean
  onChange: (tool: SceneTool) => void
}

function SceneToolSelector({
  tool,
  disabled = false,
  onChange
}: SceneToolSelectorProps) {
  return (
    <div className="scene-tool-selector">
      <span className="scene-tool-selector__label" aria-hidden="true">
        Edit
      </span>
      <div className="segmented">
        <button
          type="button"
          className={`segmented__item${
            tool === 'select' ? ' segmented__item--active' : ''
          }`}
          disabled={disabled}
          aria-label="选择"
          title="选择"
          onClick={() => onChange('select')}
        >
          <PointerIcon size={16} />
        </button>
        <button
          type="button"
          className={`segmented__item${
            tool === 'circle' ? ' segmented__item--active' : ''
          }`}
          disabled={disabled}
          aria-label="圆形热点"
          title="圆形热点"
          onClick={() => onChange('circle')}
        >
          <CircleAddIcon size={16} />
        </button>
        <button
          type="button"
          className={`segmented__item${
            tool === 'rect' ? ' segmented__item--active' : ''
          }`}
          disabled={disabled}
          aria-label="方框热点"
          title="方框热点"
          onClick={() => onChange('rect')}
        >
          <RectAddIcon size={16} />
        </button>
      </div>
    </div>
  )
}

interface SceneLayerImageProps {
  projectPath: string
  layer: SceneLayerSummary
}

function SceneLayerImage({ projectPath, layer }: SceneLayerImageProps) {
  const { url, loading, error } = useAssetUrl(projectPath, layer.assetPath)

  if (loading) {
    return <div className="scene-layer scene-layer--placeholder">读取中…</div>
  }

  if (!url) {
    return (
      <div className="scene-layer scene-layer--placeholder" title={error ?? ''}>
        无法预览
      </div>
    )
  }

  return (
    <img
      className="scene-layer"
      src={url}
      alt={layer.name}
      draggable={false}
    />
  )
}

interface HotspotShapeViewProps {
  hotspot: SceneHotspot
  previewWidth: number
  previewHeight: number
  selected: boolean
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
}

interface ScheduleNoticeBarProps {
  info: ScheduleGraphInfo | null
  loading: boolean
  locations: ReadonlyArray<{ chapterId: string; disabled: boolean }>
  chapterNames: ReadonlyMap<string, string>
  onRefresh: () => void
}

/**
 * 调度挂接提示条（只读检查）：地点章节没加入 Studio 蓝图调度节点的
 * chapterIds、或找不到已接线的调度节点时显示；刷新按钮重读 project.json。
 * 编辑器不写回调度蓝图——章节加入调度由编辑者在 Studio 侧完成。
 */
function ScheduleNoticeBar({
  info,
  loading,
  locations,
  chapterNames,
  onRefresh
}: ScheduleNoticeBarProps) {
  if (!info || !info.hasGraph) return null

  const refreshButton = (
    <button
      type="button"
      className="icon-button icon-button--ghost schedule-notice__refresh"
      disabled={loading}
      aria-label="刷新调度蓝图"
      title="重新读取 project.json 的调度蓝图"
      onClick={onRefresh}
    >
      <RefreshIcon size={15} />
    </button>
  )

  if (info.validNodeCount === 0) {
    return (
      <div className="schedule-notice" role="status">
        <span className="schedule-notice__text">
          未找到已接线的调度节点：地点已注册，但当前蓝图里没有从开始节点可达的
          调度节点，这些章节不会被调度。可在 Studio 蓝图编辑器中添加并接线
          扩展策略节点（EVG 地点调度）。
        </span>
        {refreshButton}
      </div>
    )
  }

  const missing = locations.filter(
    (location) =>
      !location.disabled && !info.scheduledChapterIds.includes(location.chapterId)
  )
  if (missing.length === 0) return null

  const names = missing
    .map((location) => chapterNames.get(location.chapterId) ?? location.chapterId)
    .join('、')

  return (
    <div className="schedule-notice" role="status">
      <span className="schedule-notice__text">
        {missing.length} 个地点章节未加入调度器的 chapterIds
        列表：{names}。请在 Studio 蓝图编辑器的调度节点中添加；加入后点击右侧刷新。
      </span>
      {refreshButton}
    </div>
  )
}

interface SafeAreaViewProps {
  previewWidth: number
  resolutionWidth: number
}

/**
 * 地点层 overlay 常驻区的安全区参考线。
 *
 * 尺寸与 evg-runtime LocationModule 的 OVERLAY_SAFE_AREAS 镜像
 * （场景参考分辨率下的 px，契约见 Common.md §9.3「地点层常驻区与
 * 热点安全区」）：预览按 resolution 缩放显示，这里用
 * previewWidth / resolutionWidth 把真实 px 换算成预览 px。
 * 改尺寸必须同步 runtime 常量与 Common.md。
 */
const OVERLAY_SAFE_TOP_LEFT = { width: 384, height: 112 }
const OVERLAY_SAFE_BOTTOM_HEIGHT = 72

function SafeAreaView({
  previewWidth,
  resolutionWidth
}: SafeAreaViewProps) {
  if (previewWidth <= 0 || resolutionWidth <= 0) return null

  const scale = previewWidth / resolutionWidth

  return (
    <>
      <div
        className="scene-safe-zone scene-safe-zone--top"
        style={{
          left: 0,
          top: 0,
          width: OVERLAY_SAFE_TOP_LEFT.width * scale,
          height: OVERLAY_SAFE_TOP_LEFT.height * scale
        }}
      >
        <span>时间信息区</span>
      </div>
      <div
        className="scene-safe-zone scene-safe-zone--bottom"
        style={{
          left: 0,
          bottom: 0,
          width: '100%',
          height: OVERLAY_SAFE_BOTTOM_HEIGHT * scale
        }}
      >
        <span>常驻栏 / 导航</span>
      </div>
    </>
  )
}

function HotspotShapeView({
  hotspot,
  previewWidth,
  previewHeight,
  selected,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp
}: HotspotShapeViewProps) {
  const { shape } = hotspot
  const shortSide = Math.min(previewWidth, previewHeight)
  const style =
    shape.kind === 'circle'
      ? {
          left: `${shape.x * previewWidth}px`,
          top: `${shape.y * previewHeight}px`,
          width: `${shape.radius * shortSide * 2}px`,
          height: `${shape.radius * shortSide * 2}px`,
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)'
        }
      : {
          left: `${shape.x * previewWidth}px`,
          top: `${shape.y * previewHeight}px`,
          width: `${shape.width * previewWidth}px`,
          height: `${shape.height * previewHeight}px`
        }

  return (
    <div
      className={`scene-hotspot${selected ? ' scene-hotspot--selected' : ''}${
        hotspot.enabled ? '' : ' scene-hotspot--disabled'
      }`}
      style={style}
      title={hotspot.label}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextMenu(event)
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) =>
        event.stopPropagation()
      }
    >
      <span className="scene-hotspot__label">{hotspot.label}</span>
    </div>
  )
}

interface LocationMetaRowProps {
  map: LocationMap
  chapterName: string
  disabled?: boolean
  onChange: (patch: Partial<Pick<LocationMap, 'label' | 'disabled'>>) => void
}

/** 地点级属性：显示名（导航 / 移动提示用）与禁用开关。 */
function LocationMetaRow({
  map,
  chapterName,
  disabled = false,
  onChange
}: LocationMetaRowProps) {
  return (
    <div className="location-meta">
      <label className="location-meta__field">
        <span>地点名称</span>
        <input
          className="field-input"
          value={map.label ?? ''}
          placeholder={`缺省使用章节名（${chapterName}）`}
          disabled={disabled}
          onChange={(event) => onChange({ label: event.target.value })}
        />
      </label>
      <button
        type="button"
        className={`value-toggle${map.disabled ? ' value-toggle--on' : ''}`}
        disabled={disabled}
        title="禁用的地点不作为可移动目的地，也不执行其调度（可用于 demo 导出）"
        onClick={() => onChange({ disabled: !map.disabled })}
      >
        {map.disabled ? '已禁用' : '已启用'}
      </button>
    </div>
  )
}

export function LocationsPage() {
  const currentProject = useAppStore((state) => state.currentProject)
  const setActivePage = useAppStore((state) => state.setActivePage)
  const openProject = useAppStore((state) => state.openProject)
  const appLoading = useAppStore((state) => state.loading)

  const records = useEvgDataStore((state) => state.records)
  const saving = useEvgDataStore((state) => state.saving)
  const dirty = useEvgDataStore((state) => state.dirty)
  const errorMessage = useEvgDataStore((state) => state.errorMessage)
  const loadRecords = useEvgDataStore((state) => state.load)
  const unloadRecords = useEvgDataStore((state) => state.unload)
  const setRecords = useEvgDataStore((state) => state.setRecords)
  const saveRecords = useEvgDataStore((state) => state.saveRecords)
  const reloadRecords = useEvgDataStore((state) => state.reload)
  const clearError = useEvgDataStore((state) => state.clearError)

  const variables = useVariableEditorStore((state) => state.variables)
  const loadVariables = useVariableEditorStore((state) => state.load)

  const chapters = useChapterStore((state) => state.chapters)
  const loadChapters = useChapterStore((state) => state.load)

  const scenes = useSceneStore((state) => state.scenes)
  const loadScenes = useSceneStore((state) => state.load)

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null)
  const [tool, setTool] = useState<SceneTool>('select')
  const [expanded, setExpanded] = useState(false)
  const [showSafeArea, setShowSafeArea] = useState(true)
  const [scheduleInfo, setScheduleInfo] = useState<ScheduleGraphInfo | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  const loadSchedule = useCallback(async (): Promise<void> => {
    const path = currentProject?.path
    if (!path) {
      setScheduleInfo(null)
      return
    }

    setScheduleLoading(true)
    try {
      const result = await window.api.schedule.read(path)
      setScheduleInfo(result.ok ? analyzeSchedule(result.data) : null)
    } catch {
      setScheduleInfo(null)
    } finally {
      setScheduleLoading(false)
    }
  }, [currentProject?.path])

  useEffect(() => {
    void loadSchedule()
  }, [loadSchedule])
  const [deleteMapTarget, setDeleteMapTarget] = useState<{
    chapterId: string
    chapterName: string
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    chapterId: string
  } | null>(null)
  const [sceneContextMenu, setSceneContextMenu] = useState<{
    x: number
    y: number
    kind: 'blank' | 'hotspot'
    hotspotId?: string
    nx?: number
    ny?: number
  } | null>(null)
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 })
  const previewRef = useRef<HTMLDivElement | null>(null)
  const contextMenuRef = useRef<HTMLDivElement | null>(null)
  const sceneContextMenuRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    hotspotId: string
    startClientX: number
    startClientY: number
    startX: number
    startY: number
  } | null>(null)

  useEffect(() => {
    const path = currentProject?.path
    if (!path) {
      unloadRecords()
      return
    }

    void loadRecords(path)
    void loadVariables(path)
    void loadChapters(path)
    void loadScenes(path)
  }, [
    currentProject?.path,
    loadRecords,
    loadVariables,
    loadChapters,
    loadScenes,
    unloadRecords
  ])

  useEffect(() => {
    if (selectedChapterId || chapters.length === 0) return
    setSelectedChapterId(chapters[0].id)
  }, [chapters, selectedChapterId])

  useEffect(() => {
    setSelectedHotspotId(null)
    setTool('select')
    setExpanded(false)
  }, [selectedChapterId, scenes])

  useLayoutEffect(() => {
    const element = previewRef.current
    if (!element) return

    const updateSize = (): void => {
      const rect = element.getBoundingClientRect()
      setPreviewSize({ width: rect.width, height: rect.height })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [selectedChapterId, scenes, records.length, expanded])

  useEffect(() => {
    if (!contextMenu) return

    const handleMouseDown = (event: MouseEvent): void => {
      if (contextMenuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setContextMenu(null)
    }

    const handleViewportChange = (): void => {
      setContextMenu(null)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [contextMenu])

  useEffect(() => {
    if (!sceneContextMenu) return

    const handleMouseDown = (event: MouseEvent): void => {
      if (sceneContextMenuRef.current?.contains(event.target as Node)) return
      setSceneContextMenu(null)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSceneContextMenu(null)
    }

    const handleViewportChange = (): void => {
      setSceneContextMenu(null)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [sceneContextMenu])

  const findMapRecord = (chapterId: string): LocationMapRecord | null => {
    const candidate =
      records.find(
        (record) =>
          record.type === EVG_DATA_KIND.LocationMap &&
          record.key === chapterId
      ) ?? null

    return candidate && isLocationMapRecord(candidate) ? candidate : null
  }

  const selectedChapter =
    chapters.find((chapter) => chapter.id === selectedChapterId) ?? null
  const selectedScene: SceneSummary | null =
    selectedChapter
      ? scenes.find((scene) => scene.id === selectedChapter.sceneId) ?? null
      : null

  const mapRecord = selectedChapter ? findMapRecord(selectedChapter.id) : null

  const hotspots: SceneHotspot[] = mapRecord ? mapRecord.data.hotspots : []

  const selectedHotspot =
    hotspots.find((hotspot) => hotspot.id === selectedHotspotId) ?? null

  // 热点事件动作链中 CallFragment 的章节静态检查（只读提示）
  const selectedHotspotFragmentIssues =
    selectedHotspot && mapRecord
      ? collectHotspotFragmentIssues(
          mapRecord.data.chapterId,
          selectedHotspot,
          records,
          chapters
        )
      : []

  const conditionOptions: ConditionOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Condition)
    .map((record) => ({ key: record.key, label: record.key }))

  const actionOptions: ActionOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Action)
    .map((record) => ({ key: record.key, label: record.key }))

  const eventOptions: EventOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Event)
    .map((record) => ({ key: record.key, label: record.key }))

  const contextChapter = contextMenu
    ? chapters.find((chapter) => chapter.id === contextMenu.chapterId) ?? null
    : null
  const contextMap = contextChapter ? findMapRecord(contextChapter.id) : null
  const contextScene = contextChapter
    ? scenes.find((scene) => scene.id === contextChapter.sceneId) ?? null
    : null

  const commitMap = (nextMap: LocationMap): void => {
    if (mapRecord && isLocationMapRecord(mapRecord)) {
      setRecords(
        records.map((record) =>
          record.id === mapRecord.id ? { ...record, data: nextMap } : record
        )
      )
      return
    }

    setRecords([
      ...records,
      {
        id: createGuid(),
        key: nextMap.chapterId,
        type: EVG_DATA_KIND.LocationMap,
        data: nextMap
      } as LocationMapRecord
    ])
  }

  /** 以当前地图数据为基础替换热点数组，保留 label / disabled 等地点属性。 */
  const commitHotspots = (nextHotspots: SceneHotspot[]): void => {
    if (!selectedChapter || !mapRecord) return

    commitMap({
      ...mapRecord.data,
      chapterId: selectedChapter.id,
      sceneId: selectedChapter.sceneId,
      hotspots: nextHotspots
    })
  }

  /** 更新地点级属性（显示名 / 禁用）。 */
  const updateLocationMeta = (
    patch: Partial<Pick<LocationMap, 'label' | 'disabled'>>
  ): void => {
    if (!selectedChapter || !mapRecord) return

    commitMap({
      ...mapRecord.data,
      chapterId: selectedChapter.id,
      sceneId: selectedChapter.sceneId,
      ...patch
    })
  }

  /** 更新进入触发事件链（undefined = 无触发，写盘时省略字段）。 */
  const updateEnterTriggers = (onEnter: EventBinding[] | undefined): void => {
    if (!selectedChapter || !mapRecord) return

    commitMap({
      ...mapRecord.data,
      chapterId: selectedChapter.id,
      sceneId: selectedChapter.sceneId,
      onEnter
    })
  }

  const updateHotspot = (
    hotspotId: string,
    patch: Partial<SceneHotspot>
  ): void => {
    if (!selectedChapter) return

    commitHotspots(
      hotspots.map((hotspot) =>
        hotspot.id === hotspotId ? { ...hotspot, ...patch } : hotspot
      )
    )
  }

  const addHotspotAt = (
    tool: Exclude<SceneTool, 'select'>,
    x: number,
    y: number
  ): void => {
    if (!selectedChapter) return

    const hotspot: SceneHotspot = {
      id: createGuid(),
      label: `热点 ${hotspots.length + 1}`,
      enabled: true,
      shape: createHotspotShape(tool, x, y)
    }

    commitHotspots([...hotspots, hotspot])
    setSelectedHotspotId(hotspot.id)
    setTool('select')
  }

  const removeHotspot = (hotspotId: string): void => {
    if (!selectedChapter) return

    commitHotspots(
      hotspots.filter((hotspot) => hotspot.id !== hotspotId)
    )

    if (selectedHotspotId === hotspotId) {
      setSelectedHotspotId(null)
    }
  }

  const deleteHotspotMapForChapter = (chapterId: string): void => {
    const record = findMapRecord(chapterId)
    if (!record) return

    setRecords(records.filter((item) => item.id !== record.id))

    if (selectedChapterId === chapterId) {
      setSelectedHotspotId(null)
      setExpanded(false)
    }

    setDeleteMapTarget(null)
    setContextMenu(null)
  }

  const confirmDeleteHotspotMap = (): void => {
    if (!deleteMapTarget) return
    deleteHotspotMapForChapter(deleteMapTarget.chapterId)
  }

  const activateHotspotsForChapter = (chapterId: string): void => {
    const chapter = chapters.find((item) => item.id === chapterId) ?? null
    if (!chapter) return

    const scene = scenes.find((item) => item.id === chapter.sceneId) ?? null
    if (!scene || findMapRecord(chapterId)) return

    setRecords([
      ...records,
      {
        id: createGuid(),
        key: chapter.id,
        type: EVG_DATA_KIND.LocationMap,
        data: {
          chapterId: chapter.id,
          sceneId: chapter.sceneId,
          disabled: false,
          hotspots: []
        }
      } as LocationMapRecord
    ])

    setSelectedChapterId(chapter.id)
    setSelectedHotspotId(null)
    setTool('select')
    setContextMenu(null)
  }

  const activateHotspots = (): void => {
    if (!selectedChapter || !selectedScene || mapRecord) return
    activateHotspotsForChapter(selectedChapter.id)
  }

  const openChapterContextMenu = (
    event: ReactMouseEvent<HTMLElement>,
    chapterId: string
  ): void => {
    event.preventDefault()
    setSelectedChapterId(chapterId)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      chapterId
    })
  }

  const handlePreviewContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>
  ): void => {
    if (!selectedChapter || !mapRecord) return

    event.preventDefault()
    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return

    const nx = clamp01((event.clientX - rect.left) / rect.width)
    const ny = clamp01((event.clientY - rect.top) / rect.height)
    setSceneContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: 'blank',
      nx,
      ny
    })
  }

  const handleHotspotContextMenu = (
    event: ReactMouseEvent<HTMLDivElement>,
    hotspotId: string
  ): void => {
    event.preventDefault()
    setSelectedHotspotId(hotspotId)
    setSceneContextMenu({
      x: event.clientX,
      y: event.clientY,
      kind: 'hotspot',
      hotspotId
    })
  }

  const handlePreviewClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (tool === 'select' || !selectedChapter) return

    const rect = previewRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || rect.height === 0) return

    const x = clamp01((event.clientX - rect.left) / rect.width)
    const y = clamp01((event.clientY - rect.top) / rect.height)
    addHotspotAt(tool, x, y)
  }

  const handleHotspotPointerDown = (
    hotspot: SceneHotspot,
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    event.stopPropagation()
    setSelectedHotspotId(hotspot.id)

    if (event.button !== 0 || tool !== 'select') return

    const position = getShapePosition(hotspot.shape)
    dragRef.current = {
      hotspotId: hotspot.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y
    }

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleHotspotPointerMove = (
    hotspot: SceneHotspot,
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    const drag = dragRef.current
    if (!drag || drag.hotspotId !== hotspot.id) return

    const dx =
      previewSize.width > 0
        ? (event.clientX - drag.startClientX) / previewSize.width
        : 0
    const dy =
      previewSize.height > 0
        ? (event.clientY - drag.startClientY) / previewSize.height
        : 0

    const nextShape = clampShapePosition(
      hotspot.shape,
      drag.startX + dx,
      drag.startY + dy
    )

    updateHotspot(hotspot.id, { shape: nextShape })
  }

  const handleHotspotPointerUp = (
    hotspotId: string,
    event: ReactPointerEvent<HTMLDivElement>
  ): void => {
    if (dragRef.current?.hotspotId === hotspotId) {
      dragRef.current = null
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const resolution = currentProject?.resolution ?? {
    width: 1920,
    height: 1080
  }

  const deleteMapDialog = deleteMapTarget ? (
    <EditorDialog
      title="移除地点"
      closeDisabled={saving}
      onClose={() => setDeleteMapTarget(null)}
    >
      <div className="confirm-dialog">
        <p>
          确定移除章节 “{deleteMapTarget.chapterName}” 的地点数据吗？
          <br />
          其中的全部热点会一并移除；移除后需要点击保存，才会真正写回项目文件。
        </p>
        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={saving}
            onClick={() => setDeleteMapTarget(null)}
          >
            取消
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={saving}
            onClick={confirmDeleteHotspotMap}
          >
            删除
          </button>
        </div>
      </div>
    </EditorDialog>
  ) : null

  const sceneContextMenuElement =
    sceneContextMenu && selectedChapter && mapRecord
      ? createPortal(
          <div
            ref={sceneContextMenuRef}
            className="scene-context-menu"
            role="menu"
            style={{
              left: Math.min(sceneContextMenu.x, window.innerWidth - 190),
              top: Math.min(sceneContextMenu.y, window.innerHeight - 110)
            }}
          >
            {sceneContextMenu.kind === 'hotspot' ? (
              <button
                type="button"
                role="menuitem"
                className="scene-context-menu__item scene-context-menu__item--danger"
                onClick={() => {
                  if (sceneContextMenu.hotspotId) {
                    removeHotspot(sceneContextMenu.hotspotId)
                  }
                  setSceneContextMenu(null)
                }}
              >
                <TrashIcon size={14} />
                删除热点
              </button>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="scene-context-menu__item"
                  onClick={() => {
                    if (
                      sceneContextMenu.nx !== undefined &&
                      sceneContextMenu.ny !== undefined
                    ) {
                      addHotspotAt('circle', sceneContextMenu.nx, sceneContextMenu.ny)
                    }
                    setSceneContextMenu(null)
                  }}
                >
                  <CircleAddIcon size={14} />
                  插入圆形热点
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="scene-context-menu__item"
                  onClick={() => {
                    if (
                      sceneContextMenu.nx !== undefined &&
                      sceneContextMenu.ny !== undefined
                    ) {
                      addHotspotAt('rect', sceneContextMenu.nx, sceneContextMenu.ny)
                    }
                    setSceneContextMenu(null)
                  }}
                >
                  <RectAddIcon size={14} />
                  插入方形热点
                </button>
              </>
            )}
          </div>,
          document.body
        )
      : null

  if (!currentProject) {
    return (
      <section className="page scenes-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">EVG 数据</p>
            <h1>地点</h1>
            <p>打开项目后，可以按章节编辑地点与热点。chapter 即 location。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <FolderOpenIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑地点与热点。</p>
          <button
            type="button"
            className="button button--primary"
            disabled={appLoading}
            onClick={() => void openProject()}
          >
            <FolderOpenIcon />
            {appLoading ? '正在打开…' : '选择项目'}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setActivePage('home')}
          >
            返回首页
          </button>
        </div>
      </section>
    )
  }

  if (expanded && selectedChapter && selectedScene && mapRecord) {
    return (
      <div className="scenes-expanded">
        <header className="scenes-expanded__head">
          <div className="scenes-expanded__title">
            <strong>{selectedChapter.name}</strong>
            <span>scene：{selectedScene.name}</span>
          </div>

          <div className="scenes-editor-actions">
            <SceneToolSelector
              tool={tool}
              disabled={saving}
              onChange={setTool}
            />
            <button
              type="button"
              className={`icon-button icon-button--ghost${
                showSafeArea ? ' icon-button--active' : ''
              }`}
              disabled={saving}
              aria-label="Overlay 安全区"
              title="Overlay 安全区"
              onClick={() => setShowSafeArea((value) => !value)}
            >
              <FrameSafeIcon size={16} />
            </button>
            <button
              type="button"
              className="icon-button icon-button--ghost"
              disabled={saving}
              aria-label="退出扩大"
              title="退出扩大"
              onClick={() => setExpanded(false)}
            >
              <CollapseIcon size={16} />
            </button>
          </div>
        </header>

        <div className="scenes-expanded__meta">
          <LocationMetaRow
            map={mapRecord.data}
            chapterName={selectedChapter.name}
            disabled={saving}
            onChange={updateLocationMeta}
          />
          <LocationEnterTriggersEditor
            value={mapRecord.data.onEnter}
            variables={variables as ProjectVariable[]}
            chapters={chapters}
            conditions={conditionOptions}
            actions={actionOptions}
            events={eventOptions}
            disabled={saving}
            onChange={updateEnterTriggers}
          />
        </div>

        <ScheduleNoticeBar
          info={scheduleInfo}
          loading={scheduleLoading}
          locations={records.filter(isLocationMapRecord).map((record) => ({
            chapterId: record.key,
            disabled: record.data.disabled === true
          }))}
          chapterNames={new Map(chapters.map((chapter) => [chapter.id, chapter.name]))}
          onRefresh={() => void loadSchedule()}
        />

        <div className="scenes-expanded__body">
          <div className="scenes-expanded__preview">
            <p className="field-hint">
              {tool === 'select'
                ? '拖动热点调整位置；右侧列表可以切换当前热点。'
                : '在场景预览中点击放置热点。'}
            </p>

            <div
              className="scene-preview scene-preview--expanded"
              ref={previewRef}
              style={{
                aspectRatio: `${resolution.width} / ${resolution.height}`
              }}
              onClick={handlePreviewClick}
              onContextMenu={handlePreviewContextMenu}
            >
              {selectedScene.layers.map((layer) => (
                <SceneLayerImage
                  key={layer.id}
                  projectPath={currentProject.path}
                  layer={layer}
                />
              ))}

              {showSafeArea && (
                <SafeAreaView
                  previewWidth={previewSize.width}
                  resolutionWidth={resolution.width}
                />
              )}

              {previewSize.width > 0 &&
                previewSize.height > 0 &&
                hotspots.map((hotspot) => (
                  <HotspotShapeView
                    key={hotspot.id}
                    hotspot={hotspot}
                    previewWidth={previewSize.width}
                    previewHeight={previewSize.height}
                    selected={hotspot.id === selectedHotspotId}
                    onContextMenu={(event) =>
                      handleHotspotContextMenu(event, hotspot.id)
                    }
                    onPointerDown={(event) =>
                      handleHotspotPointerDown(hotspot, event)
                    }
                    onPointerMove={(event) =>
                      handleHotspotPointerMove(hotspot, event)
                    }
                    onPointerUp={(event) =>
                      handleHotspotPointerUp(hotspot.id, event)
                    }
                  />
                ))}
            </div>
          </div>

          <aside className="scenes-expanded__side">
            <h3>当前热点</h3>

            {hotspots.length === 0 ? (
              <div className="data-empty">这个地点还没有热点。</div>
            ) : (
              <div className="scenes-expanded__list">
                {hotspots.map((hotspot) => (
                  <button
                    key={hotspot.id}
                    type="button"
                    className={`scenes-expanded__item${
                      hotspot.id === selectedHotspotId
                        ? ' scenes-expanded__item--active'
                        : ''
                    }`}
                    onClick={() => setSelectedHotspotId(hotspot.id)}
                  >
                    <strong>{hotspot.label}</strong>
                    <span>
                      {hotspot.shape.kind === 'circle' ? '圆形' : '方框'} ·{' '}
                      {hotspot.enabled ? '启用' : '禁用'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedHotspot && (
              <div className="scenes-expanded__properties">
                <HotspotPropertyEditor
                  hotspot={selectedHotspot}
                  resolution={resolution}
                  variables={variables as ProjectVariable[]}
                  chapters={chapters}
                  conditions={conditionOptions}
                  actions={actionOptions}
                  events={eventOptions}
                  fragmentIssues={selectedHotspotFragmentIssues}
                  disabled={saving}
                  onChange={(patch) => updateHotspot(selectedHotspot.id, patch)}
                  onRemove={() => removeHotspot(selectedHotspot.id)}
                />
              </div>
            )}
          </aside>
        </div>

        {sceneContextMenuElement}

        {deleteMapDialog}
      </div>
    )
  }

  return (
    <section className="page scenes-page">
      <ScheduleNoticeBar
        info={scheduleInfo}
        loading={scheduleLoading}
        locations={records.filter(isLocationMapRecord).map((record) => ({
          chapterId: record.key,
          disabled: record.data.disabled === true
        }))}
        chapterNames={new Map(chapters.map((chapter) => [chapter.id, chapter.name]))}
        onRefresh={() => void loadSchedule()}
      />

      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">EVG 数据</p>
          <h1>场景热点</h1>
          <p title={currentProject.path}>
            按章节编辑地点与热点（chapter 即 location），保存后写入 evg-data 的 type=4 行。
          </p>
        </div>

        <div className="scenes-header__actions">
          <DraftHeaderActions
            dirty={dirty}
            saving={saving}
            onReload={() => void reloadRecords(currentProject.path)}
            onSave={() => void saveRecords()}
          />
        </div>
      </header>

      {errorMessage && (
        <div className="inline-notice" role="alert">
          <span>{errorMessage}</span>
          <button type="button" className="text-button" onClick={clearError}>
            关闭
          </button>
        </div>
      )}

      <div className="scenes-layout">
        <section className="section-card scenes-chapter-panel">
          <div className="section-card__head">
            <div>
              <h2>章节</h2>
              <p>共 {chapters.length} 章。</p>
            </div>
          </div>

          {chapters.length === 0 ? (
            <div className="data-empty">正在读取章节摘要…</div>
          ) : (
            <div className="scenes-chapter-list">
              {chapters.map((chapter) => {
                const candidate =
                  records.find(
                    (record) =>
                      record.type === EVG_DATA_KIND.LocationMap &&
                      record.key === chapter.id
                  ) ?? null
                const chapterMap =
                  candidate && isLocationMapRecord(candidate)
                    ? candidate
                    : null
                const hotspotCount = chapterMap?.data.hotspots.length ?? 0

                return (
                  <button
                    key={chapter.id}
                    type="button"
                    className={`scenes-chapter-item${
                      chapter.id === selectedChapterId
                        ? ' scenes-chapter-item--active'
                        : ''
                    }${chapterMap ? ' scenes-chapter-item--has-map' : ''}`}
                    onClick={() => setSelectedChapterId(chapter.id)}
                    onContextMenu={(event) =>
                      openChapterContextMenu(event, chapter.id)
                    }
                  >
                    <strong>{chapter.name}</strong>
                    <span>{chapter.id}</span>
                    {chapterMap && (
                      <em className="scenes-chapter-item__meta">
                        {hotspotCount > 0
                          ? `${hotspotCount} 个热点`
                          : '地点已启用'}
                      </em>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="section-card scenes-editor-panel">
          <div className="section-card__head">
            <div>
              <h2>{selectedChapter?.name ?? '场景预览'}</h2>
              <p>
                {selectedScene
                  ? `scene：${selectedScene.name}`
                  : '请选择一个章节'}
              </p>
            </div>

            <div className="scenes-editor-actions">
              {mapRecord && (
                <SceneToolSelector
                  tool={tool}
                  disabled={saving}
                  onChange={setTool}
                />
              )}
              {mapRecord && (
                <button
                  type="button"
                  className={`icon-button icon-button--ghost${
                    showSafeArea ? ' icon-button--active' : ''
                  }`}
                  disabled={saving}
                  aria-label="Overlay 安全区"
                  title="Overlay 安全区"
                  onClick={() => setShowSafeArea((value) => !value)}
                >
                  <FrameSafeIcon size={16} />
                </button>
              )}
              {mapRecord && (
                <button
                  type="button"
                  className="icon-button icon-button--ghost"
                  disabled={saving}
                  aria-label="扩大编辑"
                  title="扩大编辑"
                  onClick={() => setExpanded(true)}
                >
                  <ExpandIcon size={16} />
                </button>
              )}
            </div>
          </div>

          {selectedChapter && selectedScene && mapRecord ? (
            <>
              <LocationMetaRow
                map={mapRecord.data}
                chapterName={selectedChapter.name}
                disabled={saving}
                onChange={updateLocationMeta}
              />
              <LocationEnterTriggersEditor
                value={mapRecord.data.onEnter}
                variables={variables as ProjectVariable[]}
                chapters={chapters}
                conditions={conditionOptions}
                actions={actionOptions}
                events={eventOptions}
                disabled={saving}
                onChange={updateEnterTriggers}
              />
              <p className="field-hint">
                {tool === 'select'
                  ? '拖动热点调整位置；右侧可以修改尺寸和事件。'
                  : '在场景预览中点击放置热点。'}
              </p>

              <div
                className="scene-preview"
                ref={previewRef}
                style={{
                  aspectRatio: `${resolution.width} / ${resolution.height}`
                }}
                onClick={handlePreviewClick}
                onContextMenu={handlePreviewContextMenu}
              >
                {selectedScene.layers.map((layer) => (
                  <SceneLayerImage
                    key={layer.id}
                    projectPath={currentProject.path}
                    layer={layer}
                  />
                ))}

                {showSafeArea && (
                  <SafeAreaView
                    previewWidth={previewSize.width}
                    resolutionWidth={resolution.width}
                  />
                )}

                {previewSize.width > 0 &&
                  previewSize.height > 0 &&
                  hotspots.map((hotspot) => (
                    <HotspotShapeView
                      key={hotspot.id}
                      hotspot={hotspot}
                      previewWidth={previewSize.width}
                      previewHeight={previewSize.height}
                      selected={hotspot.id === selectedHotspotId}
                      onContextMenu={(event) =>
                        handleHotspotContextMenu(event, hotspot.id)
                      }
                      onPointerDown={(event) =>
                        handleHotspotPointerDown(hotspot, event)
                      }
                      onPointerMove={(event) =>
                        handleHotspotPointerMove(hotspot, event)
                      }
                      onPointerUp={(event) =>
                        handleHotspotPointerUp(hotspot.id, event)
                      }
                    />
                  ))}
              </div>
            </>
          ) : selectedChapter && selectedScene && !mapRecord ? (
            <div className="data-empty scenes-activation">
              <p>
                当前章节还不是地点。设为地点后才会读取场景画面并开始编辑。
              </p>
              <button
                type="button"
                className="button button--primary"
                disabled={saving}
                onClick={activateHotspots}
              >
                设为地点
              </button>
            </div>
          ) : (
            <div className="data-empty">
              当前章节没有找到对应的 scene，请检查 main fragment 的第一个
              scene block。
            </div>
          )}
        </section>

        <section className="section-card scenes-property-panel">
          <div className="section-card__head">
            <div>
              <h2>热点属性</h2>
              <p>尺寸以项目目标分辨率的 px 显示，保存时自动换算为归一化坐标。</p>
            </div>
          </div>

          {selectedHotspot ? (
            <HotspotPropertyEditor
              hotspot={selectedHotspot}
              resolution={resolution}
              variables={variables as ProjectVariable[]}
              chapters={chapters}
              conditions={conditionOptions}
              actions={actionOptions}
              events={eventOptions}
              fragmentIssues={selectedHotspotFragmentIssues}
              disabled={saving}
              onChange={(patch) => updateHotspot(selectedHotspot.id, patch)}
              onRemove={() => removeHotspot(selectedHotspot.id)}
            />
          ) : (
            <div className="data-empty">
              {mapRecord
                ? '从场景预览里选中一个热点，或先使用圆形 / 方框工具放置热点。'
                : '当前章节还不是地点。'}
            </div>
          )}
        </section>
      </div>

      {contextMenu &&
        contextChapter &&
        createPortal(
          <div
            ref={contextMenuRef}
            className="chapter-context-menu"
            role="menu"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 190),
              top: Math.min(contextMenu.y, window.innerHeight - 90)
            }}
          >
            {contextMap ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="chapter-context-menu__item"
                  onClick={() => {
                    setSelectedChapterId(contextChapter.id)
                    setContextMenu(null)
                  }}
                >
                  <PencilIcon size={14} />
                  编辑地点
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="chapter-context-menu__item chapter-context-menu__item--danger"
                  onClick={() => {
                    setDeleteMapTarget({
                      chapterId: contextChapter.id,
                      chapterName: contextChapter.name
                    })
                    setContextMenu(null)
                  }}
                >
                  <TrashIcon size={14} />
                  移除地点
                </button>
              </>
            ) : contextScene ? (
              <button
                type="button"
                role="menuitem"
                className="chapter-context-menu__item"
                onClick={() => activateHotspotsForChapter(contextChapter.id)}
              >
                <PlusIcon size={14} />
                设为地点
              </button>
            ) : (
              <div className="chapter-context-menu__empty">
                当前章节没有有效 scene
              </div>
            )}
          </div>,
          document.body
        )}

      {sceneContextMenuElement}

      {deleteMapDialog}
    </section>
  )
}
