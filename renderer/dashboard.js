// ── Shop config ───────────────────────────────────────────────────

const SHOP_ITEMS = [
  { id: 'bow',     name: '蝴蝶结', icon: 'gift',     iconColor: '#db2777', iconBg: '#fce7f3', cost: 25, desc: '优雅满分' },
  { id: 'hat',     name: '礼帽',   icon: 'wand-2',   iconColor: '#374151', iconBg: '#f3f4f6', cost: 50, desc: '绅士猫咪' },
  { id: 'glasses', name: '墨镜',   icon: 'glasses',  iconColor: '#2563eb', iconBg: '#eff6ff', cost: 60, desc: '酷到爆炸' },
  { id: 'crown',   name: '王冠',   icon: 'crown',    iconColor: '#d97706', iconBg: '#fef9c3', cost: 80, desc: '朕乃猫王' },
  { id: 'stars',   name: '星星气', icon: 'sparkles', iconColor: '#7c3aed', iconBg: '#f5f3ff', cost: 40, desc: '闪闪发光' },
]

// ── Storage helpers ───────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

function loadTasks() {
  try {
    const d = JSON.parse(localStorage.getItem('cat_tasks') || '{}')
    return d.date === TODAY ? (d.tasks || []) : []
  } catch { return [] }
}

function saveTasks(tasks) {
  localStorage.setItem('cat_tasks', JSON.stringify({ date: TODAY, tasks }))
}

function loadSessions() {
  try {
    const d = JSON.parse(localStorage.getItem('cat_sessions') || '{}')
    return d.date === TODAY ? (d.sessions || []) : []
  } catch { return [] }
}

function addSession(s) {
  const sessions = loadSessions()
  sessions.push(s)
  localStorage.setItem('cat_sessions', JSON.stringify({ date: TODAY, sessions }))
}

function getPoints() {
  return parseInt(localStorage.getItem('cat_points') || '0')
}

function setPoints(n) {
  localStorage.setItem('cat_points', String(Math.max(0, n)))
}

function getShopData() {
  try {
    return JSON.parse(localStorage.getItem('cat_shop') || '{"owned":[],"equipped":[]}')
  } catch { return { owned: [], equipped: [] } }
}

function saveShopData(data) {
  localStorage.setItem('cat_shop', JSON.stringify(data))
}

// ── State ─────────────────────────────────────────────────────────

let tasks = loadTasks()
let selectedTaskId = null
let selectedMinutes = null
let timerInterval = null
let sessionStartTime = null
let sessionDuration = null

// ── DOM refs ──────────────────────────────────────────────────────

const viewIdle    = document.getElementById('viewIdle')
const viewActive  = document.getElementById('viewActive')
const closeBtn    = document.getElementById('closeBtn')
const closeBtn2   = document.getElementById('closeBtn2')
const addTaskBtn  = document.getElementById('addTaskBtn')
const addInputRow = document.getElementById('addInputRow')
const newTaskInput = document.getElementById('newTaskInput')
const confirmAddBtn = document.getElementById('confirmAddBtn')
const taskListEl  = document.getElementById('taskList')
const focusName   = document.getElementById('focusName')
const startBtn    = document.getElementById('startBtn')
const endBtn      = document.getElementById('endBtn')
const customRow   = document.getElementById('customRow')
const customMin   = document.getElementById('customMin')

const sessionCountEl  = document.getElementById('sessionCount')
const totalMinsEl     = document.getElementById('totalMins')
const pointsDisplayEl = document.getElementById('pointsDisplay')
const shopPointsEl    = document.getElementById('shopPoints')

const activeTaskName      = document.getElementById('activeTaskName')
const activeDurationLabel = document.getElementById('activeDurationLabel')
const activeTimerEl       = document.getElementById('activeTimer')
const progressFill        = document.getElementById('progressFill')

// ── Stats ─────────────────────────────────────────────────────────

function refreshStats() {
  const sessions = loadSessions()
  sessionCountEl.textContent = sessions.length
  totalMinsEl.textContent = sessions.reduce((s, x) => s + (x.duration || 0), 0)
  const pts = getPoints()
  pointsDisplayEl.textContent = pts
  shopPointsEl.textContent = pts
}

// ── Task list ─────────────────────────────────────────────────────

