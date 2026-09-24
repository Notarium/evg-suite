import {
  EVG_ACTION_PURPOSE,
  type CallFragmentActionData,
  type CallExtensionMethodActionData,
  type CallSystemSlotActionData,
  type SetVariableActionData,
  type SetVariableOperation
} from '../../../../../shared/evgData'
import type { ChapterSummary } from '../../../../../shared/chapter'
import type { ProjectVariable } from '../../../../../shared/variable'
import type { ActionValue } from './actionOptions'
import { Combobox, type ComboboxOption } from '../Combobox'
import { VariableCombobox } from '../VariableCombobox'
import { ExtensionMethodEditor } from '../ExtensionMethodEditor'
import { ConditionOperandEditor } from '../condition/ConditionOperandEditor'
import type { LiteralKind } from '../condition/conditionTypeInference'
import { findRuntimeMethodSpec } from '../../../../../shared/runtimeMethods'

interface ActionDataEditorProps {
  value: ActionValue
  variables: ProjectVariable[]
  chapters?: ChapterSummary[]
  disabled?: boolean
  onChange: (value: ActionValue) => void
}

export function ActionDataEditor({
  value,
  variables,
  chapters = [],
  disabled = false,
  onChange
}: ActionDataEditorProps) {
  const updateData = (data: unknown): void => {
    onChange({ ...value, data })
  }

  switch (value.type) {
    case EVG_ACTION_PURPOSE.SetVariable:
      return (
        <SetVariableActionDataEditor
          data={value.data as unknown as SetVariableActionData}
          variables={variables}
          disabled={disabled}
          onChange={updateData}
        />
      )

    case EVG_ACTION_PURPOSE.CallFragment:
      return (
        <CallFragmentActionDataEditor
          data={value.data as unknown as CallFragmentActionData}
          chapters={chapters}
          disabled={disabled}
          onChange={updateData}
        />
      )

    case EVG_ACTION_PURPOSE.CallExtensionMethod:
      return (
        <CallExtensionMethodActionDataEditor
          data={value.data as unknown as CallExtensionMethodActionData}
          disabled={disabled}
          onChange={updateData}
        />
      )

    case EVG_ACTION_PURPOSE.CallSystemSlot:
      return (
        <CallSystemSlotActionDataEditor
          data={value.data as unknown as CallSystemSlotActionData}
          disabled={disabled}
          onChange={updateData}
        />
      )

    default:
      return <UnknownActionDataEditor value={value} />
  }
}

interface SetVariableActionDataEditorProps {
  data: SetVariableActionData
  variables: ProjectVariable[]
  disabled: boolean
  onChange: (data: SetVariableActionData) => void
}

function getTargetVariable(
  variable: string,
  variables: ProjectVariable[]
): ProjectVariable | null {
  return variables.find((item) => item.name === variable) ?? null
}

function expectedLiteralKindsForVariable(
  target: ProjectVariable | null
): LiteralKind[] | null {
  if (!target) return null

  if (target.type === 'string' || target.type === 'number' || target.type === 'bool') {
    return [target.type]
  }

  return null
}

function getValueVariableOptions(
  target: ProjectVariable | null,
  variables: ProjectVariable[]
): ProjectVariable[] {
  if (!target || target.type === 'pending') return variables
  return variables.filter((variable) => variable.type === target.type)
}

