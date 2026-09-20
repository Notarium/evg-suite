import { useState } from 'react'
import type {
  RuntimeInventoryConfig,
  RuntimeItemDef
} from '../../../../shared/runtimeConfig'
import { createRuntimeItemId } from '../../../../shared/runtimeConfig'
import { PlusIcon, TrashIcon } from '../Icons'

interface InventoryConfigEditorProps {
  config: RuntimeInventoryConfig
  disabled?: boolean
  onChange: (next: RuntimeInventoryConfig) => void
}

/**
 * 运行数据配置 · 物品页签。
 *
 * 主从两列布局（master-detail 模板，与变量页签同款）：左列表为可点选
 * 的物品卡片，右栏编辑选中物品的字段。选中态按数组下标追踪——物品 id
 * 本身是可编辑字段，按 id 追踪会在改名打字过程中断链。
 *
 * 物品 id 默认自动生成、允许编辑为语义化 id（如 key）——剧本里的物品
 * 引用（持有量变量 evg.item.<id>、add-item / remove-item 的参数）按 id
 * 定位，修改 id 会使已写入剧本的引用与旧变量失联；名称/描述是展示文案，
 * 可随时修改。
 * 货币等标量走系统变量（evg.inventory.*）；每物品持有量变量在主页
 * 「物品变量」节按本清单同步声明。
 */
export function InventoryConfigEditor({
  config,
  disabled = false,
  onChange
}: InventoryConfigEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const updateItem = (index: number, patch: Partial<RuntimeItemDef>): void => {
    onChange({
      items: config.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      )
    })
  }

  const updateSelectedItem = (patch: Partial<RuntimeItemDef>): void => {
    if (selectedIndex === null) return
    updateItem(selectedIndex, patch)
  }

  /** 物品 id 的即时提示:为空 / 与其它物品重复(保存会被主进程拒绝)。 */
  const idWarningFor = (item: RuntimeItemDef): string | null => {
    if (item.id.trim().length === 0) return '物品 id 不能为空，保存前必须填写。'
    const sameId = config.items.filter((entry) => entry.id === item.id)
    return sameId.length > 1 ? '存在相同 id 的物品，保存会被拒绝。' : null
  }

  const removeItem = (index: number): void => {
    onChange({ items: config.items.filter((_, i) => i !== index) })
    // 删除项之后的下标整体前移，保持选中态落在原物品上
    if (selectedIndex === index) setSelectedIndex(null)
    else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const addItem = (): void => {
    const item: RuntimeItemDef = {
      id: createRuntimeItemId(),
      name: '新物品',
      description: '',
      stackable: true,
      maxStack: 99
    }
    onChange({ items: [...config.items, item] })
    setSelectedIndex(config.items.length)
  }

  const editingItem =
    selectedIndex !== null ? (config.items[selectedIndex] ?? null) : null

  const renderItemRow = (item: RuntimeItemDef, index: number) => (
    <article
      key={`${item.id}-${index}`}
      className={`data-item data-item--selectable${
        selectedIndex === index ? ' data-item--active' : ''
      }`}
      onClick={() => setSelectedIndex(index)}
    >
      <div className="data-item__body">
        <div className="data-item__title">
          <strong>{item.name}</strong>
        </div>
        <div className="data-item__meta">
          <span className="runtime-item-tag">{item.id}</span>
          {!item.stackable && (
            <span className="badge badge--muted">不可堆叠</span>
          )}
        </div>
      </div>

      <div className="data-item__actions">
        <button
          type="button"
          className="icon-button icon-button--danger"
          title="删除"
          aria-label={`删除物品 ${item.name}`}
          onClick={(event) => {
            event.stopPropagation()
            removeItem(index)
          }}
        >
          <TrashIcon size={15} />
        </button>
      </div>
    </article>
  )

  return (
    <div className="master-detail-layout">
      <section className="section-card master-detail-list-panel">
        <div className="section-card__head">
          <div>
            <h2>物品清单（{config.items.length} 项）</h2>
            <p>剧本与运行时按物品 id 引用。</p>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={disabled}
            onClick={addItem}
          >
            <PlusIcon />
            添加
          </button>
        </div>

        {config.items.length === 0 ? (
          <div className="data-empty">还没有物品，点击上方“添加”。</div>
        ) : (
          <div className="master-detail-list">
            {config.items.map(renderItemRow)}
          </div>
        )}
      </section>

      <section className="section-card master-detail-editor-panel">
        {editingItem ? (
          <>
            <div className="section-card__head">
              <div>
                <h2>编辑物品</h2>
                <p>修改会暂存为草稿，点击右上角“保存”写盘。</p>
              </div>
            </div>

            <label className="field">
              <span>物品 ID</span>
              <input
                className="field-input"
                value={editingItem.id}
                disabled={disabled}
                spellCheck={false}
                onChange={(event) =>
                  updateSelectedItem({ id: event.target.value })
                }
              />
              {idWarningFor(editingItem) && (
                <p className="field-hint field-hint--warning">
                  {idWarningFor(editingItem)}
                </p>
              )}
              <p className="field-hint">
                剧本里的物品引用按 id 定位（持有量变量
                {'evg.item.<id>'}、add-item / remove-item 参数）；
                建议改成可读的语义 id（如 key）。
                修改 id 会使剧本中已引用它的内容失效，旧变量也不再被同步。
              </p>
            </label>

            <label className="field">
              <span>名称</span>
              <input
                className="field-input"
                value={editingItem.name}
                disabled={disabled}
                onChange={(event) =>
                  updateSelectedItem({ name: event.target.value })
                }
              />
            </label>

            <label className="field">
              <span>描述</span>
              <input
                className="field-input"
                value={editingItem.description}
                disabled={disabled}
                placeholder="运行时展示用的说明文字"
                onChange={(event) =>
                  updateSelectedItem({ description: event.target.value })
                }
              />
            </label>

            <div className="runtime-config-inline-fields">
              <button
                type="button"
                className={`value-toggle${
                  editingItem.stackable ? ' value-toggle--on' : ''
                }`}
                disabled={disabled}
                onClick={() =>
                  updateSelectedItem({
                    stackable: !editingItem.stackable,
                    maxStack: !editingItem.stackable ? 99 : 1
                  })
                }
              >
                {editingItem.stackable ? '可堆叠' : '不可堆叠'}
              </button>

              <label className="runtime-config-inline-field">
                <span>最大堆叠</span>
                <input
                  className="field-input"
                  type="number"
                  min={1}
                  max={999999}
                  value={editingItem.maxStack}
                  disabled={disabled || !editingItem.stackable}
                  onChange={(event) => {
                    const maxStack = Number(event.target.value)
                    if (!Number.isFinite(maxStack)) return
                    updateSelectedItem({ maxStack })
                  }}
                />
              </label>
            </div>
          </>
        ) : (
          <div className="data-empty">
            从左侧选择一个物品，或点击“添加”。
          </div>
        )}
      </section>
    </div>
  )
}
