import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc'

export function registerWindowIpc(): void {
  ipcMain.on(IPC_CHANNELS.window.minimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on(IPC_CHANNELS.window.toggleMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return

    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.on(IPC_CHANNELS.window.close, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}
