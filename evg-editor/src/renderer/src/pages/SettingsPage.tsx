import { useAppStore } from '../stores/useAppStore'

export function SettingsPage() {
  const theme = useAppStore((state) => state.theme)
  const skin = useAppStore((state) => state.skin)
  const setTheme = useAppStore((state) => state.setTheme)
  const setSkin = useAppStore((state) => state.setSkin)

  return (
    <section className="page settings-page">
      <header className="page-hero page-hero--compact">
        <div>
          <p className="eyebrow">应用设置</p>
          <h1>设置</h1>
          <p>外观、编辑器偏好与快捷键配置将在后续版本开放。</p>
        </div>
      </header>

      <section className="section-card settings-grid">
        <div className="setting-item setting-item--wide">
          <span>外观</span>
          <div className="theme-options" role="radiogroup" aria-label="外观">
            <button
              type="button"
              role="radio"
              aria-checked={skin === 'fluent'}
              className={`theme-option${skin === 'fluent' ? ' theme-option--active' : ''}`}
              onClick={() => setSkin('fluent')}
            >
              Fluent 扁平
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={skin === 'win98'}
              className={`theme-option${skin === 'win98' ? ' theme-option--active' : ''}`}
              onClick={() => setSkin('win98')}
            >
              Windows 98
            </button>
          </div>
        </div>
        <div className="setting-item">
          <span>默认主题</span>
          <div className="theme-options" role="radiogroup" aria-label="默认主题">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`theme-option${theme === 'light' ? ' theme-option--active' : ''}`}
              disabled={skin === 'win98'}
              title={skin === 'win98' ? 'Windows 98 外观固定使用浅色配色' : undefined}
              onClick={() => setTheme('light')}
            >
              亮色
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`theme-option${theme === 'dark' ? ' theme-option--active' : ''}`}
              disabled={skin === 'win98'}
              title={skin === 'win98' ? 'Windows 98 外观固定使用浅色配色' : undefined}
              onClick={() => setTheme('dark')}
            >
              暗色
            </button>
          </div>
        </div>

        <div className="setting-item">
          <span>技术栈</span>
          <strong>Electron + React + TypeScript + Vite + pnpm</strong>
        </div>
        <div className="setting-item">
          <span>状态管理</span>
          <strong>Zustand</strong>
        </div>
        <div className="setting-item">
          <span>历史记录位置</span>
          <strong>Electron userData/project-history.json</strong>
        </div>
        <div className="setting-item">
          <span>凭据安全</span>
          <strong>环境变量 / 已由 .gitignore 排除</strong>
        </div>
      </section>
    </section>
  )
}
