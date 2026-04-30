const screenshot = require('screenshot-desktop')
const Anthropic = require('@anthropic-ai/sdk')
const Store = require('electron-store')

const store = new Store()

const INTERVAL_MS = 30_000        // 每 30 秒检测一次
const DISTRACT_THRESHOLD = 2      // 连续几次才触发提醒

let timer = null
let consecutiveDistracted = 0
let sessionDistractCount = 0      // 本次会话累计分心次数
let currentTask = null
let onDistractedCb = null
let onFocusedCb = null
let onActivityCb = null
let alerting = false              // 是否已在提醒状态

// ── 公共 API ──────────────────────────────────────────────────────

function getDistractCount() { return sessionDistractCount }

function start(taskName, { onDistracted, onFocused, onActivity } = {}) {
  stop()
  currentTask = taskName
  onDistractedCb = onDistracted
  onFocusedCb = onFocused
  onActivityCb = onActivity
  consecutiveDistracted = 0
  sessionDistractCount = 0
  alerting = false
  timer = setInterval(runCheck, INTERVAL_MS)
  // 30 秒后开始第一次，不立即检测（用户刚开始工作）
}

function stop() {
  if (timer) { clearInterval(timer); timer = null }
  currentTask = null
  consecutiveDistracted = 0
  alerting = false
}

function getApiKey() {
  return store.get('anthropic_api_key', '')
}

function setApiKey(key) {
  store.set('anthropic_api_key', key)
}

// ── 核心检测 ─────────────────────────────────────────────────────

async function runCheck() {
  const apiKey = getApiKey()
  if (!apiKey || !currentTask) return

  let imgBase64
  try {
    const imgBuffer = await screenshot({ format: 'jpg' })
    imgBase64 = imgBuffer.toString('base64')
  } catch (e) {
    console.warn('[detector] screenshot failed:', e.message)
    return
  }

  let result
  try {
    result = await analyzeWithClaude(apiKey, imgBase64, currentTask)
  } catch (e) {
    console.warn('[detector] AI call failed:', e.message)
    return
  }

  const { status, activity } = result

  // 每次检测都记录一条时间线
  onActivityCb?.({ time: Date.now(), status, activity })

  if (status === 'distracted') {
    consecutiveDistracted++
    if (consecutiveDistracted >= DISTRACT_THRESHOLD && !alerting) {
      alerting = true
      sessionDistractCount++
      onDistractedCb?.(sessionDistractCount)
    }
  } else {
    consecutiveDistracted = 0
    if (alerting) {
      alerting = false
      onFocusedCb?.()
    }
  }
}

async function analyzeWithClaude(apiKey, imgBase64, taskName) {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 128,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: imgBase64 },
        },
        {
          type: 'text',
          text: `用户正在专注完成任务：「${taskName}」

观察截图中屏幕内容，完成两件事：
1. 判断专注状态
2. 用一句话（8字以内）描述屏幕正在做的事

判断规则：
- focused：屏幕内容与任务直接相关（代码编辑器、文档、相关网页、终端等）
- distracted：与任务无关（社交媒体、视频网站、游戏、购物、聊天等娱乐内容）
- 屏幕模糊或无法判断时，status 返回 focused

只回复 JSON，格式：{"status":"focused","activity":"写 React 组件"} 或 {"status":"distracted","activity":"刷微博"}`,
        },
      ],
    }],
  })

  try {
    const text = response.content[0].text.trim()
    const json = JSON.parse(text.match(/\{.*\}/s)?.[0] || text)
    return {
      status:   json.status === 'distracted' ? 'distracted' : 'focused',
      activity: json.activity || (json.status === 'distracted' ? '未知活动' : '专注工作'),
    }
  } catch {
    return { status: 'focused', activity: '专注工作' }
  }
}

module.exports = { start, stop, getApiKey, setApiKey, runCheck, getDistractCount }
