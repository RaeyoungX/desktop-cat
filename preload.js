const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cat', {
  onCursor:       (cb)    => ipcRenderer.on('cursor',      (_, pos)   => cb(pos)),
  onComeHere:     (cb)    => ipcRenderer.on('come-here',   (_, pos)   => cb(pos)),
  onEquipItems:   (cb)    => ipcRenderer.on('equip-items', (_, items) => cb(items)),
  onShowBubble:   (cb)    => ipcRenderer.on('show-bubble', (_, text)  => cb(text)),
  move:           (pos)   => ipcRenderer.send('move', pos),
  getScreenSize:  ()      => ipcRenderer.invoke('screen-size'),
  startTask:      (task)  => ipcRenderer.send('start-task', task),
  endTask:        ()      => ipcRenderer.send('end-task'),
  getSession:     ()      => ipcRenderer.invoke('get-session'),
  closeDashboard: ()      => ipcRenderer.send('close-dashboard'),
  equipItems:     (items) => ipcRenderer.send('equip-items', items),
  setMouseIgnore:   (val)   => ipcRenderer.send('set-mouse-ignore', val),
  auth: {
    getUser:  ()                   => ipcRenderer.invoke('auth-get-user'),
    signIn:   (email, password)    => ipcRenderer.invoke('auth-signin', { email, password }),
    signUp:   (email, password)    => ipcRenderer.invoke('auth-signup', { email, password }),
    signOut:  ()                   => ipcRenderer.invoke('auth-signout'),
    sync:     (stats)              => ipcRenderer.invoke('auth-sync', stats),
  },
  getApiKey:        ()      => ipcRenderer.invoke('get-api-key'),
  setApiKey:        (key)   => ipcRenderer.send('set-api-key', key),
  onDistractDetected: (cb)  => ipcRenderer.on('distract-detected', cb),
  onTimeline:         (cb)  => ipcRenderer.on('timeline-entry', (_, entry) => cb(entry)),
})
