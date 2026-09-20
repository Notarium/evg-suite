import { RefreshIcon } from './Icons'
import { useAppStore } from '../stores/useAppStore'
import { useEvgDataStore } from '../stores/useEvgDataStore'
import { useVariableEditorStore } from '../stores/useVariableEditorStore'

export function GlobalToolbar() {
  const currentProject = useAppStore((state) => state.currentProject)
  const refreshProject = useAppStore((state) => state.refreshProject)
  const appLoading = useAppStore((state) => state.loading)
  const dataLoading = useVariableEditorStore((state) => state.loading)
  const dataSaving = useVariableEditorStore((state) => state.saving)
  const evgLoading = useEvgDataStore((state) => state.loading)
  const evgSaving = useEvgDataStore((state) => state.saving)

  if (!currentProject) return null

  const busy = appLoading || dataLoading || dataSaving || evgLoading || evgSaving

  return (
    <div className="global-toolbar">
      <span className="global-toolbar__project" title={currentProject.path}>
        {currentProject.name}
      </span>

      <button
        type="button"
        className="button button--ghost global-toolbar__refresh"
        disabled={busy}
        title="重新读取项目数据"
        onClick={() => void refreshProject()}
      >
        <RefreshIcon />
        {busy ? '刷新中…' : '刷新'}
      </button>
    </div>
  )
}
