import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { is } from '@electron-toolkit/utils'
import { resolveStaticFile } from './static'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

let mainWindow: BrowserWindow | null = null

function origin(value: string): string {
  return new URL(value).origin
}

const apiOrigin = origin(
  process.env.JUSTCAMPUS_API_URL ?? import.meta.env.MAIN_VITE_API_URL ?? 'http://localhost:3000'
)
const keycloakOrigin = origin(process.env.JUSTCAMPUS_KEYCLOAK_ORIGIN ?? 'http://localhost:8080')
const developmentUrl = process.env.JUSTCAMPUS_WEB_DEV_URL ?? 'http://localhost:5173'
const rendererDirectory = resolve(__dirname, '../renderer')

function isAllowedNavigation(url: string): boolean {
  try {
    const target = new URL(url)
    return (
      (target.protocol === 'app:' && target.host === '-') ||
      (is.dev && target.origin === origin(developmentUrl)) ||
      target.origin === apiOrigin ||
      target.origin === keycloakOrigin
    )
  } catch {
    return false
  }
}

function configureSession(): void {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (new URL(details.url).protocol !== 'app:')
      return callback({ responseHeaders: details.responseHeaders })

    const responseHeaders = { ...details.responseHeaders }
    responseHeaders['Content-Security-Policy'] = [
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' ${apiOrigin}; frame-src https: http://localhost:*; object-src 'none'; base-uri 'none'`
    ]
    callback({ responseHeaders })
  })
}

function openExternalUrl(value: string): Promise<void> {
  let target: URL
  try {
    target = new URL(value)
  } catch {
    return Promise.reject(new Error('A valid HTTP(S) URL is required'))
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return Promise.reject(new Error('A valid HTTP(S) URL is required'))
  }
  return shell.openExternal(target.toString())
}

function handleNavigation(window: BrowserWindow, event: Electron.Event, url: string): void {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    event.preventDefault()
    return
  }

  if (target.protocol === 'app:' && target.host === '-') {
    event.preventDefault()
    void window.loadURL(url)
  } else if (!isAllowedNavigation(url)) {
    event.preventDefault()
    void openExternalUrl(url).catch(() => {})
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--justcampus-api-url=${apiOrigin}`]
    }
  })
  mainWindow = window
  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    mainWindow = null
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    void openExternalUrl(url).catch(() => {})
    return { action: 'deny' }
  })
  window.webContents.on('will-redirect', (event, url) => handleNavigation(window, event, url))
  window.webContents.on('will-navigate', (event, url) => handleNavigation(window, event, url))

  if (is.dev) void window.loadURL(developmentUrl)
  else void window.loadURL('app://-/')
}

app.whenReady().then(() => {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    if (url.host !== '-') return new Response('Not found', { status: 404 })

    const file = resolveStaticFile(rendererDirectory, url.pathname)
    if (!file) return new Response('Not found', { status: 404 })
    return new Response(await readFile(file.path), { headers: { 'content-type': file.mimeType } })
  })
  configureSession()
  ipcMain.handle('justcampus:open-external', (_event, url: unknown) => {
    if (typeof url !== 'string') throw new Error('A valid HTTP(S) URL is required')
    return openExternalUrl(url)
  })
  createWindow()

  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
