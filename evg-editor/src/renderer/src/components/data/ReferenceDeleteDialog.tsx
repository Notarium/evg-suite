import { EditorDialog } from './EditorDialog'
import type { EvgReferenceLocation } from '../../lib/evgReferences'

export type ReferenceDeleteMode = 'keep' | 'cascade'

interface ReferenceDeleteDialogProps {
  title: string
  /** 待删除对象的显示名。 */
  targetName: string
  /** 对象类型名词：条件 / 动作 / 事件 / 变量。 */
  kindLabel: string
  references: EvgReferenceLocation[]
  busy?: boolean
  /**
   * 是否提供“级联清理引用”模式。
   * 变量等没有明确级联语义的对象传 false，只展示引用警示。
   */
  cascadeEnabled?: boolean
  /** 级联模式的具体行为说明，由调用方按对象类型描述。 */
  cascadeHint?: string
  /** 写回时机说明；变量等立即落盘的对象使用不同文案。 */
  writeHint?: string
  onCancel: () => void
  onConfirm: (mode: ReferenceDeleteMode) => void
}

export function ReferenceDeleteDialog({
  title,
  targetName,
  kindLabel,
  references,
  busy = false,
  cascadeEnabled = false,
  cascadeHint,
  writeHint = '删除后需要点击保存，才会写回项目文件。',
  onCancel,
  onConfirm
}: ReferenceDeleteDialogProps) {
  const hasReferences = references.length > 0

  return (
    <EditorDialog title={title} closeDisabled={busy} onClose={onCancel}>
      <div className="confirm-dialog">
        <p>
          确定删除{kindLabel} “{targetName}” 吗？
          <br />
          {writeHint}
        </p>

        {hasReferences && (
          <div className="ref-warning" role="alert">
            <p className="ref-warning__title">
              有 {references.length} 处引用指向这个{kindLabel}：
            </p>
            <ul className="ref-warning__list">
              {references.map((reference, index) => (
                <li key={`${reference.recordId}-${index}`}>
                  <strong>{reference.target}</strong>
                  <span>{reference.location}</span>
                </li>
              ))}
            </ul>
            {cascadeEnabled ? (
              <div className="ref-warning__modes">
                <p>
                  <strong>保留引用：</strong>
                  引用位置原样保留（悬空引用），运行时按引用未命中处理。
                </p>
                {cascadeHint && (
                  <p>
                    <strong>级联清理：</strong>
                    {cascadeHint}
                  </p>
                )}
              </div>
            ) : (
              <p className="ref-warning__modes">
                引用位置会原样保留，运行时将按引用未命中处理。
              </p>
            )}
          </div>
        )}

        <div className="confirm-dialog__actions">
          <button
            type="button"
            className="button button--ghost"
            disabled={busy}
            onClick={onCancel}
          >
            取消
          </button>
          {hasReferences && cascadeEnabled && (
            <button
              type="button"
              className="button"
              disabled={busy}
              title="引用位置原样保留"
              onClick={() => onConfirm('keep')}
            >
              保留引用并删除
            </button>
          )}
          <button
            type="button"
            className="button button--danger"
            disabled={busy}
            title={
              hasReferences && cascadeEnabled
                ? '从所有引用位置移除该引用'
                : undefined
            }
            onClick={() =>
              onConfirm(hasReferences && cascadeEnabled ? 'cascade' : 'keep')
            }
          >
            {hasReferences && cascadeEnabled ? '级联清理引用并删除' : '删除'}
          </button>
        </div>
      </div>
    </EditorDialog>
  )
}
