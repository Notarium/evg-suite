import { useEffect, useMemo, useState } from 'react'
import {
  applyRuntimeSystemFix,
  buildItemVariableSystemSpec,
  buildWeatherVariableSystemSpec,
  diffAllRuntimeSystems,
  hasRuntimeIssues,
  RUNTIME_SYSTEM_SPECS,
  type RuntimeSystemDiff,
  type RuntimeSystemSpec,
  type RuntimeVariableStatus
} from '../../../../shared/runtimeSystems'
import {
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  type RuntimeConfigData
} from '../../../../shared/runtimeConfig'
import type { EvgDataRecord } from '../../../../shared/database'
import type { ProjectVariable } from '../../../../shared/variable'
import { EditorDialog } from '../data/EditorDialog'
import { VariablesIcon } from '../Icons'
import { useAppStore } from '../../stores/useAppStore'
import { useEvgDataStore } from '../../stores/useEvgDataStore'
import { useVariableEditorStore } from '../../stores/useVariableEditorStore'

/** 从 evg-data 的 runtime-config 行提取物品清单（id + 名称）。 */
function getInventoryItems(
  records: EvgDataRecord[]
): Array<{ id: string; name: string }> {
  for (const record of records) {
    if (
      record.type !== RUNTIME_CONFIG_DATA_TYPE ||
      record.key !== RUNTIME_CONFIG_ROW_KEY ||
      typeof record.data !== 'object' ||
      record.data === null ||
      Array.isArray(record.data)
    ) {
      continue
    }

    const items = (record.data as RuntimeConfigData).inventory?.items
    return Array.isArray(items)
      ? items.map((item) => ({ id: item.id, name: item.name }))
      : []
  }
  return []
}

/** runtime-config 行里的天气清单（id / name），供天气变量动态节用。 */
function getWeatherEntries(
  records: EvgDataRecord[]
): Array<{ id: string; name: string }> {
  for (const record of records) {
    if (
      record.type !== RUNTIME_CONFIG_DATA_TYPE ||
      record.key !== RUNTIME_CONFIG_ROW_KEY ||
      typeof record.data !== 'object' ||
      record.data === null ||
      Array.isArray(record.data)
    ) {
      continue
    }

    const weathers = (record.data as RuntimeConfigData).weather?.weathers
    return Array.isArray(weathers)
      ? weathers.map((entry) => ({ id: entry.id, name: entry.name }))
      : []
  }
  return []
}

const TYPE_LABELS: Record<string, string> = {
  string: '字符串',
  number: '数字',
  bool: '布尔',
  pending: '待定'
}

const PERSISTENCE_LABELS: Record<string, string> = {
  slot: '当前存档',
  shared: '跨存档'
}

const STATUS_LABELS: Record<RuntimeVariableStatus, string> = {
  ok: '就绪',
  missing: '缺失',
  'type-mismatch': '类型不符',
  'persistence-mismatch': '持久化不符'
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return `"${value}"`
  return String(value)
}

function describeVariable(variable: ProjectVariable): string {
  return `${TYPE_LABELS[variable.type] ?? variable.type} · ${formatValue(
    variable.defaultValue
  )} · ${PERSISTENCE_LABELS[variable.persistence] ?? variable.persistence}`
}

/**
 * 主页的 Runtime 系统变量面板：
 * 展示各 Runtime 子系统（时间 / 物品系统等）所需变量的就绪状态，
 * 并提供一键写入（新增缺失变量、修正类型 / 持久化不符）。
 * 声明清单见 src/shared/runtimeSystems.ts。
 */
