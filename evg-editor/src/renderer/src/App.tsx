import { useEffect } from 'react'
import { GlobalToolbar } from './components/GlobalToolbar'
import { Sidebar } from './components/Sidebar'
import { TitleBar } from './components/TitleBar'
import { ConditionsPage } from './pages/ConditionsPage'
import { ActionsPage } from './pages/ActionsPage'
import { EventsPage } from './pages/EventsPage'
import { LocationsPage } from './pages/LocationsPage'
import { HomePage } from './pages/HomePage'
import { RuntimeConfigPage } from './pages/RuntimeConfigPage'
import { SettingsPage } from './pages/SettingsPage'
import { VariablesPage } from './pages/VariablesPage'
import { useAppStore } from './stores/useAppStore'

export default function App() {
  const activePage = useAppStore((state) => state.activePage)
  const theme = useAppStore((state) => state.theme)
  const skin = useAppStore((state) => state.skin)
  const errorMessage = useAppStore((state) => state.errorMessage)
  const clearError = useAppStore((state) => state.clearError)
  const initialize = useAppStore((state) => state.initialize)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.skin = skin
    document.documentElement.style.colorScheme =
      skin === 'win98' ? 'light' : theme
  }, [theme, skin])

  return (
    <div className="app-shell">
      <TitleBar />

      {errorMessage && (
        <div className="global-notice" role="alert">
          <span>{errorMessage}</span>
          <button type="button" onClick={clearError}>
            关闭
          </button>
        </div>
      )}

      <GlobalToolbar />

      <div className="app-body">
        <Sidebar />

        <main className="page-host">
          {activePage === 'home' && <HomePage />}
          {activePage === 'variables' && <VariablesPage />}
          {activePage === 'conditions' && <ConditionsPage />}
          {activePage === 'actions' && <ActionsPage />}
          {activePage === 'events' && <EventsPage />}
          {activePage === 'locations' && <LocationsPage />}
          {activePage === 'runtime' && <RuntimeConfigPage />}
          {activePage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  )
}
