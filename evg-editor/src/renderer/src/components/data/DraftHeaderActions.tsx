interface DraftHeaderActionsProps {
  /** 草稿是否有未写盘的修改；无修改时「未保存」与「取消修改」不渲染。 */
  dirty: boolean
  saving: boolean
  /** 回滚到文件当前状态（重读，页面级）。 */
  onReload: () => void
  /** 写盘。 */
  onSave: () => void
}

/**
 * 草稿模式页面右上角的动作组：「未保存」提示 +「取消修改」+「保存」。
 * 「取消修改」只在有未保存修改时渲染（隐藏即折叠）。各页面的容器 div
 * 由页面自己持有；主页 / 条件 / 动作 / 事件 / 地点 / 运行数据配置共用。
 */
export function DraftHeaderActions({
  dirty,
  saving,
  onReload,
  onSave
}: DraftHeaderActionsProps) {
  return (
    <>
      {dirty && !saving && <span className="status-pill">未保存</span>}
      {dirty && (
        <button
          type="button"
          className="button button--ghost"
          title="放弃未保存的修改，恢复为文件当前内容"
          onClick={onReload}
        >
          取消修改
        </button>
      )}
      <button
        type="button"
        className="button button--primary"
        disabled={!dirty || saving}
        onClick={onSave}
      >
        {saving ? '保存中…' : '保存'}
      </button>
    </>
  )
}
