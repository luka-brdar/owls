'use strict'

import { app, protocol, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { execSync } from 'child_process'
import createProtocol from 'vue-cli-plugin-electron-builder/lib/createProtocol'
const isDevelopment = process.env.NODE_ENV !== 'production'

// macOS/Linux GUI apps launched from Finder/Dock inherit a minimal PATH that
// excludes Homebrew locations where docker/colima live. Prepend the user's real
// login-shell PATH so child processes (Docker detection) can find the CLIs.
// The authoritative fix lives in services/docker.js; this is a safeguard so the
// renderer and any other child processes inherit a sane PATH too.
function fixPath() {
  if (process.platform === 'win32') {
    return
  }
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const shellPath = execSync(`${shell} -ilc 'echo -n "$PATH"'`, {
      encoding: 'utf8',
      timeout: 5000
    }).trim()

    const fallbacks = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin'
    ]

    const parts = [
      ...(shellPath ? shellPath.split(':') : []),
      ...fallbacks,
      ...(process.env.PATH ? process.env.PATH.split(':') : [])
    ]

    const seen = new Set()
    process.env.PATH = parts.filter(p => p && !seen.has(p) && seen.add(p)).join(':')
  } catch (error) {
    // Leave PATH untouched; services/docker.js still applies its own fallbacks.
  }
}

fixPath()

app.allowRendererProcessReuse = true

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([{scheme: 'app', privileges: { secure: true, standard: true } }])

// Window controls for the frameless window (replaces the removed `remote` module)
ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender).minimize()
})

ipcMain.on('window-close', (event) => {
  BrowserWindow.fromWebContents(event.sender).close()
})

// Expose writable/bundled paths so the renderer can resolve a data root for the
// generated nginx configuration (the packaged app bundle is read-only).
ipcMain.handle('get-app-paths', () => ({
  userData: app.getPath('userData'),
  resources: process.resourcesPath || null,
  isPackaged: app.isPackaged
}))

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({ 
    width: 800, 
    height: 600, 
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    } 
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools({ mode: 'detach' })
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')

    if (process.platform !== 'linux') {
      if (process.env.DEBUG) {
        autoUpdater.logger = require('electron-log')
        autoUpdater.logger.transports.file.level = 'debug'
      }
      autoUpdater.checkForUpdatesAndNotify()
    }
  }

  win.on('closed', () => {
    win = null
  })
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', data => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}
