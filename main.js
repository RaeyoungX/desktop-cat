const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut } = require('electron')
const path = require('path')
const detector = require('./distraction-detector')
const supa = require('./supabase-service')

let catWindow
let dashboardWindow
let tray
let currentSession = null   // { name, duration, startTime } | null

const CAT_W = 160
const CAT_H = 210

// ── Cat window ───────────────────────────────────────────────────

function createCatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  catWindow = new BrowserWindow({
    width: CAT_W, height: CAT_H,
    x: Math.floor(width / 2 - CAT_W / 2),
    y: height - CAT_H,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  catWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
  catWindow.setIgnoreMouseEvents(true, { forward: true })
  catWindow.hide()

  if (process.platform === 'darwin') {
    catWindow.setAlwaysOnTop(true, 'screen-saver')
    catWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  setInterval(() => {
    if (catWindow && !catWindow.isDestroyed()) {
      catWindow.webContents.send('cursor', screen.getCursorScreenPoint())
    }
  }, 33)
}

// ── Dashboard window ─────────────────────────────────────────────

function createDashboard() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  dashboardWindow = new BrowserWindow({
    width: 420, height: 520,
    minWidth: 360, minHeight: 460,
    x: Math.floor(width / 2 - 210),
    y: Math.floor(height / 2 - 260),
    resizable: true, frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#F5E441',
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  })

  dashboardWindow.loadFile(path.join(__dirname, 'renderer/dashboard.html'))
  dashboardWindow.on('closed', () => { dashboardWindow = null })
}

// ── Tray ─────────────────────────────────────────────────────────

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets/cat-loaf.png'))
  tray.setToolTip('Desktop Cat')
  updateTrayMenu()
}

function updateTrayMenu() {
  const sessionItem = currentSession
    ? { label: `🎯 ${currentSession.name} · ${currentSession.duration} 分钟`, enabled: false }
    : { label: '暂无进行中的任务', enabled: false }

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Desktop Cat 🐱', enabled: false },
    { type: 'separator' },
    sessionItem,
    { label: currentSession ? '查看专注' : '新任务', click: () => createDashboard() },
    { type: 'separator' },
    { label: '退出', click: () => app.quit() },
  ]))
}

// ── Distraction messages ──────────────────────────────────────────

function distractMsg(count) {
  if (count <= 2) return ['喂！别走神啦～', '回来！快回来！', '你的任务在等你喵～'][count - 1] || '喂！别走神啦～'
  if (count <= 4) return [`第${count}次分心了，加把劲！`, '再坚持一下，快好了喵～'][Math.min(count - 3, 1)]
  return count >= 7
    ? '今天有点累了？要不要休息一下喵...'
    : `已经分心${count}次了，需要换个任务吗？`
}

// ── IPC ──────────────────────────────────────────────────────────

ipcMain.on('move', (_, { x, y }) => {
  if (catWindow && !catWindow.isDestroyed()) {
    const nx = Number.isFinite(x) ? Math.round(x) : 0
    const ny = Number.isFinite(y) ? Math.round(y) : 0
    catWindow.setPosition(nx, ny)
  }
})

ipcMain.handle('screen-size', () => {
  const displays = screen.getAllDisplays()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of displays) {
    const { x, y, width, height } = d.workArea
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }
  return { width: maxX - minX, height: maxY - minY, originX: minX, originY: minY }
})

ipcMain.on('start-task', (_, task) => {
  currentSession = { ...task, startTime: Date.now() }
  updateTrayMenu()
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.show()
    setTimeout(() => catWindow.webContents.send('show-bubble', '我看着你呢！加油喵～'), 800)
  }

  detector.start(task.name, {
    onActivity: (entry) => {
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('timeline-entry', entry)
      }
    },
    onDistracted: (count) => {
      const cursor = screen.getCursorScreenPoint()
      if (catWindow && !catWindow.isDestroyed()) {
        catWindow.webContents.send('come-here', cursor)
        catWindow.webContents.send('show-bubble', distractMsg(count))
      }
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('distract-detected', count)
      }
    },
    onFocused: () => {
      if (catWindow && !catWindow.isDestroyed()) {
        catWindow.webContents.send('show-bubble', '很好，继续专注喵！')
      }
    },
  })
})

ipcMain.on('end-task', () => {
  detector.stop()
  currentSession = null
  updateTrayMenu()
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.webContents.send('show-bubble', '今天辛苦了！🐱')
    setTimeout(() => catWindow.hide(), 3000)
  }
})

ipcMain.handle('get-session', () => currentSession)

// ── Auth IPC ──────────────────────────────────────────────────────
ipcMain.handle('auth-get-user',  ()           => supa.getUser().catch(() => null))
ipcMain.handle('auth-signin',    (_, {email, password}) => supa.signIn(email, password))
ipcMain.handle('auth-signup',    (_, {email, password}) => supa.signUp(email, password))
ipcMain.handle('auth-signout',   ()           => supa.signOut())
ipcMain.handle('auth-sync',      (_, stats)   => supa.syncPoints(stats))

ipcMain.handle('get-api-key', () => detector.getApiKey())
ipcMain.on('set-api-key', (_, key) => detector.setApiKey(key))

ipcMain.on('close-dashboard', () => {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) dashboardWindow.close()
})

ipcMain.on('set-mouse-ignore', (_, val) => {
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.setIgnoreMouseEvents(val, { forward: true })
  }
})

ipcMain.on('equip-items', (_, items) => {
  if (catWindow && !catWindow.isDestroyed()) {
    catWindow.webContents.send('equip-items', items)
  }
})

// ── App lifecycle ─────────────────────────────────────────────────

app.whenReady().then(() => {
  createCatWindow()
  createTray()
  createDashboard()

  globalShortcut.register('CommandOrControl+Shift+K', () => {
    const cursor = screen.getCursorScreenPoint()
    if (catWindow && !catWindow.isDestroyed()) {
      catWindow.webContents.send('come-here', cursor)
    }
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => app.quit())