function renderTasks() {
  taskListEl.innerHTML = ''
  const active = tasks.filter(t => !t.done)
  const done   = tasks.filter(t => t.done)
  const sorted = [...active, ...done]

  if (sorted.length === 0) {
    taskListEl.innerHTML = '<div class="empty-hint">还没有任务，点击 "+ 添加"</div>'
    return
  }

  sorted.forEach(task => {
    const el = document.createElement('div')
    el.className = 'task-item' +
      (task.id === selectedTaskId ? ' selected' : '') +
      (task.done ? ' done' : '')

    el.innerHTML = `
      <div class="task-check">${task.done ? '<i data-lucide="check" style="width:9px;height:9px"></i>' : ''}</div>
      <div class="task-text">${escHtml(task.text)}</div>
      <button class="task-del" data-id="${task.id}" title="删除"><i data-lucide="x" style="width:12px;height:12px"></i></button>
    `

    el.addEventListener('click', e => {
      if (e.target.classList.contains('task-del')) return
      if (task.done) { task.done = false; saveTasks(tasks); renderTasks(); return }
      selectedTaskId = selectedTaskId === task.id ? null : task.id
      focusName.value = selectedTaskId ? task.text : ''
      saveTasks(tasks); renderTasks(); updateStartBtn()
    })

    el.querySelector('.task-check').addEventListener('click', e => {
      e.stopPropagation()
      task.done = !task.done
      if (task.done && selectedTaskId === task.id) { selectedTaskId = null; focusName.value = '' }
      saveTasks(tasks); renderTasks(); updateStartBtn()
    })

    el.querySelector('.task-del').addEventListener('click', e => {
      e.stopPropagation()
      tasks = tasks.filter(t => t.id !== task.id)
      if (selectedTaskId === task.id) { selectedTaskId = null; focusName.value = '' }
      saveTasks(tasks); renderTasks(); updateStartBtn()
    })

    taskListEl.appendChild(el)
  })
  lucide.createIcons()
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Add task ──────────────────────────────────────────────────────

addTaskBtn.addEventListener('click', () => {
  addInputRow.classList.toggle('visible')
  if (addInputRow.classList.contains('visible')) newTaskInput.focus()
})

function commitAddTask() {
  const text = newTaskInput.value.trim()
  if (!text) { addInputRow.classList.remove('visible'); return }
  const task = { id: Date.now().toString(), text, done: false }
  tasks.push(task)
  saveTasks(tasks)
  newTaskInput.value = ''
  addInputRow.classList.remove('visible')
  selectedTaskId = task.id
  focusName.value = task.text
  renderTasks(); updateStartBtn()
}

confirmAddBtn.addEventListener('click', commitAddTask)
newTaskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') commitAddTask()
  if (e.key === 'Escape') { addInputRow.classList.remove('visible'); newTaskInput.value = '' }
})

// ── Focus name ────────────────────────────────────────────────────

focusName.addEventListener('input', () => { selectedTaskId = null; renderTasks(); updateStartBtn() })

// ── Time chips ────────────────────────────────────────────────────

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
    chip.classList.add('active')
    if (chip.dataset.value === 'custom') {
      customRow.classList.add('visible')
      selectedMinutes = parseInt(customMin.value) || null
      customMin.focus()
    } else {
      customRow.classList.remove('visible')
      selectedMinutes = parseInt(chip.dataset.value)
    }
    updateStartBtn()
  })
})

customMin.addEventListener('input', () => { selectedMinutes = parseInt(customMin.value) || null; updateStartBtn() })

function updateStartBtn() {
  startBtn.disabled = !(focusName.value.trim().length > 0 && selectedMinutes)
}

// ── Profile & Auth ────────────────────────────────────────────────

const LEVELS = [
  { name: '见习监工', min: 0,    max: 99   },
  { name: '初级监工', min: 100,  max: 299  },
  { name: '资深监工', min: 300,  max: 599  },
  { name: '专家监工', min: 600,  max: 999  },
  { name: '传奇监工', min: 1000, max: Infinity },
]

function getLevel(pts) {
  const idx = LEVELS.findIndex(l => pts >= l.min && pts <= l.max)
  return { ...LEVELS[idx], idx: idx + 1 }
}

let authMode = 'login'  // 'login' | 'register'

const PLAN_QUOTA = { free: 5, light: 20, pro: 60, power: 120 }  // hours/month
const PLAN_LABEL = { free: 'FREE', light: 'LIGHT', pro: 'PRO', power: 'POWER' }
const PLAN_NAME  = { free: '免费版', light: 'Light · 20h/月', pro: 'Pro · 60h/月', power: 'Power · 120h/月' }

