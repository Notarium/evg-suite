import { useEffect, useState } from 'react'
import type { EvgDataRecord } from '../../../shared/database'
import {
  EVG_DATA_KIND,
  type ConditionType
} from '../../../shared/evgData'
import { createGuid } from '../../../shared/variable'
import type { ProjectVariable } from '../../../shared/variable'
import { FolderOpenIcon, PlusIcon, TrashIcon } from '../components/Icons'
import { ReferenceDeleteDialog } from '../components/data/ReferenceDeleteDialog'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import { ConditionEditor } from '../components/evg/condition/ConditionEditor'
import { createDefaultCondition } from '../components/evg/condition/conditionOperators'
import {
  countSameTypeKey,
  findConditionRefLocations,
  removeConditionReferences
} from '../lib/evgReferences'
import { useAppStore } from '../stores/useAppStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import { useVariableEditorStore } from '../stores/useVariableEditorStore'

type ConditionRecord = EvgDataRecord & { type: 3; data: ConditionType }

function isConditionRecord(record: EvgDataRecord): record is ConditionRecord {
  return (
    record.type === EVG_DATA_KIND.Condition &&
    typeof record.data === 'object' &&
    record.data !== null &&
    !Array.isArray(record.data)
  )
}

function createConditionRecord(): ConditionRecord {
  return {
    id: createGuid(),
    key: `condition-${createGuid().slice(0, 8)}`,
    type: EVG_DATA_KIND.Condition,
    data: createDefaultCondition()
  } as ConditionRecord
}

function getConditionSummary(data: ConditionType): string {
  if (data.kind === 'predicate') {
    return data.operator
  }

  if (data.kind === 'constant') {
    return `constant · ${data.value ? 'true' : 'false'}`
  }

  return data.kind
}

export function ConditionsPage() {
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

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConditionRecord | null>(null)

  useEffect(() => {
    const path = currentProject?.path
    if (!path) {
      unloadRecords()
      return
    }

    void loadRecords(path)
    void loadVariables(path)
  }, [currentProject?.path, loadRecords, loadVariables, unloadRecords])

  if (!currentProject) {
    return (
      <section className="page conditions-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">EVG 数据</p>
            <h1>条件</h1>
            <p>打开项目后，可以在这里集中管理条件定义。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <FolderOpenIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑其中的条件定义。</p>
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

  const conditions = records.filter(isConditionRecord)
  const selected = conditions.find((condition) => condition.id === selectedId) ?? null
  const conditionOptions = conditions
    .filter((condition) => condition.id !== selected?.id)
    .map((condition) => ({ key: condition.key, label: condition.key }))

  // 待删除条件的引用位置；自身引用会随行一起删除，不进列表。
  const deleteReferences = deleteTarget
    ? findConditionRefLocations(records, deleteTarget.key).filter(
        (reference) => reference.recordId !== deleteTarget.id
      )
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

  const addCondition = (): void => {
    const next = createConditionRecord()
    setRecords([...records, next])
    setSelectedId(next.id)
  }

  const updateCondition = (
    id: string,
    patch: Partial<Pick<ConditionRecord, 'key' | 'data'>>
  ): void => {
    setRecords(
      records.map((record) => (record.id === id ? { ...record, ...patch } : record))
    )
  }

  return (
    <section className="page conditions-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">EVG 数据</p>
          <h1>条件</h1>
          <p title={currentProject.path}>
            管理 evg-data 中 type=Condition 的定义，保存后写回数据库文件。
          </p>
        </div>

        <div className="conditions-header__actions">
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

      <div className="conditions-layout">
        <section className="section-card conditions-list-panel">
          <div className="section-card__head">
            <div>
              <h2>条件列表</h2>
              <p>共 {conditions.length} 条。</p>
            </div>
            <button
              type="button"
              className="button button--primary"
              disabled={loading || saving}
              onClick={addCondition}
            >
              <PlusIcon />
              添加
            </button>
          </div>

          {conditions.length === 0 ? (
            <div className="data-empty">还没有条件定义。</div>
          ) : (
            <div className="conditions-list">
              {conditions.map((condition) => (
                <div key={condition.id} className="conditions-list__row">
                  <button
                    type="button"
                    className={`conditions-list__item${
                      condition.id === selectedId
                        ? ' conditions-list__item--active'
                        : ''
                    }`}
                    onClick={() => setSelectedId(condition.id)}
                  >
                    <strong>{condition.key}</strong>
                    <span>{getConditionSummary(condition.data)}</span>
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--danger"
                    aria-label={`删除条件 ${condition.key}`}
                    disabled={saving}
                    onClick={() => setDeleteTarget(condition)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section-card conditions-editor-panel">
          {selected ? (
            <>
              <div className="section-card__head">
                <div>
                  <h2>编辑条件</h2>
                  <p>修改后点击右上角“保存”写回项目。</p>
                </div>
              </div>

              <label className="field">
                <span>条件 key</span>
                <input
                  className="field-input"
                  value={selected.key}
                  disabled={saving}
                  onChange={(event) =>
                    updateCondition(selected.id, { key: event.target.value })
                  }
                />
              </label>
              {keyWarning && (
                <p className="field-hint field-hint--warning">
                  {keyWarning}
                </p>
              )}

              <ConditionEditor
                value={selected.data}
                variables={variables as ProjectVariable[]}
                conditionOptions={conditionOptions}
                disabled={saving}
                onChange={(next) => updateCondition(selected.id, { data: next })}
              />
            </>
          ) : (
            <div className="data-empty">从左侧选择一个条件，或点击“添加”。</div>
          )}
        </section>
      </div>

      {deleteTarget && (
        <ReferenceDeleteDialog
          title="删除条件"
          kindLabel="条件"
          targetName={deleteTarget.key}
          references={deleteReferences}
          cascadeEnabled
          cascadeHint="把引用它的 canExecute / guard 还原为“始终执行”，并从条件树中删除对应分支，清空的逻辑节点一并移除。"
          busy={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(mode) => {
            const base =
              mode === 'cascade'
                ? removeConditionReferences(records, deleteTarget.key)
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
