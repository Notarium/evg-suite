import { useMemo, useState } from 'react'
import type { EvgJsonValue } from '../../../../shared/evgData'
import {
  EVG_RUNTIME_EXTENSION_ID,
  defaultRuntimeMethodId,
  findRuntimeMethodSpec,
  listRuntimeExtensionIds,
  listRuntimeMethodSpecs,
  type RuntimeMethodArgField,
  type RuntimeMethodSpec
} from '../../../../shared/runtimeMethods'
import {
  RUNTIME_CONFIG_DATA_TYPE,
  RUNTIME_CONFIG_ROW_KEY,
  type RuntimeConfigData,
  type RuntimeItemDef
} from '../../../../shared/runtimeConfig'
import type { EvgDataRecord } from '../../../../shared/database'
import { useEvgDataStore } from '../../stores/useEvgDataStore'
import { useChapterStore } from '../../stores/useChapterStore'
import { Combobox, type ComboboxOption } from './Combobox'

/**
 * 扩展方法三元组的统一编辑入口（扩展选择 + 方法选择 + 参数表单）。
 *
 * - 已登记方法（shared/runtimeMethods.ts）：按清单生成参数表单，
 *   章节 / 物品类参数给出候选下拉；
 * - 未登记方法：方法 id 手填，参数回退为 JSON 文本编辑。
 *
 * 条件操作数（extensionMethod）与 CallExtensionMethod 动作共用；
 * args 由调用方自行并入各自的数据结构。
 */
export interface ExtensionMethodValue {
  extensionId: string
  methodId: string
  args?: EvgJsonValue
}

interface ExtensionMethodEditorProps {
  value: ExtensionMethodValue
  disabled?: boolean
  onChange: (value: ExtensionMethodValue) => void
}

function isPlainObject(value: unknown): value is Record<string, EvgJsonValue> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  )
}

function isKnownExtension(extensionId: string): boolean {
  return listRuntimeExtensionIds().includes(extensionId)
}

function getRuntimeItems(records: EvgDataRecord[]): RuntimeItemDef[] {
  for (const record of records) {
    if (
      record.type !== RUNTIME_CONFIG_DATA_TYPE ||
      record.key !== RUNTIME_CONFIG_ROW_KEY ||
      !isPlainObject(record.data)
    ) {
      continue
    }

    const inventory = (record.data as unknown as RuntimeConfigData).inventory
    return Array.isArray(inventory?.items) ? inventory.items : []
  }
  return []
}

function getReturnHint(spec: RuntimeMethodSpec): string {
  switch (spec.returns) {
    case 'boolean':
      return '返回布尔值，可直接参与判断。'
    case 'number':
      return '返回数字。'
    case 'string':
      return '返回文本。'
    default:
      return '动作型方法，无返回值。'
  }
}

export function ExtensionMethodEditor({
  value,
  disabled = false,
  onChange
}: ExtensionMethodEditorProps) {
  const records = useEvgDataStore((state) => state.records)
  const chapters = useChapterStore((state) => state.chapters)

  const itemOptions = useMemo<ComboboxOption[]>(
    () =>
      getRuntimeItems(records).map((item) => ({
        value: item.id,
        label: item.name,
        meta: item.id
      })),
    [records]
  )

  const chapterOptions = useMemo<ComboboxOption[]>(
    () =>
      chapters.map((chapter) => ({
        value: chapter.id,
        label: chapter.name,
        meta: chapter.id
      })),
    [chapters]
  )

  const spec = findRuntimeMethodSpec(value.extensionId, value.methodId)

  const extensionOptions = useMemo<ComboboxOption[]>(() => {
    const options = listRuntimeExtensionIds().map((extensionId) => ({
      value: extensionId,
      label:
        extensionId === EVG_RUNTIME_EXTENSION_ID ? 'EVG Runtime' : extensionId,
      meta: extensionId
    }))
    if (value.extensionId && !isKnownExtension(value.extensionId)) {
      options.push({
        value: value.extensionId,
        label: `${value.extensionId}（未登记）`,
        meta: value.extensionId
      })
    }
    return options
  }, [value.extensionId])

  const methodOptions = useMemo<ComboboxOption[]>(
    () =>
      listRuntimeMethodSpecs(value.extensionId).map((item) => ({
        value: item.methodId,
        label: item.label,
        meta: item.methodId
      })),
    [value.extensionId]
  )

  const chooseExtension = (extensionId: string): void => {
    onChange({
      extensionId,
      methodId: defaultRuntimeMethodId(extensionId),
      args: undefined
    })
  }

  const chooseMethod = (methodId: string): void => {
    onChange({ extensionId: value.extensionId, methodId, args: undefined })
  }

  const changeArgs = (args: EvgJsonValue | undefined): void => {
    onChange({ extensionId: value.extensionId, methodId: value.methodId, args })
  }

  const argsObject = isPlainObject(value.args) ? value.args : {}

  return (
    <div className="ext-method">
      <div className="ext-method__row">
        <label className="field">
          <span>扩展</span>
          <Combobox
            value={value.extensionId}
            options={extensionOptions}
            disabled={disabled}
            placeholder="未选择扩展"
            searchPlaceholder="搜索扩展"
            emptyMessage="没有匹配的扩展"
            onChange={chooseExtension}
          />
        </label>

        {spec ? (
          <label className="field">
            <span>方法</span>
            <Combobox
              value={value.methodId}
              options={methodOptions}
              disabled={disabled}
              placeholder="未选择方法"
              searchPlaceholder="搜索方法"
              emptyMessage="没有匹配的方法"
              onChange={chooseMethod}
            />
          </label>
        ) : (
          <label className="field">
            <span>方法 ID</span>
            <input
              className="field-input"
              value={value.methodId}
              disabled={disabled}
              placeholder="扩展声明的方法 id"
              onChange={(event) =>
                onChange({
                  extensionId: value.extensionId,
                  methodId: event.target.value,
                  args: value.args
                })
              }
            />
          </label>
        )}
      </div>

      {spec ? (
        <>
          <p className="field-hint">
            {spec.description} {getReturnHint(spec)}
          </p>
          <RuntimeMethodArgsForm
            spec={spec}
            args={argsObject}
            itemOptions={itemOptions}
            chapterOptions={chapterOptions}
            disabled={disabled}
            onChange={changeArgs}
          />
        </>
      ) : (
        <>
          <ArgsJsonEditor
            args={isPlainObject(value.args) ? value.args : undefined}
            disabled={disabled}
            onChange={(args) => changeArgs(args)}
          />
          <p className="field-hint">
            未登记的扩展方法：参数结构由扩展自定义，这里以 JSON
            编辑；登记到方法清单后即可获得表单编辑。
          </p>
        </>
      )}
    </div>
  )
}