const MOCK_USER = {
  email: 'rae@example.com',
  mockSessions: [
    { name: '写代码', duration: 45, startTime: Date.now() - 3600000 },
    { name: '整理文档', duration: 25, startTime: Date.now() - 7200000 },
    { name: '产品设计', duration: 60, startTime: Date.now() - 10800000 },
    { name: '写周报', duration: 30, startTime: Date.now() - 86400000 },
    { name: '需求评审', duration: 90, startTime: Date.now() - 90000000 },
  ],
  mockPoints: 380,
  mockPlan: 'pro',        // 'free' | 'light' | 'pro' | 'power'
  mockProExpiry: '2026-12-31',
  mockUsedHours: 12.5,   // 本月已用 AI 检测小时数
}

async function renderProfile() {
  lucide.createIcons()
  // mock: 始终显示已登录状态
  document.getElementById('authPanel').style.display    = 'none'
  document.getElementById('profilePanel').style.display = 'flex'
  renderProfilePanel(MOCK_USER)
}

function renderAuthPanel() {
  const loginBtn    = document.getElementById('loginTabBtn')
  const registerBtn = document.getElementById('registerTabBtn')
  const submitBtn   = document.getElementById('authSubmitBtn')

  loginBtn.onclick = () => {
    authMode = 'login'
    loginBtn.classList.add('active')
    registerBtn.classList.remove('active')
    submitBtn.textContent = '登录'
    document.getElementById('authError').textContent = ''
  }
  registerBtn.onclick = () => {
    authMode = 'register'
    registerBtn.classList.add('active')
    loginBtn.classList.remove('active')
    submitBtn.textContent = '注册'
    document.getElementById('authError').textContent = ''
  }

  submitBtn.onclick = async () => {
    const email    = document.getElementById('authEmail').value.trim()
    const password = document.getElementById('authPassword').value
    const errEl    = document.getElementById('authError')
    if (!email || !password) { errEl.textContent = '请填写邮箱和密码'; return }
    submitBtn.disabled = true
    submitBtn.textContent = '请稍候...'
    try {
      if (authMode === 'login') {
        await window.cat.auth.signIn(email, password)
      } else {
        await window.cat.auth.signUp(email, password)
      }
      renderProfile()
    } catch (e) {
      errEl.textContent = e.message
      submitBtn.disabled = false
      submitBtn.textContent = authMode === 'login' ? '登录' : '注册'
    }
  }
}