function SetVariableActionDataEditor({
  data,
  variables,
  disabled,
  onChange
}: SetVariableActionDataEditorProps) {
  const target = getTargetVariable(data.variable, variables)
  const expectedLiteralKinds = expectedLiteralKindsForVariable(target)
  const valueVariables = getValueVariableOptions(target, variables)
  const value = data.value
  const isVariableValue = value.kind === 'variable'
  const sourceVariable =
    value.kind === 'variable'
      ? variables.find((variable) => variable.name === value.variable) ?? null
      : null
  const hasTypeMismatch = Boolean(
    target &&
      target.type !== 'pending' &&
      sourceVariable &&
      sourceVariable.type !== target.type
  )

  // 操作项按目标变量的声明类型过滤：bool 才能翻转，number 才能自增；
  // 目标未声明 / pending 时只保留赋值。op 缺省视为 assign。
  const supportsToggle = target?.type === 'bool'
  const supportsAdd = target?.type === 'number'
  const op: SetVariableOperation =
    data.op === 'toggle' || data.op === 'add' ? data.op : 'assign'

  const changeVariable = (variable: string): void => {
    // 换目标后当前操作可能不再适用（如从 bool 换到 number 的 toggle），
    // 自动回落为赋值。
    const nextTarget = getTargetVariable(variable, variables)
    const nextSupportsToggle = nextTarget?.type === 'bool'
    const nextSupportsAdd = nextTarget?.type === 'number'
    const nextOp =
      op === 'toggle' && !nextSupportsToggle
        ? 'assign'
        : op === 'add' && !nextSupportsAdd
          ? 'assign'
          : op
    onChange({ ...data, variable, op: nextOp })
  }

  return (
    <div className="action-data-fields">
      <label className="field">
        <span>目标变量</span>
        <VariableCombobox
          value={data.variable}
          variables={variables}
          disabled={disabled}
          onChange={changeVariable}
        />
      </label>

      <div className="field">
        <div className="action-data-label">
          {(supportsToggle || supportsAdd) && (
            <div className="condition-operand__kind">
              <button
                type="button"
                className={`segmented__item${op === 'assign' ? ' segmented__item--active' : ''}`}
                disabled={disabled}
                title="赋值（=）"
                onClick={() => onChange({ ...data, op: 'assign' })}
              >
                赋值
              </button>
              {supportsToggle && (
                <button
                  type="button"
                  className={`segmented__item${op === 'toggle' ? ' segmented__item--active' : ''}`}
                  disabled={disabled}
                  title="翻转目标布尔值"
                  onClick={() => onChange({ ...data, op: 'toggle' })}
                >
                  翻转
                </button>
              )}
              {supportsAdd && (
                <button
                  type="button"
                  className={`segmented__item${op === 'add' ? ' segmented__item--active' : ''}`}
                  disabled={disabled}
                  title="数值自增（+=）"
                  onClick={() => onChange({ ...data, op: 'add' })}
                >
                  自增
                </button>
              )}
            </div>
          )}
          {op !== 'toggle' && isVariableValue && (
            <small className="action-data-label__hint">复制源变量当前值</small>
          )}
          {op !== 'toggle' && value.kind === 'extensionMethod' && (
            <small className="action-data-label__hint">
              {op === 'add' ? '增量取扩展方法的返回值' : '写入扩展方法的返回值'}
            </small>
          )}
        </div>

        {op !== 'toggle' && (
          <ConditionOperandEditor
            value={data.value}
            variables={valueVariables}
            expectedLiteralKinds={expectedLiteralKinds}
            disabled={disabled}
            onChange={(value) => onChange({ ...data, value })}
          />
        )}

        {!target && (
          <p className="field-hint">
            选择已声明类型的变量后，可使用翻转 / 自增。
          </p>
        )}
        {op === 'toggle' && (
          <p className="field-hint">写入时翻转目标布尔值（true ↔ false）。</p>
        )}
        {op === 'add' && (
          <p className="field-hint">
            在当前值上加增量；不做边界截断，需要上限 / 下限用条件分支表达。
          </p>
        )}

        {op !== 'toggle' &&
          value.kind === 'extensionMethod' &&
          (() => {
            // 已登记方法未声明 returns 时运行时拿不到返回值，会跳过写入
            const spec = findRuntimeMethodSpec(
              value.extensionId,
              value.methodId
            )
            if (!spec || spec.returns) return null
            return (
              <p className="field-hint field-hint--warning">
                方法 “{spec.label}” 未声明返回值，运行时将跳过写入。
              </p>
            )
          })()}
        {op !== 'toggle' && isVariableValue && target && target.type !== 'pending' && (
          <p className="field-hint">
            只列出与目标变量同类型的变量，不做隐式类型转换。
          </p>
        )}
        {op !== 'toggle' && hasTypeMismatch && (
          <p className="field-hint field-hint--warning">
            当前源变量与目标变量类型不一致，请重新选择。
          </p>
        )}
      </div>
    </div>
  )
}

interface FragmentSource {
  id: string
  name: string
  chapterId: string
  chapterName: string
}

function getFragmentSources(
  chapters: ChapterSummary[],
  chapterId: string
): FragmentSource[] {
  const sources = chapterId
    ? chapters.filter((chapter) => chapter.id === chapterId)
    : chapters

  return sources.flatMap((chapter) =>
    chapter.fragments.map((fragment) => ({
      id: fragment.id,
      name: fragment.name,
      chapterId: chapter.id,
      chapterName: chapter.name
    }))
  )
}

interface CallFragmentActionDataEditorProps {
  data: CallFragmentActionData
  chapters: ChapterSummary[]
  disabled: boolean
  onChange: (data: CallFragmentActionData) => void
}

