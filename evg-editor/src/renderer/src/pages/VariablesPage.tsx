import { useEffect, useRef, useState } from 'react'
import type {
  AttributeType,
  AttributeValue,
  AttributeValueType
} from '../../../shared/attribute'
import type { ProjectVariable, VariableType } from '../../../shared/variable'
import {
  FolderOpenIcon,
  PlusIcon,
  TrashIcon,
  VariablesIcon
} from '../components/Icons'
import {
  AttributeEditor,
  type AttributePatch
} from '../components/data/AttributeEditor'
import { CharacterAttributeValueEditor } from '../components/data/CharacterAttributeValueEditor'
import { DraftHeaderActions } from '../components/data/DraftHeaderActions'
import { EditorDialog } from '../components/data/EditorDialog'
import { ReferenceDeleteDialog } from '../components/data/ReferenceDeleteDialog'
import { VariableEditor } from '../components/data/VariableEditor'
import {
  findVariableRefLocations,
  renameVariableReferences
} from '../lib/evgReferences'
import { RUNTIME_SYSTEM_SPECS } from '../../../shared/runtimeSystems'
import { isRuntimeVariableName } from '../../../shared/variable'
import { useAppStore } from '../stores/useAppStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import {
  useVariableEditorStore,
  type VariablePatch
} from '../stores/useVariableEditorStore'

/** 变量类型小标签（左列表卡片用）的文字；着色由 CSS 按类型处理。 */
const VARIABLE_TYPE_TAGS: Record<VariableType, string> = {
  string: '字符串',
  number: '数字',
  bool: '布尔',
  pending: '待定'
}

const ATTRIBUTE_TYPE_LABELS: Record<AttributeValueType, string> = {
  string: '字符串',
  number: '数字',
  bool: '布尔'
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return value === '' ? '""' : value
  if (typeof value === 'boolean') return value ? '真' : '假'
  return String(value)
}

function formatVariableValue(variable: ProjectVariable): string {
  return formatValue(variable.defaultValue)
}

function formatAttributeValue(definition: AttributeType): string {
  return formatValue(definition.defaultValue)
}

/**
 * 在内置系统清单里查找系统变量的声明者；动态生成的系统变量
 * （如物品系统的 evg.item.*，由运行数据配置派生）不在静态清单里，返回 null。
 */
function findSystemVariableOwner(
  name: string
): { system: string; variable: string } | null {
  for (const spec of RUNTIME_SYSTEM_SPECS) {
    const match = spec.variables.find((variable) => variable.name === name)
    if (match) {
      return { system: `${spec.label}（${spec.id}）`, variable: match.label }
    }
  }
  return null
}

/** 新建草稿用的唯一自动名：base 重复时追加 -2、-3… */
function uniqueDraftName(base: string, names: ReadonlyArray<string>): string {
  if (!names.includes(base)) return base
  let index = 2
  while (names.includes(`${base}-${index}`)) index += 1
  return `${base}-${index}`
}

type DeleteTarget =
  | { kind: 'variable'; id: string; name: string }
  | { kind: 'attribute'; id: string; name: string }
  | null