function renderProfilePanel(user) {
  const pts      = user.mockPoints  ?? getPoints()
  const sessions = user.mockSessions ?? loadSessions()
  const lv       = getLevel(pts)

  // header
  document.getElementById('profileEmail').textContent = user.email
  document.getElementById('profileLevelBadge').textContent = lv.name
  document.getElementById('profileAvatar').textContent =
    ['🐱','😺','😸','😹','😻','🙀'][lv.idx - 1] || '🐱'

  // level card
  document.getElementById('levelNum').textContent  = `Lv.${lv.idx}`
  document.getElementById('levelName').textContent = lv.name
  document.getElementById('levelPtsCurrent').textContent = pts
  const nextMax = lv.max === Infinity ? pts : lv.max + 1
  document.getElementById('levelPtsNext').textContent = lv.max === Infinity ? '∞' : nextMax
  const pct = lv.max === Infinity ? 100 : Math.round(((pts - lv.min) / (lv.max - lv.min + 1)) * 100)
  document.getElementById('levelBarFill').style.width = pct + '%'

  // stats
  const totalMins = sessions.reduce((s, x) => s + (x.duration || 0), 0)
  document.getElementById('totalPts').textContent          = pts
  document.getElementById('totalSessions').textContent     = sessions.length
  document.getElementById('totalMinsProfile').textContent  = totalMins

  // plan section
  renderPlanSection(user.mockPlan || 'free', user.mockProExpiry)

  // sync
  document.getElementById('syncBtn').onclick = async () => {
    const statusEl = document.getElementById('syncStatus')
    statusEl.textContent = '同步中...'
    try {
      await window.cat.auth.sync({ points: pts, totalSessions: sessions.length, totalMins })
      statusEl.textContent = '同步成功 ✓'
    } catch { statusEl.textContent = '同步失败，请重试' }
  }

  // logout
  document.getElementById('logoutBtn').onclick = async () => {
    await window.cat.auth.signOut()
    renderProfile()
  }

  // history
  const list = document.getElementById('ptsHistoryList')
  list.innerHTML = ''
  const recent = [...sessions].reverse().slice(0, 5)
  if (recent.length === 0) {
    list.innerHTML = '<div style="font-size:12px;color:#bbb;text-align:center;padding:8px">还没有专注记录</div>'
  } else {
    recent.forEach(s => {
      const el = document.createElement('div')
      el.className = 'history-item'
      const time = s.startTime ? new Date(s.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''
      el.innerHTML = `
        <div class="history-icon">
          <i data-lucide="zap" style="width:13px;height:13px;color:#6d28d9"></i>
        </div>
        <div>
          <div class="history-name">${escHtml(s.name || '专注会话')}</div>
          <div class="history-meta">${time} · ${s.duration} 分钟</div>
        </div>
        <div class="history-pts">+${s.duration}</div>
      `
      list.appendChild(el)
    })
  }
  lucide.createIcons()
}

function renderPlanSection(plan, proExpiry) {
  const el = document.getElementById('planSection')
  if (!el) return

  const quota      = PLAN_QUOTA[plan] ?? 5
  const usedHours  = MOCK_USER.mockUsedHours ?? 0
  const remaining  = Math.max(0, quota - usedHours)
  const usedPct    = Math.min(100, Math.round((usedHours / quota) * 100))
  const isFree     = plan === 'free'
  const isPaid     = !isFree

  // quota bar color state
  const fillClass  = usedPct >= 100 ? 'empty' : usedPct >= 80 ? 'danger' : usedPct >= 60 ? 'warn' : ''
  const remClass   = usedPct >= 100 ? 'danger' : usedPct >= 80 ? 'danger' : usedPct >= 60 ? 'warn' : ''
  const remText    = usedPct >= 100
    ? '额度已用完，AI 检测已暂停'
    : `还剩 ${remaining.toFixed(1)} 小时`

  const expiry = proExpiry
    ? new Date(proExpiry).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  el.innerHTML = `
    <div class="plan-section-wrap">
      <div class="plan-row">
        <span class="plan-badge ${plan}">${PLAN_LABEL[plan] ?? 'FREE'}</span>
        <div class="plan-row-text">
          <div class="plan-row-title">${PLAN_NAME[plan] ?? '免费版'}</div>
          ${isPaid && expiry ? `<div class="plan-row-sub">有效期至 ${expiry}</div>` : ''}
          ${isFree ? '<div class="plan-row-sub">¥28/年升级 Light，解锁 20h/月</div>' : ''}
        </div>
        ${isPaid
          ? `<button class="plan-action-btn manage" id="managePlanBtn">管理</button>`
          : `<button class="plan-action-btn upgrade" id="upgradeBtn">升级</button>`
        }
      </div>

      <div class="quota-block">
        <div class="quota-top">
          <span class="quota-label">本月 AI 检测用量</span>
          <span class="quota-nums"><strong>${usedHours.toFixed(1)}</strong> / ${quota}h</span>
        </div>
        <div class="quota-track">
          <div class="quota-fill ${fillClass}" style="width:${usedPct}%"></div>
        </div>
        <div class="quota-bottom">
          <span class="quota-remaining ${remClass}">${remText}</span>
          ${usedPct >= 60 && isFree
            ? `<span class="quota-upgrade-hint" id="quotaHintUpgrade">升级获得更多 →</span>`
            : usedPct >= 60 && isPaid && plan !== 'power'
            ? `<span class="quota-upgrade-hint" id="quotaHintUpgrade">升级套餐 →</span>`
            : ''
          }
        </div>
      </div>
    </div>
  `

  if (document.getElementById('upgradeBtn')) {
    document.getElementById('upgradeBtn').onclick = () => {
      MOCK_USER.mockPlan = 'light'
      MOCK_USER.mockProExpiry = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]
      renderPlanSection('light', MOCK_USER.mockProExpiry)
    }
  }
  if (document.getElementById('quotaHintUpgrade')) {
    document.getElementById('quotaHintUpgrade').onclick = () => {
      document.querySelector('[data-tab="profile"]')?.click()
    }
  }
  lucide.createIcons()
}

// ── Quota helpers ─────────────────────────────────────────────────