function CallFragmentActionDataEditor({
  data,
  chapters,
  disabled,
  onChange
}: CallFragmentActionDataEditorProps) {
  const chapterId = data.chapterId ?? ''
  const chapterOptions: ComboboxOption[] = [
    { value: '', label: '自动（当前章节）' },
    ...chapters.map((chapter) => ({
      value: chapter.id,
      label: chapter.name,
      meta: chapter.id
    }))
  ]

  // main 片段是章节入口，不提供给片段调用
  const fragmentSources = getFragmentSources(chapters, chapterId).filter(
    (fragment) => !chapters
      .find((chapter) => chapter.id === fragment.chapterId)
      ?.fragments.find((item) => item.id === fragment.id)?.isMain
  )
  const fragmentOptions: ComboboxOption[] = fragmentSources.map((fragment) => ({
    value: fragment.id,
    label: fragment.name,
    meta: fragment.chapterName
  }))
  const fragmentMissing =
    data.fragmentId !== '' &&
    !chapters.some((chapter) =>
      chapter.fragments.some(
        (item) => item.id === data.fragmentId && item.isMain !== true
      )
    )

  const chooseChapter = (nextChapterId: string): void => {
    const nextSources = getFragmentSources(chapters, nextChapterId)
    const nextFragmentId = nextSources.some(
      (fragment) => fragment.id === data.fragmentId
    )
      ? data.fragmentId
      : ''

    onChange({
      ...data,
      chapterId: nextChapterId || undefined,
      fragmentId: nextFragmentId
    })
  }

  return (
    <div className="action-data-fields">
      <label className="field">
        <span>章节</span>
        <Combobox
          value={chapterId}
          options={chapterOptions}
          disabled={disabled}
          placeholder="未选择章节"
          searchPlaceholder="搜索章节"
          emptyMessage="没有匹配的章节"
          onChange={chooseChapter}
        />
      </label>

      <label className="field">
        <span>Fragment</span>
        <Combobox
          value={data.fragmentId}
          options={fragmentOptions}
          disabled={disabled}
          placeholder="未选择片段"
          searchPlaceholder="搜索片段"
          emptyMessage="没有匹配的片段"
          onChange={(fragmentId) => onChange({ ...data, fragmentId })}
        />
      </label>

      {fragmentMissing && (
        <p className="field-hint field-hint--warning">
          当前片段不存在或为 main 片段（章节入口不可被调用），请重新选择。
        </p>
      )}
      {chapters.length === 0 && (
        <p className="field-hint">尚未读取到章节摘要。</p>
      )}
      <p className="field-hint">
        章节选择“自动”时，由运行时按当前章节解析 fragment；main
        片段是章节入口，不在候选之列。
      </p>
    </div>
  )
}

interface CallExtensionMethodActionDataEditorProps {
  data: CallExtensionMethodActionData
  disabled: boolean
  onChange: (data: CallExtensionMethodActionData) => void
}

function CallExtensionMethodActionDataEditor({
  data,
  disabled,
  onChange
}: CallExtensionMethodActionDataEditorProps) {
  return (
    <div className="action-data-fields">
      <ExtensionMethodEditor
        value={{
          extensionId: data.extensionId,
          methodId: data.methodId,
          args: data.args
        }}
        disabled={disabled}
        onChange={({ extensionId, methodId, args }) => {
          const next: CallExtensionMethodActionData = {
            ...data,
            extensionId,
            methodId
          }
          if (args === undefined) {
            delete next.args
          } else {
            next.args = args
          }
          onChange(next)
        }}
      />
    </div>
  )
}

interface CallSystemSlotActionDataEditorProps {
  data: CallSystemSlotActionData
  disabled: boolean
  onChange: (data: CallSystemSlotActionData) => void
}

function CallSystemSlotActionDataEditor({
  data,
  disabled,
  onChange
}: CallSystemSlotActionDataEditorProps) {
  return (
    <div className="action-data-fields">
      <label className="field">
        <span>槽位 ID</span>
        <input
          className="field-input"
          value={data.slot}
          disabled={disabled}
          placeholder="例如 avg.internal.default-shell/show-menu"
          onChange={(event) => onChange({ ...data, slot: event.target.value })}
        />
      </label>

      <p className="field-hint">
        payload 参数编辑会等系统槽位 schema 接入后再补上。
      </p>
    </div>
  )
}

interface UnknownActionDataEditorProps {
  value: ActionValue
}

function UnknownActionDataEditor({ value }: UnknownActionDataEditorProps) {
  return (
    <div className="action-data-fields">
      <p className="field-hint">
        扩展 action（type={String(value.type)}）暂时没有可视化编辑器，data 会原样保留。
      </p>
      <pre className="action-data-json">
        {JSON.stringify(value.data, null, 2)}
      </pre>
    </div>
  )
}
