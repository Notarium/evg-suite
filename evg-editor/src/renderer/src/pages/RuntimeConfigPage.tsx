import { useEffect, useState } from 'react'
import type { EvgDataRecord } from '../../../shared/database'
import { EVG_DATA_KIND, type LocationMap } from '../../../shared/evgData'
import {
  createDefaultRuntimeConfig,
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  type RuntimeConfigData
} from '../../../shared/runtimeConfig'
import { createGuid } from '../../../shared/variable'
import { FolderOpenIcon, PlusIcon } from '../components/Icons'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import {
  InventoryConfigEditor
} from '../components/runtime/InventoryConfigEditor'
import {
  LocationConfigEditor,
  type GraphLocationNode
} from '../components/runtime/LocationConfigEditor'
import { TimeConfigEditor } from '../components/runtime/TimeConfigEditor'
import { WeatherConfigEditor } from '../components/runtime/WeatherConfigEditor'
import { useAppStore } from '../stores/useAppStore'
import { useChapterStore } from '../stores/useChapterStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'

type RuntimeConfigRecord = EvgDataRecord & {
  type: typeof RUNTIME_CONFIG_DATA_TYPE
  data: RuntimeConfigData
}

function isLocationMapData(record: EvgDataRecord): record is EvgDataRecord & {
  type: typeof EVG_DATA_KIND.LocationMap
  data: LocationMap
} {
  return (
    record.type === EVG_DATA_KIND.LocationMap &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

function isRuntimeConfigRecord(record: EvgDataRecord): record is RuntimeConfigRecord {
  return (
    record.type === RUNTIME_CONFIG_DATA_TYPE &&
    record.key === RUNTIME_CONFIG_ROW_KEY &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

/**
 * 运行数据配置页的页签。
 * 后续新增子系统（任务、好感度等）时，在 RuntimeConfigData 上扩展字段，
 * 并在这里追加页签即可。
 */
const CONFIG_TABS: ReadonlyArray<{
  key: keyof RuntimeConfigData
  label: string
  description: string
}> = [
  {
    key: 'time',
    label: '时间',
    description: '计时模式、起始日期、星期与单日时段。'
  },
  {
    key: 'inventory',
    label: '物品',
    description: '物品清单与堆叠规则。'
  },
  {
    key: 'weather',
    label: '天气',
    description: '天气类型与权重；时间推进时按权重 roll。'
  },
  {
    key: 'location',
    label: '地点',
    description: '初始地点与导航模板。'
  }
]

export function RuntimeConfigPage() {
  const currentProject = useAppStore((state) => state.currentProject)
  const setActivePage = useAppStore((state) => state.setActivePage)
  const openProject = useAppStore((state) => state.openProject)
  const appLoading = useAppStore((state) => state.loading)

  const records = useEvgDataStore((state) => state.records)
  const loading = useEvgDataStore((state) => state.loading)
  const chapters = useChapterStore((state) => state.chapters)
  const loadChapters = useChapterStore((state) => state.load)
  const saving = useEvgDataStore((state) => state.saving)
  const dirty = useEvgDataStore((state) => state.dirty)
  const errorMessage = useEvgDataStore((state) => state.errorMessage)
  const loadRecords = useEvgDataStore((state) => state.load)
  const unloadRecords = useEvgDataStore((state) => state.unload)
  const setRecords = useEvgDataStore((state) => state.setRecords)
  const saveRecords = useEvgDataStore((state) => state.saveRecords)
  const reloadRecords = useEvgDataStore((state) => state.reload)
  const clearError = useEvgDataStore((state) => state.clearError)

  const [activeTab, setActiveTab] = useState<keyof RuntimeConfigData>('time')

  useEffect(() => {
    const path = currentProject?.path
    if (!path) {
      unloadRecords()
      return
    }

    void loadRecords(path)
    void loadChapters(path)
  }, [currentProject?.path, loadRecords, loadChapters, unloadRecords])

  if (!currentProject) {
    return (
      <section className="page runtime-config-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">EVG 数据</p>
            <h1>运行数据配置</h1>
            <p>打开项目后，可以在这里维护 Runtime 子系统的运行设置。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <FolderOpenIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑运行数据配置。</p>
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

  const configRecord = records.find(isRuntimeConfigRecord) ?? null
  const config = configRecord?.data ?? null
  const activeTabMeta =
    CONFIG_TABS.find((tab) => tab.key === activeTab) ?? CONFIG_TABS[0]

  /** 地点候选：LocationMap 行 + label 回退章节名。 */
  const locationOptions: GraphLocationNode[] = records
    .filter(isLocationMapData)
    .map((record) => {
      const chapter = chapters.find(
        (item) => item.id === (record.data as LocationMap).chapterId
      )
      return {
        chapterId: record.data.chapterId,
        name: record.data.label ?? chapter?.name ?? record.data.chapterId,
        disabled: record.data.disabled ?? false
      }
    })

  const updateConfig = (partial: Partial<RuntimeConfigData>): void => {
    if (!configRecord || !config) return
    setRecords(
      records.map((record) =>
        record.id === configRecord.id
          ? { ...record, data: { ...config, ...partial } }
          : record
      )
    )
  }

  const createConfig = (): void => {
    if (configRecord) return
    setRecords([
      ...records,
      {
        id: createGuid(),
        key: RUNTIME_CONFIG_ROW_KEY,
        type: RUNTIME_CONFIG_DATA_TYPE,
        data: createDefaultRuntimeConfig()
      } as RuntimeConfigRecord
    ])
  }

  return (
    <section className="page runtime-config-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">EVG 数据</p>
          <h1>运行数据配置</h1>
          <p title={currentProject.path}>
            Runtime 子系统（时间 / 物品等）的运行设置，整体写入 evg-data 的
            type={RUNTIME_CONFIG_DATA_TYPE} 条目（key={RUNTIME_CONFIG_ROW_KEY}）。
          </p>
        </div>

        <div className="runtime-config-header__actions">
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

      {configRecord && config ? (
        <div className="runtime-config-layout">
          <div className="segmented runtime-config-tabs" role="tablist">
            {CONFIG_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`segmented__item${
                  activeTab === tab.key ? ' segmented__item--active' : ''
                }`}
                disabled={saving}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <section className="section-card runtime-config-panel">
            <div className="section-card__head">
              <div>
                <h2>{activeTabMeta.label}</h2>
                <p>{activeTabMeta.description}</p>
              </div>
            </div>

            {activeTab === 'time' && (
              <TimeConfigEditor
                config={config.time}
                disabled={saving}
                onChange={(time) => updateConfig({ time })}
              />
            )}
            {activeTab === 'inventory' && (
              <InventoryConfigEditor
                config={config.inventory}
                disabled={saving}
                onChange={(inventory) => updateConfig({ inventory })}
              />
            )}
            {activeTab === 'weather' && (
              <WeatherConfigEditor
                config={config.weather}
                disabled={saving}
                onChange={(weather) => updateConfig({ weather })}
              />
            )}
            {activeTab === 'location' && (
              <LocationConfigEditor
                config={config.location}
                locationOptions={locationOptions}
                disabled={saving}
                onChange={(location) => updateConfig({ location })}
              />
            )}
          </section>
        </div>
      ) : (
        <section className="section-card">
          {loading ? (
            <div className="data-empty">正在读取 evg-data…</div>
          ) : (
            <div className="empty-state runtime-config-empty">
              <span className="empty-state__icon">
                <PlusIcon size={24} />
              </span>
              <h3>还没有运行配置</h3>
              <p>
                创建一条默认配置（累计天数、周一起始、四个时段、空物品清单），
                修改后点击“保存”写入 evg-data。
              </p>
              <button
                type="button"
                className="button button--primary"
                disabled={saving}
                onClick={createConfig}
              >
                <PlusIcon />
                创建默认配置
              </button>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