function getQuotaRemaining() {
  const quota = PLAN_QUOTA[MOCK_USER.mockPlan] ?? 5
  return Math.max(0, quota - (MOCK_USER.mockUsedHours ?? 0))
}

function updateActiveQuota() {
  const el = document.getElementById('activeQuota')
  if (!el) return
  const rem  = getQuotaRemaining()
  const pct  = (MOCK_USER.mockUsedHours ?? 0) / (PLAN_QUOTA[MOCK_USER.mockPlan] ?? 5)
  el.className = 'active-quota'
  if (pct >= 1) {
    el.className += ' danger'
    el.textContent = '⚠ AI 检测额度已用完'
  } else if (pct >= 0.8) {
    el.className += ' danger'
    el.textContent = `本月 AI 检测仅剩 ${rem.toFixed(1)}h`
  } else if (pct >= 0.6) {
    el.className += ' warn'
    el.textContent = `本月 AI 检测剩余 ${rem.toFixed(1)}h`
  }
  // else hidden
}

function updateQuotaBanner() {
  const banner  = document.getElementById('quotaWarnBanner')
  const warnTxt = document.getElementById('quotaWarnText')
  if (!banner) return
  const rem = getQuotaRemaining()
  const pct = (MOCK_USER.mockUsedHours ?? 0) / (PLAN_QUOTA[MOCK_USER.mockPlan] ?? 5)
  if (pct >= 1) {
    banner.classList.add('visible')
    warnTxt.textContent = `本月 AI 检测额度已用完（${PLAN_QUOTA[MOCK_USER.mockPlan]}h）`
  } else if (pct >= 0.8) {
    banner.classList.add('visible')
    warnTxt.textContent = `AI 检测额度告急，仅剩 ${rem.toFixed(1)}h`
    banner.style.background = '#fff7ed'
    banner.style.color = '#c2410c'
  } else {
    banner.classList.remove('visible')
  }

  const upgradeBtn = document.getElementById('quotaUpgradeBtn')
  if (upgradeBtn) {
    upgradeBtn.onclick = () => document.querySelector('[data-tab="profile"]')?.click()
  }
}

// ── Tabs ──────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    tab.classList.add('active')
    const which = tab.dataset.tab
    document.getElementById('tabTasks').style.display   = which === 'tasks'   ? 'flex' : 'none'
    document.getElementById('tabShop').style.display    = which === 'shop'    ? 'flex' : 'none'
    document.getElementById('tabSummary').style.display = which === 'summary' ? 'flex' : 'none'
    document.getElementById('tabProfile').style.display = which === 'profile' ? 'flex' : 'none'
    if (which === 'shop')    renderShop()
    if (which === 'summary') renderSummary()
    if (which === 'profile') renderProfile()
  })
})

// ── Shop ──────────────────────────────────────────────────────────

function renderShop() {
  refreshStats()
  const pts = getPoints()
  const { owned, equipped } = getShopData()
  const list = document.getElementById('shopList')
  list.innerHTML = ''

  for (const item of SHOP_ITEMS) {
    const isOwned    = owned.includes(item.id)
    const isEquipped = equipped.includes(item.id)
    const canBuy     = !isOwned && pts >= item.cost

    const el = document.createElement('div')
    el.className = 'shop-item' + (isEquipped ? ' equipped' : isOwned ? ' owned' : '')

    let rightHtml
    if (!isOwned) {
      rightHtml = `
        <span class="item-cost ${canBuy ? 'can-afford' : ''}">
          <i data-lucide="star" style="width:10px;height:10px"></i>${item.cost}
        </span>
        <button class="shop-btn ${canBuy ? 'buy-can' : 'buy-cant'}" data-action="buy" data-id="${item.id}" ${canBuy ? '' : 'disabled'}>购买</button>
      `
    } else if (isEquipped) {
      rightHtml = `
        <button class="shop-btn unequip" data-action="unequip" data-id="${item.id}">
          <i data-lucide="check" style="width:11px;height:11px"></i>已装备
        </button>`
    } else {
      rightHtml = `<button class="shop-btn equip" data-action="equip" data-id="${item.id}">装备</button>`
    }

    el.innerHTML = `
      <div class="item-icon-wrap" style="background:${item.iconBg}">
        <i data-lucide="${item.icon}" style="width:18px;height:18px;color:${item.iconColor}"></i>
      </div>
      <div class="item-info">
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.desc}</div>
      </div>
      ${rightHtml}
    `
    list.appendChild(el)
  }

  lucide.createIcons()

  list.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const { action, id } = btn.dataset
      if (action === 'buy') buyItem(id)
      else if (action === 'equip') toggleEquip(id, true)
      else if (action === 'unequip') toggleEquip(id, false)
    })
  })
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(i => i.id === id)
  if (!item) return
  const pts = getPoints()
  if (pts < item.cost) return
  setPoints(pts - item.cost)
  const data = getShopData()
  if (!data.owned.includes(id)) data.owned.push(id)
  saveShopData(data)
  renderShop()
}

