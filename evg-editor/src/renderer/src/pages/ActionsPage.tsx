import { useEffect, useState } from 'react'
import type { EvgDataRecord } from '../../../shared/database'
import { EVG_DATA_KIND } from '../../../shared/evgData'
import { createGuid } from '../../../shared/variable'
import type { ProjectVariable } from '../../../shared/variable'
import { FolderOpenIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { ReferenceDeleteDialog } from '../components/data/ReferenceDeleteDialog'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import { ActionEditor } from '../components/evg/action/ActionEditor'
import {
  countSameTypeKey,
  findActionRefLocations,
  removeActionReferences
} from '../lib/evgReferences'
import {
  createDefaultAction,
  getActionSummary,
  type ActionValue
} from '../components/evg/action/actionOptions'
import type { ConditionOption } from '../components/evg/condition/ConditionEditor'
import { useAppStore } from '../stores/useAppStore'
import { useChapterStore } from '../stores/useChapterStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import { useVariableEditorStore } from '../stores/useVariableEditorStore'

type ActionRecord = EvgDataRecord & { type: 2; data: ActionValue }

function isActionRecord(record: EvgDataRecord): record is ActionRecord {
  return (
    record.type === EVG_DATA_KIND.Action &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

function createActionRecord(): ActionRecord {
  const key = `effect-${createGuid().slice(0, 8)}`

  return {
    id: createGuid(),
    key,
    type: EVG_DATA_KIND.Action,
    data: createDefaultAction(key)
  } as ActionRecord
}

export function ActionsPage() {
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
  const [deleteTarget, setDeleteTarget] = useState<ActionRecord | null>(null)

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
      <section className="page actions-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">EVG 数据</p>
            <h1>动作</h1>
            <p>打开项目后，可以在这里集中管理动作定义。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <FolderOpenIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑其中的动作定义。</p>
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

  const actions = records.filter(isActionRecord)
  const selected = actions.find((effect) => effect.id === selectedId) ?? null

  const conditionOptions: ConditionOption[] = records
    .filter((record) => record.type === EVG_DATA_KIND.Condition)
    .map((record) => ({ key: record.key, label: record.key }))

  // 待删除动作被事件 actions 列表引用的位置。
  const deleteReferences = deleteTarget
    ? findActionRefLocations(records, deleteTarget.key)
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

  const addAction = (): void => {
    const next = createActionRecord()
    setRecords([...records, next])
    setSelectedId(next.id)
  }

  const updateActionKey = (id: string, key: string): void => {
    setRecords(
      records.map((record) =>
        record.id === id
          ? {
              ...record,
              key,
              data: { ...(record.data as ActionValue), id: key }
            }
          : record
      )
    )
  }

  const updateAction = (id: string, data: ActionValue): void => {
    setRecords(
      records.map((record) =>
        record.id === id ? { ...record, data } : record
      )
    )
  }

  return (
    <section className="page actions-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">EVG 数据</p>
          <h1>动作</h1>
          <p title={currentProject.path}>
            管理 evg-data 中 type=Action 的定义，保存后写回数据库文件。
          </p>
        </div>

        <div className="actions-header__actions">
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

      <div className="actions-layout">
        <section className="section-card actions-list-panel">
          <div className="section-card__head">
            <div>
              <h2>动作列表</h2>
              <p>共 {actions.length} 条。</p>
            </div>
            <button
              type="button"
              className="button button--primary"
              disabled={loading || saving}
              onClick={addAction}
            >
              <PlusIcon />
              添加
            </button>
          </div>

          {actions.length === 0 ? (
            <div className="data-empty">还没有动作定义。</div>
          ) : (
            <div className="actions-list">
              {actions.map((effect) => (
                <div key={effect.id} className="actions-list__row">
                  <button
                    type="button"
                    className={`actions-list__item${
                      effect.id === selectedId
                        ? ' actions-list__item--active'
                        : ''
                    }`}
                    onClick={() => setSelectedId(effect.id)}
                  >
                    <strong>{effect.key}</strong>
                    <span>{getActionSummary(effect.data)}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    aria-label={`删除动作 ${effect.key}`}
                    disabled={saving}
                    onClick={() => setDeleteTarget(effect)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card actions-editor-panel">
          {selected ? (
            <>
              <div className="section-card__head">
                <div>
                  <h2>编辑动作</h2>
                  <p>修改后点击右上角“保存”写回项目。</p>
                </div>
              </div>

              <label className="field">
                <span>动作 key</span>
                <input
                  className="field-input"
                  value={selected.key}
                  disabled={saving}
                  onChange={(event) =>
                    updateActionKey(selected.id, event.target.value)
                  }
                />
              </label>
              {keyWarning && (
                <p className="field-hint field-hint--warning">
                  {keyWarning}
                </p>
              )}

              <ActionEditor
                value={selected.data}
                variables={variables as ProjectVariable[]}
                chapters={chapters}
                conditions={conditionOptions}
                disabled={saving}
                onChange={(next) => updateAction(selected.id, next)}
              />
            </>
          ) : (
            <div className="data-empty">从左侧选择一个动作，或点击“添加”。</div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <ReferenceDeleteDialog
          title="删除动作"
          kindLabel="动作"
          targetName={deleteTarget.key}
          references={deleteReferences}
          cascadeEnabled
          cascadeHint="从引用它的 actions 列表中移除对应项（事件与热点内联事件都会检查）。"
          busy={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(mode) => {
            const base =
              mode === 'cascade'
                ? removeActionReferences(records, deleteTarget.key)
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