export function RuntimeSystemsPanel() {
  const currentProject = useAppStore((state) => state.currentProject)
  const variables = useVariableEditorStore((state) => state.variables)
  const loading = useVariableEditorStore((state) => state.loading)
  const saving = useVariableEditorStore((state) => state.saving)
  const errorMessage = useVariableEditorStore((state) => state.errorMessage)
  const load = useVariableEditorStore((state) => state.load)
  const saveVariables = useVariableEditorStore((state) => state.saveVariables)
  const clearError = useVariableEditorStore((state) => state.clearError)

  const records = useEvgDataStore((state) => state.records)
  const loadRecords = useEvgDataStore((state) => state.load)
  const unloadRecords = useEvgDataStore((state) => state.unload)

  const [pendingSync, setPendingSync] = useState<RuntimeSystemDiff | 'all' | null>(
    null
  )

  useEffect(() => {
    const path = currentProject?.path
    if (path) {
      void load(path)
      void loadRecords(path)
    } else {
      unloadRecords()
    }
  }, [currentProject?.path, load, loadRecords, unloadRecords])

  // 物品 / 天气变量是项目数据驱动的动态清单：从 runtime-config 行现算。
  const specs = useMemo<readonly RuntimeSystemSpec[]>(() => {
    const dynamic = [buildItemVariableSystemSpec(getInventoryItems(records)), buildWeatherVariableSystemSpec(getWeatherEntries(records))]
    return [...RUNTIME_SYSTEM_SPECS, ...dynamic.filter((spec): spec is RuntimeSystemSpec => spec !== null)]
  }, [records])

  if (!currentProject) return null

  const diffs = diffAllRuntimeSystems(variables, specs)
  const anyIssue = diffs.some(hasRuntimeIssues)

  const syncTargets =
    pendingSync === 'all'
      ? diffs.filter(hasRuntimeIssues)
      : pendingSync
        ? [pendingSync]
        : []

  const additions = syncTargets.flatMap((diff) => diff.missing)
  const fixes = syncTargets.flatMap((diff) => diff.mismatched)

  const performSync = async (): Promise<void> => {
    let next = variables
    for (const diff of syncTargets) {
      next = applyRuntimeSystemFix(next, diff)
    }

    const ok = await saveVariables(next)
    if (ok) setPendingSync(null)
  }

  return (
    <section className="section-card runtime-panel">
      <div className="section-card__head">
        <div>
          <h2>Runtime 系统变量</h2>
          <p>
            Runtime 子系统（时间 / 物品系统等）运行所需的变量。缺失或类型不符时，
            可一键写入 project.variables.json。
          </p>
        </div>

        <button
          type="button"
          className="button button--primary"
          disabled={!anyIssue || saving || loading}
          onClick={() => setPendingSync('all')}
        >
          <VariablesIcon size={15} />
          全部同步
        </button>
      </div>

      {errorMessage && (
        <div className="inline-notice" role="alert">
          <span>{errorMessage}</span>
          <button type="button" className="text-button" onClick={clearError}>
            关闭
          </button>
        </div>
      )}

      {loading ? (
        <div className="data-empty">正在读取项目变量…</div>
      ) : (
        <div className="runtime-systems">
          {diffs.map((diff) => {
            const issueCount = diff.missing.length + diff.mismatched.length

            return (
              <div className="runtime-system" key={diff.system.id}>
                <div className="runtime-system__head">
                  <div className="runtime-system__title">
                    <strong>{diff.system.label}</strong>
                    {diff.system.description && <span>{diff.system.description}</span>}
                  </div>

                  <div className="runtime-system__actions">
                    {issueCount > 0 ? (
                      <span className="status-pill">
                        {issueCount} 项待处理
                      </span>
                    ) : (
                      <span className="runtime-status runtime-status--ok">
                        全部就绪
                      </span>
                    )}
                    <button
                      type="button"
                      className="button button--ghost"
                      disabled={issueCount === 0 || saving || loading}
                      onClick={() => setPendingSync(diff)}
                    >
                      同步变量
                    </button>
                  </div>
                </div>

                <div className="runtime-system__vars">
                  {diff.checks.map((check) => (
                    <div className="runtime-system__row" key={check.spec.name}>
                      <div className="runtime-system__var-name">
                        <code>{check.spec.name}</code>
                        <span>{check.spec.label}</span>
                      </div>

                      <div className="runtime-system__spec">
                        规范：{TYPE_LABELS[check.spec.type]} ={' '}
                        {formatValue(check.spec.defaultValue)} ·{' '}
                        {PERSISTENCE_LABELS[check.spec.persistence]}
                        {check.spec.description && (
                          <small>{check.spec.description}</small>
                        )}
                      </div>

                      <div className="runtime-system__current">
                        {check.existing
                          ? `当前：${describeVariable(check.existing)}`
                          : '当前：未定义'}
                      </div>

                      <span
                        className={`runtime-status runtime-status--${check.status}`}
                      >
                        {STATUS_LABELS[check.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendingSync && (
        <EditorDialog
          title="写入 Runtime 系统变量"
          closeDisabled={saving}
          onClose={() => setPendingSync(null)}
        >
          <div className="confirm-dialog">
            <p>
              将写入 project.variables.json（保留文件其它内容）：
            </p>

            {additions.length > 0 ? (
              <div className="runtime-sync-summary">
                <p>
                  <strong>新增 {additions.length} 个变量</strong>
                </p>
                <ul>
                  {additions.map((check) => (
                    <li key={check.spec.name}>
                      <code>{check.spec.name}</code> ·{' '}
                      {TYPE_LABELS[check.spec.type]} ={' '}
                      {formatValue(check.spec.defaultValue)} ·{' '}
                      {PERSISTENCE_LABELS[check.spec.persistence]}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {fixes.length > 0 ? (
              <div className="runtime-sync-summary">
                <p>
                  <strong>修正 {fixes.length} 个变量</strong>（类型 / 默认值 /
                  持久化范围将重置为规范值，变量名与已有数据中的引用不变）
                </p>
                <ul>
                  {fixes.map((check) => (
                    <li key={check.spec.name}>
                      <code>{check.spec.name}</code>：当前{' '}
                      {check.existing ? describeVariable(check.existing) : ''} →{' '}
                      {TYPE_LABELS[check.spec.type]} ={' '}
                      {formatValue(check.spec.defaultValue)} ·{' '}
                      {PERSISTENCE_LABELS[check.spec.persistence]}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {additions.length === 0 && fixes.length === 0 && (
              <p>没有需要写入的内容。</p>
            )}

            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--ghost"
                disabled={saving}
                onClick={() => setPendingSync(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="button button--primary"
                disabled={saving || (additions.length === 0 && fixes.length === 0)}
                onClick={() => void performSync()}
              >
                {saving ? '写入中…' : '确认写入'}
              </button>
            </div>
          </div>
        </EditorDialog>
      )}
    </section>
  )
}