interface RuntimeMethodArgsFormProps {
  spec: RuntimeMethodSpec
  args: Record<string, EvgJsonValue>
  itemOptions: ComboboxOption[]
  chapterOptions: ComboboxOption[]
  disabled: boolean
  onChange: (args: EvgJsonValue | undefined) => void
}

function RuntimeMethodArgsForm({
  spec,
  args,
  itemOptions,
  chapterOptions,
  disabled,
  onChange
}: RuntimeMethodArgsFormProps) {
  if (spec.args.length === 0) {
    return <p className="field-hint">该方法没有参数。</p>
  }

  const setField = (key: string, fieldValue: EvgJsonValue): void => {
    onChange({ ...args, [key]: fieldValue })
  }

  return (
    <div className="ext-method__args">
      {spec.args.map((field) => {
        const fieldValue = args[field.key]
        const missing =
          field.required === true &&
          (fieldValue === undefined ||
            fieldValue === null ||
            fieldValue === '')

        return (
          <label key={field.key} className="field">
            <span>
              {field.label}
              {field.required ? '（必填）' : ''}
            </span>
            <RuntimeMethodArgInput
              field={field}
              value={fieldValue}
              itemOptions={field.suggest === 'itemId' ? itemOptions : []}
              chapterOptions={
                field.suggest === 'chapterId' ? chapterOptions : []
              }
              disabled={disabled}
              onChange={(next) => setField(field.key, next)}
            />
            {missing && (
              <p className="field-hint field-hint--warning">
                尚未选择{field.label}。
              </p>
            )}
            {field.description && (
              <p className="field-hint">{field.description}</p>
            )}
          </label>
        )
      })}
    </div>
  )
}

interface RuntimeMethodArgInputProps {
  field: RuntimeMethodArgField
  value: EvgJsonValue | undefined
  itemOptions: ComboboxOption[]
  chapterOptions: ComboboxOption[]
  disabled: boolean
  onChange: (value: EvgJsonValue) => void
}

function RuntimeMethodArgInput({
  field,
  value,
  itemOptions,
  chapterOptions,
  disabled,
  onChange
}: RuntimeMethodArgInputProps) {
  if (field.type === 'boolean') {
    const current = value === true
    return (
      <button
        type="button"
        className={`value-toggle${current ? ' value-toggle--on' : ''}`}
        disabled={disabled}
        onClick={() => onChange(!current)}
      >
        {current ? '真' : '假'}
      </button>
    )
  }

  if (field.type === 'number') {
    return (
      <input
        className="field-input"
        type="number"
        value={typeof value === 'number' ? String(value) : ''}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
      />
    )
  }

  const text = typeof value === 'string' ? value : ''
  if (field.suggest === 'chapterId' && chapterOptions.length > 0) {
    return (
      <Combobox
        value={text}
        options={chapterOptions}
        disabled={disabled}
        placeholder="未选择章节"
        searchPlaceholder="搜索章节"
        emptyMessage="没有匹配的章节"
        onChange={onChange}
      />
    )
  }

  if (field.suggest === 'itemId' && itemOptions.length > 0) {
    return (
      <Combobox
        value={text}
        options={itemOptions}
        disabled={disabled}
        placeholder="未选择物品"
        searchPlaceholder="搜索物品"
        emptyMessage="没有匹配的物品"
        onChange={onChange}
      />
    )
  }

  return (
    <input
      className="field-input"
      value={text}
      disabled={disabled}
      placeholder={
        field.suggest === 'chapterId'
          ? '章节 id（尚无章节摘要）'
          : field.suggest === 'itemId'
            ? '物品 id（尚无物品清单）'
            : undefined
      }
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

interface ArgsJsonEditorProps {
  args: Record<string, EvgJsonValue> | undefined
  disabled: boolean
  onChange: (args: Record<string, EvgJsonValue>) => void
}

function ArgsJsonEditor({ args, disabled, onChange }: ArgsJsonEditorProps) {
  const committed = useMemo(
    () => JSON.stringify(args ?? {}, null, 2),
    [args]
  )
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (text: string): void => {
    setDraft(text)
    try {
      const parsed: unknown = JSON.parse(text === '' ? '{}' : text)
      if (!isPlainObject(parsed)) {
        setError('参数必须是 JSON 对象。')
        return
      }
      setError(null)
      onChange(parsed)
    } catch {
      setError('JSON 解析失败，修正后会自动应用。')
    }
  }

  return (
    <div className="ext-method__json">
      <textarea
        className="field-input ext-method__json-input"
        value={draft ?? committed}
        disabled={disabled}
        spellCheck={false}
        rows={4}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          setDraft(null)
          setError(null)
        }}
      />
      {error && (
        <p className="field-hint field-hint--warning">{error}</p>
      )}
    </div>
  )
}