function toggleEquip(id, equip) {
  const data = getShopData()
  if (equip) {
    if (!data.equipped.includes(id)) data.equipped.push(id)
  } else {
    data.equipped = data.equipped.filter(i => i !== id)
  }
  saveShopData(data)
  window.cat.equipItems(data.equipped)
  renderShop()
}

// ── Summary ───────────────────────────────────────────────────────

const WEEK_MOCK = [42, 25, 0, 58, 71, 30]  // Mon–Sat mock minutes (Sun = today)

// mock hourly focus data for today (hour → minutes)
const HOUR_MOCK = { 9: 25, 10: 20, 11: 45, 14: 30, 15: 28, 16: 13, 20: 60, 21: 32 }

// mock sessions for summary when no real sessions exist today
const SUMMARY_MOCK_SESSIONS = [
  { name: '写代码',   duration: 45, startTime: Date.now() - 3600000  },
  { name: '产品设计', duration: 60, startTime: Date.now() - 7200000  },
  { name: '写代码',   duration: 30, startTime: Date.now() - 9000000  },
  { name: '整理文档', duration: 25, startTime: Date.now() - 10800000 },
  { name: '写周报',   duration: 30, startTime: Date.now() - 86400000 },
]

function renderSummary() {
  const sessions = loadSessions()
  const todayMins = sessions.reduce((s, x) => s + (x.duration || 0), 0)
  const todayCount = sessions.length
  const todayTasks = tasks.filter(t => t.done).length
  const pts = getPoints()

  // Date label
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
  document.getElementById('summaryDate').textContent = dateStr

  // Hero number
  document.getElementById('summaryHeroNum').innerHTML =
    `${todayMins}<span class="unit">分钟</span>`

  // Stat cards
  document.getElementById('sumSessions').textContent = todayCount
  document.getElementById('sumTasks').textContent = todayTasks
  document.getElementById('sumPoints').textContent = pts

  // Cat message
  let msg
  if (todayMins === 0)      msg = '今天还没开始哦，一起努力吧～'
  else if (todayMins < 30)  msg = '有个好开始！继续加油喵～'
  else if (todayMins < 60)  msg = '专注了半小时，不错哦！'
  else if (todayMins < 120) msg = '哇，超过一小时了！真厉害喵！'
  else                       msg = '今天是满状态！本猫给你满分！'
  document.getElementById('catMessage').textContent = msg

  // Weekly bar chart
  const days = ['一', '二', '三', '四', '五', '六', '日']
  const todayDow = now.getDay()  // 0=Sun
  const allMins = [...WEEK_MOCK, todayMins]  // 7 values Mon-Sun
  // Reorder so chart always shows Mon→Sun
  const ordered = days.map((_, i) => {
    const dow = i === 6 ? 0 : i + 1  // i=0→Mon(1)...i=5→Sat(6), i=6→Sun(0)
    return { label: days[i], mins: dow === todayDow ? todayMins : allMins[i], isToday: dow === todayDow }
  })

  const maxMins = Math.max(...ordered.map(d => d.mins), 1)
  const chart = document.getElementById('weekChart')
  chart.innerHTML = ''
  for (const d of ordered) {
    const pct = Math.round((d.mins / maxMins) * 100)
    const col = document.createElement('div')
    col.className = 'week-col'
    col.innerHTML = `
      <div class="week-bar-wrap">
        <div class="week-bar${d.isToday ? ' today' : ''}" style="height:${Math.max(pct, d.mins > 0 ? 8 : 0)}%"
             title="${d.mins} 分钟"></div>
      </div>
      <div class="week-day${d.isToday ? ' today' : ''}">${d.label}</div>
    `
    chart.appendChild(col)
  }

  // ── Hourly chart ──────────────────────────────────────────────
  const hourData = sessions.length ? {} : { ...HOUR_MOCK }
  if (sessions.length) {
    sessions.forEach(s => {
      if (!s.startTime) return
      const h = new Date(s.startTime).getHours()
      hourData[h] = (hourData[h] || 0) + (s.duration || 0)
    })
  }
  const SHOW_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]
  const maxHourMins = Math.max(...SHOW_HOURS.map(h => hourData[h] || 0), 1)
  const hourChart = document.getElementById('hourChart')
  hourChart.innerHTML = ''
  SHOW_HOURS.forEach(h => {
    const mins = hourData[h] || 0
    const pct  = Math.round((mins / maxHourMins) * 100)
    const intensity = pct >= 70 ? 'peak' : pct >= 30 ? 'mid' : ''
    const col  = document.createElement('div')
    col.className = 'hour-col'
    const showLabel = h % 3 === 0
    col.innerHTML = `
      <div class="hour-bar-wrap">
        <div class="hour-bar ${intensity}" style="height:${Math.max(pct, mins > 0 ? 8 : 0)}%" title="${mins} 分钟"></div>
      </div>
      <div class="hour-label ${showLabel ? 'marked' : ''}">${showLabel ? h : ''}</div>
    `
    hourChart.appendChild(col)
  })

  // ── Task breakdown ─────────────────────────────────────────────
  const srcSessions = sessions.length ? sessions : SUMMARY_MOCK_SESSIONS
  const taskMap = {}
  srcSessions.forEach(s => {
    const name = s.name || '专注会话'
    taskMap[name] = (taskMap[name] || 0) + (s.duration || 0)
  })
  const taskEntries = Object.entries(taskMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxTaskMins = Math.max(...taskEntries.map(e => e[1]), 1)
  const breakdown = document.getElementById('taskBreakdown')
  breakdown.innerHTML = ''
  taskEntries.forEach(([name, mins]) => {
    const pct = Math.round((mins / maxTaskMins) * 100)
    const row = document.createElement('div')
    row.className = 'task-bar-row'
    row.innerHTML = `
      <div class="task-bar-name" title="${escHtml(name)}">${escHtml(name)}</div>
      <div class="task-bar-track">
        <div class="task-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="task-bar-mins">${mins}分</div>
    `
    breakdown.appendChild(row)
  })

  // ── Mini stats ─────────────────────────────────────────────────
  const allSessions = sessions.length ? sessions : SUMMARY_MOCK_SESSIONS
  const avgMins  = allSessions.length ? Math.round(allSessions.reduce((s,x) => s+(x.duration||0),0) / allSessions.length) : 0
  const bestMins = allSessions.length ? Math.max(...allSessions.map(s => s.duration || 0)) : 0
  const weekAll  = [...WEEK_MOCK, todayMins]
  let streak = 0
  for (let i = weekAll.length - 1; i >= 0; i--) {
    if (weekAll[i] > 0) streak++
    else break
  }
  document.getElementById('sumAvg').textContent    = avgMins  ? avgMins + '分'  : '—'
  document.getElementById('sumBest').textContent   = bestMins ? bestMins + '分' : '—'
  document.getElementById('sumStreak').textContent = streak   ? streak + '天'   : '—'

  renderTimeline()
  lucide.createIcons()
}

