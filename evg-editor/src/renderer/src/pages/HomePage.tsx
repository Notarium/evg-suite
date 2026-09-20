import { ArrowRightIcon, ClockIcon, CloseIcon, FolderIcon, FolderOpenIcon, TrashIcon } from '../components/Icons'
import { RuntimeSystemsPanel } from '../components/home/RuntimeSystemsPanel'
import { formatRelativeTime } from '../lib/format'
import { useAppStore } from '../stores/useAppStore'

export function HomePage() {
  const history = useAppStore((state) => state.history)
  const loading = useAppStore((state) => state.loading)
  const openProject = useAppStore((state) => state.openProject)
  const openRecent = useAppStore((state) => state.openRecent)
  const removeProject = useAppStore((state) => state.removeProject)
  const clearHistory = useAppStore((state) => state.clearHistory)
  const currentProject = useAppStore((state) => state.currentProject)
  const closeProject = useAppStore((state) => state.closeProject)
  const setActivePage = useAppStore((state) => state.setActivePage)

  const hasHistory = history.length > 0

  if (currentProject) {
    return (
      <section className="page home-page">
        <header className="page-hero">
          <div>
            <p className="eyebrow">当前项目</p>
            <h1>{currentProject.name}</h1>
            <p title={currentProject.path}>{currentProject.path}</p>
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={closeProject}
          >
            <CloseIcon size={14} />
            关闭项目
          </button>
        </header>

        <div className="home-content">
          <section className="section-card">
            <div className="section-card__head">
              <div>
                <h2>项目总览</h2>
                <p>当前项目的关键信息与快速入口。</p>
              </div>

              <div className="overview-actions">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setActivePage('variables')}
                >
                  变量
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setActivePage('conditions')}
                >
                  条件
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setActivePage('actions')}
                >
                  动作
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setActivePage('events')}
                >
                  事件
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setActivePage('locations')}
                >
                  地点
                </button>
              </div>
            </div>

            <div className="settings-grid">
              <div className="setting-item">
                <span>项目名称</span>
                <strong>{currentProject.name}</strong>
              </div>
              <div className="setting-item">
                <span>项目 ID</span>
                <strong>{currentProject.projectId}</strong>
              </div>
              <div className="setting-item">
                <span>目录名</span>
                <strong>{currentProject.folderName}</strong>
              </div>
              <div className="setting-item">
                <span>最近打开</span>
                <strong>{formatRelativeTime(currentProject.lastOpenedAt)}</strong>
              </div>
            </div>
          </section>

          <RuntimeSystemsPanel />
        </div>
      </section>
    )
  }

  return (
    <section className="page home-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">项目工作台</p>
          <h1>打开项目，开始编辑</h1>
          <p>
            从本机选择一个已有项目目录。EVG Editor 会记录最近打开的项目，
            下次可以一键继续。
          </p>
        </div>

        <button
          type="button"
          className="button button--primary button--large"
          onClick={() => void openProject()}
          disabled={loading}
        >
          <FolderOpenIcon />
          {loading ? '正在打开…' : '选择项目'}
        </button>
      </header>

      <div className="home-content">
        <section className="section-card">
          <div className="section-card__head">
            <div>
              <h2>最近项目</h2>
              <p>通过 EVG Editor 打开过的项目路径会保存在这里。</p>
            </div>

            {hasHistory && (
              <button
                type="button"
                className="text-button"
                onClick={() => void clearHistory()}
                disabled={loading}
              >
                清空历史
              </button>
            )}
          </div>

          {hasHistory ? (
            <div className="project-list">
              {history.map((project) => (
                <article key={project.id} className="project-item">
                  <button
                    type="button"
                    className="project-item__main"
                    onClick={() => void openRecent(project.id)}
                    disabled={loading}
                  >
                    <span className="project-item__avatar">
                      <FolderIcon />
                    </span>

                    <span className="project-item__info">
                      <strong>{project.name}</strong>
                      <span className="project-item__path" title={project.path}>
                        {project.path}
                      </span>
                    </span>

                    <span className="project-item__meta">
                      <ClockIcon size={15} />
                      {formatRelativeTime(project.lastOpenedAt)}
                    </span>

                    <ArrowRightIcon className="project-item__arrow" size={16} />
                  </button>

                  <button
                    type="button"
                    className="icon-button project-item__remove"
                    aria-label={`从历史中移除 ${project.name}`}
                    title="从历史中移除"
                    onClick={() => void removeProject(project.id)}
                    disabled={loading}
                  >
                    <TrashIcon size={16} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__icon">
                <FolderOpenIcon size={28} />
              </span>
              <h3>还没有打开过项目</h3>
              <p>点击“选择项目”打开本机目录，项目历史会显示在这里。</p>
              <button
                type="button"
                className="button button--primary"
                onClick={() => void openProject()}
                disabled={loading}
              >
                <FolderOpenIcon />
                选择项目
              </button>
            </div>
          )}
        </section>
      </div>
    </section>
  )
}
