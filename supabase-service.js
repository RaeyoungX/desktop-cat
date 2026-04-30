const { createClient } = require('@supabase/supabase-js')
const Store = require('electron-store')

const store = new Store()

// 用户需填入自己的 Supabase 项目配置
const SUPABASE_URL  = 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON = 'YOUR_ANON_KEY'

let supabase = null

function getClient() {
  if (!supabase) supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  return supabase
}

// ── Auth ──────────────────────────────────────────────────────────

async function signUp(email, password) {
  const { data, error } = await getClient().auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data.user
}

async function signIn(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  store.set('auth_session', data.session)
  return data.user
}

async function signOut() {
  await getClient().auth.signOut()
  store.delete('auth_session')
}

async function getUser() {
  // 先从本地 session 恢复
  const session = store.get('auth_session')
  if (!session) return null
  const { data, error } = await getClient().auth.getUser(session.access_token)
  if (error || !data.user) { store.delete('auth_session'); return null }
  return data.user
}

// ── 积分同步 ──────────────────────────────────────────────────────

async function syncPoints({ points, totalSessions, totalMins }) {
  const user = await getUser()
  if (!user) return { ok: false }

  const { error } = await getClient()
    .from('user_stats')
    .upsert({
      user_id: user.id,
      points,
      total_sessions: totalSessions,
      total_mins: totalMins,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) throw new Error(error.message)
  return { ok: true }
}

async function getLeaderboard() {
  const { data, error } = await getClient()
    .from('user_stats')
    .select('user_id, points, total_mins')
    .order('points', { ascending: false })
    .limit(10)
  if (error) return []
  return data
}

module.exports = { signUp, signIn, signOut, getUser, syncPoints, getLeaderboard }