// ── Start session ─────────────────────────────────────────────────

startBtn.addEventListener('click', () => {
  const name = focusName.value.trim()
  if (!name || !selectedMinutes) return
  sessionStartTime = Date.now()
  sessionDuration  = selectedMinutes
  activeTaskName.textContent = name
  document.getElementById('activeDurationText').textContent = `计划 ${selectedMinutes} 分钟`
  progressFill.style.width = '0%'
  window.cat.startTask({ name, duration: selectedMinutes })
  showActiveView()
})

// ── Active view ───────────────────────────────────────────────────

let sessionDistractCount = 0

function updateDistractIndicator(count) {
  const el   = document.getElementById('distractIndicator')
  const text = document.getElementById('distractText')
  if (!el || !text) return

  el.classList.add('visible')
  el.classList.remove('ok', 'warn', 'danger', 'alarm')

  if (count === 0) {
    el.classList.add('ok')
    text.textContent = '专注状态良好'
  } else if (count <= 2) {
    el.classList.add('warn')
    text.textContent = `分心 ${count} 次 · 加把劲！`
  } else if (count <= 4) {
    el.classList.add('danger')
    text.textContent = `分心 ${count} 次 · 需要调整状态`
  } else {
    el.classList.add('alarm')
    text.textContent = `分心 ${count} 次 · 考虑休息一下`
  }
}

