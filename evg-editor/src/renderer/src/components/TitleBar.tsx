import { useEffect, useState } from 'react'
import { CloseIcon, MaximizeIcon, MinimizeIcon, MoonIcon, RestoreIcon, SunIcon } from './Icons'
import { useAppStore } from '../stores/useAppStore'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const theme = useAppStore((state) => state.theme)
  const skin = useAppStore((state) => state.skin)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const isMac = window.api.platform === 'darwin'

  useEffect(() => {
    const dispose = window.api.window.onMaximizeChange(setMaximized)
    return dispose
  }, [])

  return (
    <header className={`titlebar${isMac ? ' titlebar--mac' : ''}`}>
      <div className="titlebar__brand">
        <span className="titlebar__mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>EVG Editor</span>
      </div>

      <div className="titlebar__actions">
        {skin !== 'win98' && (
          <button
            type="button"
            className="titlebar__theme-toggle"
            aria-label={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            onClick={() => toggleTheme()}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        )}

        {!isMac && (
          <div className="titlebar__controls">
            <button
              type="button"
              aria-label="最小化"
              onClick={() => window.api.window.minimize()}
            >
              <MinimizeIcon />
            </button>
            <button
              type="button"
              aria-label={maximized ? '还原' : '最大化'}
              onClick={() => window.api.window.toggleMaximize()}
            >
              {maximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
            <button
              type="button"
              className="titlebar__close"
              aria-label="关闭"
              onClick={() => window.api.window.close()}
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
