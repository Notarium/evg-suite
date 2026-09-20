import { useEffect, useState } from 'react'
import type { EvgDataRecord } from '../../../shared/database'
import { EVG_DATA_KIND, type EventType } from '../../../shared/evgData'
import { createGuid } from '../../../shared/variable'
import type { ProjectVariable } from '../../../shared/variable'
import { FolderOpenIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { ReferenceDeleteDialog } from '../components/data/ReferenceDeleteDialog'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import { EventEditor } from '../components/evg/event/EventEditor'
import {
  countSameTypeKey,
  findEventRefLocations,
  removeEventReferences
} from '../lib/evgReferences'
import {
  createDefaultEvent,
  getEventSummary
} from '../components/evg/event/eventOptions'
import type { ConditionOption } from '../components/evg/condition/ConditionEditor'
import type { ActionOption } from '../components/evg/action/actionOptions'
import { useAppStore } from '../stores/useAppStore'
import { useChapterStore } from '../stores/useChapterStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import { useVariableEditorStore } from '../stores/useVariableEditorStore'

type EventRecord = EvgDataRecord & { type: 1; data: EventType }

function isEventRecord(record: EvgDataRecord): record is EventRecord {
  return (
    record.type === EVG_DATA_KIND.Event &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

function createEventRecord(): EventRecord {
  const key = `event-${createGuid().slice(0, 8)}`

  return {
    id: createGuid(),
    key,
    type: EVG_DATA_KIND.Event,
    data: createDefaultEvent(key)
  } as EventRecord
}

export function EventsPage() {
  const currentProject = useAppStore((state) => state.currentProject)
  const setActivePage = useAppStore((state) => state.setActivePage)
  const openProject = useAppStore((state) => state.openProject)
  const appLoading = useAppStore((state) => state.loading)

  const records = useEvgDataStore((state) => state.records)
  const loading = useEvgDataStore((state) => state.loading)
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

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EventRecord | null>(null)

  useEffect(() => {
    const path = currentProject?.path
    if (!path) {
      unloadRecords()
      return
    }

    void loadRecords(path)
    void loadVariables(path)
    void loadChapters(path)
  }, [
    currentProject?.path,
    loadRecords,
    loadVariables,
    loadChapters,
    unloadRecords
  ])

  if (!currentProject) {
    return (
      <section className="page events-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">EVG 数据</p>
            <h1>事件</h1>
            <p>打开项目后，可以在这里集中管理事件定义。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <FolderOpenIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑其中的事件定义。</p>
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

  const events = records.filter(isEventRecord)
  const selected = events.find((event) => event.id === selectedId) ?? null

  const conditionOptions: ConditionOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Condition)
    .map((record) => ({ key: record.key, label: record.key }))

  const actionOptions: ActionOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Action)
    .map((record) => ({ key: record.key, label: record.key }))

  // 待删除事件被热点引用的位置。
  const deleteReferences = deleteTarget
    ? findEventRefLocations(records, deleteTarget.key)
    : []

  const sameKeyCount = selected
    ? countSameTypeKey(records, selected.type, selected.key)
    : 0
  const keyWarning = !selected
    ? null
    : selected.key.trim().length === 0
      ? 'key 不能为空，保存前必须填写。'
      : sameKeyCount > 1
        ? `同类型记录中有 ${sameKeyCount} 条使用相同 key，保存会被拒绝。`
        : null

  const addEvent = (): void => {
    const next = createEventRecord()
    setRecords([...records, next])
    setSelectedId(next.id)
  }

  const updateEventKey = (id: string, key: string): void => {
    setRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              key,
              data: { ...(record.data as EventType), id: key }
            }
          : record
      )
    )
  }

  const updateEvent = (id: string, data: EventType): void => {
    setRecords(
      records.map((record) =>
        record.id === id ? { ...record, data } : record
      )
    )
  }

  return (
    <section className="page events-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">EVG 数据</p>
          <h1>事件</h1>
          <p title={currentProject.path}>
            管理 evg-data 中 type=Event 的定义，保存后写回数据库文件。
          </p>
        </div>

        <div className="events-header__actions">
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

      <div className="events-layout">
        <section className="section-card events-list-panel">
          <div className="section-card__head">
            <div>
              <h2>事件列表</h2>
              <p>共 {events.length} 条。</p>
            </div>
            <button
              type="button"
              className="button button--primary"
              disabled={loading || saving}
              onClick={addEvent}
            >
              <PlusIcon />
              添加
            </button>
          </div>

          {events.length === 0 ? (
            <div className="data-empty">还没有事件定义。</div>
          ) : (
            <div className="events-list">
              {events.map((event) => (
                <div key={event.id} className="events-list__row">
                  <button
                    type="button"
                    className={`events-list__item${
                      event.id === selectedId
                        ? ' events-list__item--active'
                        : ''
                    }`}
                    onClick={() => setSelectedId(event.id)}
                  >
                    <strong>{event.key}</strong>
                    <span>{getEventSummary(event.data)}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    aria-label={`删除事件 ${event.key}`}
                    disabled={saving}
                    onClick={() => setDeleteTarget(event)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card events-editor-panel">
          {selected ? (
            <>
              <div className="section-card__head">
                <div>
                  <h2>编辑事件</h2>
                  <p>修改后点击右上角“保存”写回项目。</p>
                </div>
              </div>

              <label className="field">
                <span>事件 key</span>
                <input
                  className="field-input"
                  value={selected.key}
                  disabled={saving}
                  onChange={(event) =>
                    updateEventKey(selected.id, event.target.value)
                  }
                />
              </label>
              {keyWarning && (
                <p className="field-hint field-hint--warning">
                  {keyWarning}
                </p>
              )}

              <EventEditor
                value={selected.data}
                variables={variables as ProjectVariable[]}
                chapters={chapters}
                conditions={conditionOptions}
                actions={actionOptions}
                disabled={saving}
                onChange={(next) => updateEvent(selected.id, next)}
              />
            </>
          ) : (
            <div className="data-empty">从左侧选择一个事件，或点击“添加”。</div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <ReferenceDeleteDialog
          title="删除事件"
          kindLabel="事件"
          targetName={deleteTarget.key}
          references={deleteReferences}
          cascadeEnabled
          cascadeHint="解绑引用它的场景热点（热点保留，事件绑定置空）。"
          busy={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(mode) => {
            const base =
              mode === 'cascade'
                ? removeEventReferences(records, deleteTarget.key)
                : records
            const next = base.filter((record) => record.id !== deleteTarget.id)
            setRecords(next)
            if (selectedId === deleteTarget.id) setSelectedId(null)
            setDeleteTarget(null)
          }}
        />
      )}
    </section>
  )
}