export function VariablesPage() {
  const currentProject = useAppStore((state) => state.currentProject)
  const setActivePage = useAppStore((state) => state.setActivePage)
  const openProject = useAppStore((state) => state.openProject)
  const appLoading = useAppStore((state) => state.loading)

  const variables = useVariableEditorStore((state) => state.variables)
  const attributeState = useVariableEditorStore((state) => state.attributeState)
  // evg-data 记录用于引用扫描与改名传递性改写；改名会把 evg-data 草稿置脏。
  const evgRecords = useEvgDataStore((state) => state.records)
  const evgDirty = useEvgDataStore((state) => state.dirty)
  const setEvgRecords = useEvgDataStore((state) => state.setRecords)
  const saveEvgRecords = useEvgDataStore((state) => state.saveRecords)
  const reloadEvgRecords = useEvgDataStore((state) => state.reload)
  const loading = useVariableEditorStore((state) => state.loading)
  const variablesFileExists = useVariableEditorStore(
    (state) => state.variablesFileExists
  )
  const saving = useVariableEditorStore((state) => state.saving)
  const dirtyVariables = useVariableEditorStore((state) => state.dirtyVariables)
  const dirtyAttributes = useVariableEditorStore((state) => state.dirtyAttributes)
  const errorMessage = useVariableEditorStore((state) => state.errorMessage)
  const load = useVariableEditorStore((state) => state.load)
  const reload = useVariableEditorStore((state) => state.reload)
  const unload = useVariableEditorStore((state) => state.unload)
  const saveChanged = useVariableEditorStore((state) => state.saveChanged)
  const addVariable = useVariableEditorStore((state) => state.addVariable)
  const updateVariable = useVariableEditorStore((state) => state.updateVariable)
  const removeVariable = useVariableEditorStore((state) => state.removeVariable)
  const addAttributeType = useVariableEditorStore((state) => state.addAttributeType)
  const updateAttributeType = useVariableEditorStore(
    (state) => state.updateAttributeType
  )
  const removeAttributeType = useVariableEditorStore(
    (state) => state.removeAttributeType
  )
  const setCharacterAttributeValue = useVariableEditorStore(
    (state) => state.setCharacterAttributeValue
  )
  const clearError = useVariableEditorStore((state) => state.clearError)

  const [activeTab, setActiveTab] = useState<'variables' | 'attributes'>(
    'variables'
  )
  const [selectedVariableId, setSelectedVariableId] = useState<string | null>(
    null
  )
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null)

  useEffect(() => {
    const path = currentProject?.path
    if (!path) {
      unload()
      return
    }

    void load(path)
  }, [currentProject?.path, load, unload])

  if (!currentProject) {
    return (
      <section className="page variables-page">
        <header className="page-hero page-hero--compact">
          <div>
            <p className="eyebrow">项目数据</p>
            <h1>变量与角色属性</h1>
            <p>打开项目后，可以在这里编辑变量和角色属性模板。</p>
          </div>
        </header>

        <div className="empty-state">
          <span className="empty-state__icon">
            <VariablesIcon size={28} />
          </span>
          <h3>尚未打开项目</h3>
          <p>请先选择一个项目目录，再编辑其中的变量与角色属性。</p>
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

  const definitions = attributeState?.definitions ?? []
  const characters = attributeState?.characters ?? []
  // 改名的传递性改写会弄脏共享的 evg-data 草稿，纳入本页的保存 / 回滚。
  const dirty = dirtyVariables || dirtyAttributes || evgDirty

  const userVariables = variables.filter(
    (variable) => !isRuntimeVariableName(variable.name)
  )
  const systemVariables = variables.filter((variable) =>
    isRuntimeVariableName(variable.name)
  )

  const editingVariable =
    selectedVariableId !== null
      ? variables.find((variable) => variable.id === selectedVariableId) ?? null
      : null

  const editingAttribute =
    selectedAttributeId !== null
      ? definitions.find((definition) => definition.id === selectedAttributeId) ??
        null
      : null

  const selectedVariableRefs =
    editingVariable !== null
      ? findVariableRefLocations(evgRecords, editingVariable.name)
      : []

  // 名字被清空的中间态下引用还指着上一个有效名字；改名的源名以它为准。
  const lastNameRef = useRef('')
  useEffect(() => {
    if (editingVariable && editingVariable.name.trim() !== '') {
      lastNameRef.current = editingVariable.name
    }
  }, [editingVariable])
  const systemVariableOwner = editingVariable
    ? findSystemVariableOwner(editingVariable.name)
    : null

  const renderVariableRow = (variable: ProjectVariable) => {
    const active = selectedVariableId === variable.id

    return (
      <article
        key={variable.id}
        className={`data-item data-item--selectable${
          active ? ' data-item--active' : ''
        }`}
        onClick={() => setSelectedVariableId(variable.id)}
      >
        <div className="data-item__body">
          <div className="data-item__title">
            <strong>{variable.name}</strong>
          </div>
          <div className="data-item__meta">
            <span className={`type-tag type-tag--${variable.type}`}>
              {VARIABLE_TYPE_TAGS[variable.type]}
            </span>
            <span>默认值：{formatVariableValue(variable)}</span>
          </div>
        </div>

        <div className="data-item__actions">
          {variable.persistence === 'shared' && (
            <span className="badge badge--muted" title="跨存档（shared）">
              跨存档
            </span>
          )}
          {!isRuntimeVariableName(variable.name) && (
            <button
              type="button"
              className="icon-button icon-button--danger"
              title="删除"
              aria-label={`删除变量 ${variable.name}`}
              onClick={(event) => {
                event.stopPropagation()
                confirmRemoveVariable(variable)
              }}
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </article>
    )
  }

  const renderAttributeRow = (definition: AttributeType) => {
    const active = selectedAttributeId === definition.id

    return (
      <article
        key={definition.id}
        className={`data-item data-item--selectable${
          active ? ' data-item--active' : ''
        }`}
        onClick={() => setSelectedAttributeId(definition.id)}
      >
        <div className="data-item__body">
          <div className="data-item__title">
            <strong>{definition.name}</strong>
          </div>
          <div className="data-item__meta">
            <span className={`type-tag type-tag--${definition.type}`}>
              {ATTRIBUTE_TYPE_LABELS[definition.type]}
            </span>
            <span>默认值：{formatAttributeValue(definition)}</span>
          </div>
        </div>

        <div className="data-item__actions">
          <button
            type="button"
            className="icon-button icon-button--danger"
            title="删除"
            aria-label={`删除属性 ${definition.name}`}
            onClick={(event) => {
              event.stopPropagation()
              confirmRemoveAttribute(definition)
            }}
          >
            <TrashIcon />
          </button>
        </div>
      </article>
    )
  }

  // 新建 = 直接创建草稿条目并选中；写盘统一由右上角「保存」负责。
  const addNewVariable = (): void => {
    const created = addVariable({
      name: uniqueDraftName(
        'new-variable',
        variables.map((variable) => variable.name)
      ),
      type: 'string',
      persistence: 'slot'
    })
    if (created) setSelectedVariableId(created.id)
  }

  const updateSelectedVariable = (patch: VariablePatch): void => {
    if (selectedVariableId === null) return
    const current = variables.find(
      (variable) => variable.id === selectedVariableId
    )
    if (!current) return

    // 改名的传递性同步：evg-data 草稿中的引用一并改写。系统变量只读
    // 正常不会走到；名字被清空的中间态不改写，源名取 lastNameRef。
    if (
      patch.name !== undefined &&
      patch.name !== current.name &&
      !isRuntimeVariableName(current.name) &&
      patch.name.trim() !== ''
    ) {
      const source =
        current.name.trim() !== '' ? current.name : lastNameRef.current
      if (source !== '' && source !== patch.name) {
        const result = renameVariableReferences(evgRecords, source, patch.name)
        if (result.changed) setEvgRecords(result.records)
      }
    }

    updateVariable(selectedVariableId, patch)
  }

  const addNewAttribute = (): void => {
    const created = addAttributeType({
      name: uniqueDraftName(
        'new-attribute',
        definitions.map((definition) => definition.name)
      ),
      type: 'string'
    })
    if (created) setSelectedAttributeId(created.id)
  }

  const updateSelectedAttribute = (patch: AttributePatch): void => {
    if (!editingAttribute) return
    updateAttributeType(editingAttribute.id, {
      name: patch.name ?? editingAttribute.name,
      type: patch.type ?? editingAttribute.type,
      defaultValue: patch.defaultValue ?? editingAttribute.defaultValue
    })
  }

  const confirmRemoveVariable = (variable: ProjectVariable): void => {
    setDeleteTarget({
      kind: 'variable',
      id: variable.id,
      name: variable.name
    })
  }

  const confirmRemoveAttribute = (definition: AttributeType): void => {
    setDeleteTarget({
      kind: 'attribute',
      id: definition.id,
      name: definition.name
    })
  }

  const handleSave = async (): Promise<void> => {
    await saveChanged()
    if (useEvgDataStore.getState().dirty) {
      await saveEvgRecords()
    }
  }

  const handleRevert = async (): Promise<void> => {
    await reload(currentProject.path)
    await reloadEvgRecords(currentProject.path)
  }

  // 删除只改草稿；写盘仍由「保存」统一负责，因此随时可以「取消修改」回滚。
  const handleConfirmDelete = (): void => {
    if (!deleteTarget) return

    if (deleteTarget.kind === 'variable') {
      removeVariable(deleteTarget.id)
      if (selectedVariableId === deleteTarget.id) {
        setSelectedVariableId(null)
      }
    } else {
      removeAttributeType(deleteTarget.name)
      if (selectedAttributeId === deleteTarget.id) {
        setSelectedAttributeId(null)
      }
    }
    setDeleteTarget(null)
  }

  return (
    <section className="page variables-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">项目数据</p>
          <h1>变量与角色属性</h1>
          <p title={currentProject.path}>
            当前项目：{currentProject.name}。编辑会暂存为页面草稿，点击右上角
            “保存”写回 project.variables.json 与 characters.json。
          </p>
        </div>
        <div className="variables-header__actions">
          {loading && <span className="status-pill">读取中…</span>}
          <DraftHeaderActions
            dirty={dirty}
            saving={saving}
            onReload={() => void handleRevert()}
            onSave={() => void handleSave()}
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

      <div className="variables-tabs">
        <div
          className="segmented variables-tabs__switch"
          role="tablist"
          aria-label="变量页面签"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'variables'}
            className={`segmented__item${
              activeTab === 'variables' ? ' segmented__item--active' : ''
            }`}
            onClick={() => setActiveTab('variables')}
          >
            变量
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'attributes'}
            className={`segmented__item${
              activeTab === 'attributes' ? ' segmented__item--active' : ''
            }`}
            onClick={() => setActiveTab('attributes')}
          >
            角色属性模板
          </button>
        </div>

        {activeTab === 'variables' && !variablesFileExists && (
          <div className="variables-locked">
            <span className="empty-state__icon">
              <VariablesIcon size={28} />
            </span>
            <h3>工程还没有变量文件</h3>
            <p>
              project.variables.json 由引擎在设置变量时创建。请先到引擎编辑器里
              设置任意一个变量（例如把一个变量拖进剧情），然后回到本页或点击右上角“取消修改”刷新。
            </p>
          </div>
        )}

        {activeTab === 'variables' && variablesFileExists && (
          <div className="master-detail-layout">
            <section className="section-card master-detail-list-panel">
              <div className="section-card__head">
                <div>
                  <h2>项目变量</h2>
                  <p>对应 project.variables.json；变量名在项目内唯一。</p>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={loading}
                  onClick={addNewVariable}
                >
                  <PlusIcon />
                  添加
                </button>
              </div>

              {variables.length === 0 ? (
                <div className="data-empty">还没有变量，点击上方“添加”。</div>
              ) : (
                <div className="master-detail-list">
                  {systemVariables.length === 0 ? (
                    userVariables.map(renderVariableRow)
                  ) : (
                    <>
                      {userVariables.length > 0 && (
                        <>
                          <p className="variables-group-label">用户变量</p>
                          {userVariables.map(renderVariableRow)}
                        </>
                      )}
                      <p className="variables-group-label">
                        系统变量 · 由运行时子系统声明
                      </p>
                      {systemVariables.map(renderVariableRow)}
                    </>
                  )}
                </div>
              )}
            </section>

            <section className="section-card master-detail-editor-panel">
              {editingVariable ? (
                <>
                  <div className="section-card__head">
                    <div>
                      <h2>编辑变量</h2>
                      <p>修改会暂存为草稿，点击右上角“保存”写回文件。</p>
                    </div>
                  </div>

                  {isRuntimeVariableName(editingVariable.name) && (
                    <div className="variable-system-hint">
                      <p>
                        {systemVariableOwner
                          ? `该变量由 ${systemVariableOwner.system} 声明（${systemVariableOwner.variable}），此处只读；缺失 / 类型不符的修复请使用主页的“系统变量”同步。`
                          : 'EVG 系统变量（evg. 前缀）由运行时扩展声明（如物品系统的 evg.item.* 由运行数据配置生成），此处只读。'}
                      </p>
                    </div>
                  )}

                  <VariableEditor
                    value={editingVariable}
                    variables={variables}
                    disabled={loading}
                    readOnly={isRuntimeVariableName(editingVariable.name)}
                    onChange={updateSelectedVariable}
                  />

                  <div className="editor-subsection">
                    <h3>引用位置</h3>
                    {selectedVariableRefs.length === 0 ? (
                      <p className="editor-subsection__empty">
                        没有被条件 / 动作 / 事件引用。
                      </p>
                    ) : (
                      <ul className="editor-subsection__list">
                        {selectedVariableRefs.map((ref, index) => (
                          <li key={`${ref.recordId}-${index}`}>
                            <strong>{ref.target}</strong>
                            <span>{ref.location}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="editor-subsection__note">
                      重命名会自动同步 evg-data 中的这些引用（引擎剧本内的变量引用除外），保存后生效。
                    </p>
                  </div>
                </>
              ) : (
                <div className="data-empty">
                  从左侧选择一个变量，或点击“添加”。
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === 'attributes' && (
          <div className="master-detail-layout">
            <section className="section-card master-detail-list-panel">
              <div className="section-card__head">
                <div>
                  <h2>角色属性模板</h2>
                  <p>对应 characters.json 的 attributeTemplate。</p>
                </div>
                <button
                  type="button"
                  className="button button--primary"
                  disabled={loading}
                  onClick={addNewAttribute}
                >
                  <PlusIcon />
                  添加
                </button>
              </div>

              {definitions.length === 0 ? (
                <div className="data-empty">
                  还没有角色属性模板，点击上方“添加”。
                </div>
              ) : (
                <div className="master-detail-list">
                  {definitions.map(renderAttributeRow)}
                </div>
              )}
            </section>

            <section className="section-card master-detail-editor-panel">
              {editingAttribute ? (
                <>
                  <div className="section-card__head">
                    <div>
                      <h2>编辑属性</h2>
                      <p>修改会暂存为草稿，点击右上角“保存”写回文件。</p>
                    </div>
                  </div>

                  <AttributeEditor
                    value={editingAttribute}
                    definitions={definitions}
                    disabled={loading}
                    onChange={updateSelectedAttribute}
                  />

                  <div className="editor-subsection">
                    <h3>角色初始值</h3>
                    {characters.length === 0 ? (
                      <p className="editor-subsection__empty">
                        characters.json 中还没有角色。
                      </p>
                    ) : (
                      <div className="attribute-characters">
                        {characters.map((character) => {
                          const hasExplicitValue =
                            character.attributeValues[
                              editingAttribute.name
                            ] !== undefined

                          return (
                            <div
                              key={character.id}
                              className={`attribute-character${
                                hasExplicitValue
                                  ? ' attribute-character--overridden'
                                  : ' attribute-character--inherited'
                              }`}
                            >
                              <div className="attribute-character__meta">
                                <span
                                  className="attribute-character__name"
                                  title={character.id}
                                >
                                  {character.name || character.id}
                                </span>
                                <span
                                  className={`attribute-character__state${
                                    hasExplicitValue
                                      ? ' attribute-character__state--overridden'
                                      : ' attribute-character__state--inherited'
                                  }`}
                                >
                                  {hasExplicitValue ? '已设置' : '跟随默认值'}
                                </span>
                              </div>
                              <CharacterAttributeValueEditor
                                definition={editingAttribute}
                                character={character}
                                disabled={loading}
                                onChange={(value: AttributeValue | undefined) =>
                                  setCharacterAttributeValue(
                                    character.id,
                                    editingAttribute.name,
                                    value
                                  )
                                }
                              />
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <p className="editor-subsection__note">
                      未设置初始值的角色使用模板默认值。
                    </p>
                  </div>
                </>
              ) : (
                <div className="data-empty">
                  从左侧选择一个属性，或点击“添加”。
                </div>
              )}
            </section>
          </div>
        )}

      </div>

      {deleteTarget && deleteTarget.kind === 'variable' && (
        <ReferenceDeleteDialog
          title="删除变量"
          kindLabel="变量"
          targetName={deleteTarget.name}
          references={findVariableRefLocations(evgRecords, deleteTarget.name)}
          cascadeEnabled={false}
          busy={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {deleteTarget && deleteTarget.kind === 'attribute' && (
        <EditorDialog
          title="删除属性模板"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="confirm-dialog">
            <p>
              确定删除属性模板 “{deleteTarget.name}” 吗？
              <br />
              删除后需要点击右上角“保存”才会写回项目文件；保存前可随时用
              “取消修改”回滚。
            </p>
            <div className="confirm-dialog__actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setDeleteTarget(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={handleConfirmDelete}
              >
                删除
              </button>
            </div>
          </div>
        </EditorDialog>
      )}
    </section>
  )
}
