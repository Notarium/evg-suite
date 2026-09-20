import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { IPC_CHANNELS } from '../shared/ipc'
import { registerEditorDataIpc } from './ipc/editorData'
import { registerProjectIpc } from './ipc/projects'
import { registerWindowIpc } from './ipc/window'
import { ProjectHistoryStore } from './services/projectHistoryStore'
import { ProjectService } from './services/projectService'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1f1f1f',
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 16, y: 16 } }
      : { frame: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const sendMaximizeState = (): void => {
    mainWindow.webContents.send(IPC_CHANNELS.window.maximizeChanged, mainWindow.isMaximized())
  }

  mainWindow.on('maximize', sendMaximizeState)
  mainWindow.on('unmaximize', sendMaximizeState)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  const historyStore = new ProjectHistoryStore(
    join(app.getPath('userData'), 'project-history.json'),
    { maxEntries: 30 }
  )

  const projectService = new ProjectService(historyStore)

  registerWindowIpc()
  registerProjectIpc(projectService)
  registerEditorDataIpc()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