window.cat.onDistractDetected((_, count) => {
  sessionDistractCount = count
  updateDistractIndicator(count)
})

function showActiveView() {
  sessionDistractCount = 0
  const el = document.getElementById('distractIndicator')
  if (el) { el.classList.remove('visible', 'ok', 'warn', 'danger', 'alarm') }
  viewIdle.style.display = 'none'
  viewActive.style.display = 'flex'
  updateActiveQuota()
  startTimer()
}

function showIdleView() {
  viewActive.style.display = 'none'
  viewIdle.style.display = 'flex'
  stopTimer()
  refreshStats()
}

function startTimer() {
  stopTimer()
  updateTimer()
  timerInterval = setInterval(updateTimer, 1000)
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
  const m = Math.floor(elapsed / 60)
  const s = elapsed % 60
  activeTimerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  const pct = Math.min(100, (elapsed / (sessionDuration * 60)) * 100)
  progressFill.style.width = pct + '%'
  if (elapsed >= sessionDuration * 60) finishSession()
}

function finishSession() {
  stopTimer()

  // Award points (1 per minute)
  setPoints(getPoints() + sessionDuration)

  addSession({
    name: activeTaskName.textContent,
    duration: sessionDuration,
    startTime: sessionStartTime,
    endTime: Date.now(),
  })

  // Mark selected task done
  if (selectedTaskId) {
    const t = tasks.find(t => t.id === selectedTaskId)
    if (t) { t.done = true; saveTasks(tasks) }
  }

  window.cat.endTask()
  showIdleView()

  // Reset form
  selectedTaskId = null
  focusName.value = ''
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'))
  selectedMinutes = null
  customRow.classList.remove('visible')
  renderTasks()
  updateStartBtn()
}

endBtn.addEventListener('click', finishSession)
closeBtn.addEventListener('click',  () => window.cat.closeDashboard())
closeBtn2.addEventListener('click', () => window.cat.closeDashboard())

focusName.addEventListener('input', updateStartBtn)

// ── Timeline ──────────────────────────────────────────────────────

function loadTimeline() {
  try {
    return JSON.parse(localStorage.getItem('cat_timeline_' + TODAY) || '[]')
  } catch { return [] }
}

function saveTimeline(entries) {
  localStorage.setItem('cat_timeline_' + TODAY, JSON.stringify(entries))
}

function renderTimeline() {
  const list = document.getElementById('timelineList')
  if (!list) return
  const entries = loadTimeline()

  if (!entries.length) {
    list.innerHTML = '<div class="tl-empty">完成一次专注后自动生成</div>'
    return
  }

  list.innerHTML = ''
  // 只显示最近 20 条，时间倒序
  const recent = [...entries].reverse().slice(0, 20)
  for (const e of recent) {
    const t = new Date(e.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    const el = document.createElement('div')
    el.className = 'tl-item'
    el.innerHTML = `
      <div class="tl-dot ${e.status}">
        <i data-lucide="${e.status === 'distracted' ? 'zap-off' : 'zap'}" style="width:11px;height:11px"></i>
      </div>
      <div class="tl-body">
        <div class="tl-activity ${e.status}">${escHtml(e.activity)}</div>
        <div class="tl-time">${t}</div>
      </div>
    `
    list.appendChild(el)
  }
  lucide.createIcons()
}

// 接收主进程推来的时间线条目并存储
window.cat.onTimeline((entry) => {
  const entries = loadTimeline()
  entries.push(entry)
  saveTimeline(entries)
})

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  lucide.createIcons()
  refreshStats()
  renderTasks()
  updateStartBtn()

  updateQuotaBanner()

  // Send current equipped items to cat on startup
  const { equipped } = getShopData()
  window.cat.equipItems(equipped)

  // Restore active session if still running
  const session = await window.cat.getSession()
  if (session) {
    sessionStartTime = session.startTime
    sessionDuration  = session.duration
    activeTaskName.textContent = session.name
    document.getElementById('activeDurationText').textContent = `计划 ${session.duration} 分钟`
    showActiveView()
  } else {
    focusName.focus()
  }
}

init()
