// Shared state hook + utilities for all 3 cat-focus prototypes.
// Each variant gets its own isolated state via useCatApp().

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ── seed data ─────────────────────────────────────────────────
const SEED_TASKS = [
  { id: 't1', title: '写代码', minutes: 45, done: false },
  { id: 't2', title: '产品设计', minutes: 60, done: false },
  { id: 't3', title: '写周报', minutes: 30, done: false },
];

const SHOP_ITEMS = [
  { id: 'bow',    name: '蝴蝶结', desc: '优雅满分', price: 0,   icon: 'bow',    owned: true,  equipped: true  },
  { id: 'hat',    name: '礼帽',   desc: '绅士猫咪', price: 0,   icon: 'hat',    owned: true,  equipped: false },
  { id: 'glass',  name: '墨镜',   desc: '酷到爆炸', price: 60,  icon: 'glass',  owned: false, equipped: false },
  { id: 'crown',  name: '王冠',   desc: '朕乃陛下', price: 80,  icon: 'crown',  owned: false, equipped: false },
  { id: 'stars',  name: '星星气', desc: '闪闪发光', price: 40,  icon: 'stars',  owned: false, equipped: false },
  { id: 'scarf',  name: '围巾',   desc: '冬日暖意', price: 50,  icon: 'scarf',  owned: false, equipped: false },
];

const PRESETS = [25, 45, 60, 90];

// ── core hook ─────────────────────────────────────────────────
function useCatApp() {
  const [tab, setTab] = useState('focus');
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [duration, setDuration] = useState(25); // minutes
  const [points, setPoints] = useState(35);
  const [shop, setShop] = useState(SHOP_ITEMS);
  const [sessions, setSessions] = useState(0);
  const [focusedMin, setFocusedMin] = useState(0);
  const [history, setHistory] = useState([
    { title: '需求评审', minutes: 90, when: '12:11' },
    { title: '写周报',  minutes: 30, when: '13:11' },
    { title: '产品设计', minutes: 60, when: '10:11' },
  ]);

  // ── plans (calendar) ──────────────────────────────────────
  const today = ymd(new Date());
  const tomorrow = ymd(addDays(new Date(), 1));
  const yesterday = ymd(addDays(new Date(), -1));
  const [plans, setPlans] = useState([
    { id: 'p1', date: today, title: '把 PRD 改完', minutes: 45, done: false },
    { id: 'p2', date: today, title: '回 Slack 上没回的消息', minutes: 15, done: true },
    { id: 'p3', date: today, title: '画两张设计稿', minutes: 60, done: false },
    { id: 'p4', date: tomorrow, title: '准备周会', minutes: 30, done: false },
    { id: 'p5', date: tomorrow, title: '看那篇收藏了一年的论文', minutes: 45, done: false },
    { id: 'p6', date: yesterday, title: '晨跑', minutes: 25, done: true },
  ]);
  const [selectedDate, setSelectedDate] = useState(today);

  const addPlan = useCallback((date, title, minutes = 25) => {
    if (!title.trim()) return;
    setPlans(p => [...p, { id: 'pl' + Date.now(), date, title: title.trim(), minutes, done: false }]);
  }, []);
  const removePlan = useCallback((id) => setPlans(p => p.filter(x => x.id !== id)), []);
  const togglePlan = useCallback((id) => setPlans(p => p.map(x => x.id === id ? { ...x, done: !x.done } : x)), []);
  const updatePlan = useCallback((id, patch) => setPlans(p => p.map(x => x.id === id ? { ...x, ...patch } : x)), []);

  // timer
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const totalSeconds = duration * 60;
  const tickRef = useRef(null);

  useEffect(() => {
    if (!running || paused) return;
    tickRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { finishSession(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
    // eslint-disable-next-line
  }, [running, paused]);

  const activeTitle = useMemo(() => {
    if (customTitle.trim()) return customTitle.trim();
    const t = tasks.find(t => t.id === selectedTaskId);
    return t ? t.title : '';
  }, [customTitle, tasks, selectedTaskId]);

  const startSession = useCallback(() => {
    if (!activeTitle) return;
    setSecondsLeft(duration * 60);
    setRunning(true);
    setPaused(false);
  }, [activeTitle, duration]);

  const togglePause = useCallback(() => setPaused(p => !p), []);

  const stopSession = useCallback(() => {
    setRunning(false); setPaused(false); setSecondsLeft(0);
  }, []);

  const finishSession = useCallback(() => {
    setRunning(false); setPaused(false);
    const earned = duration; // 1 pt per minute
    setPoints(p => p + earned);
    setSessions(s => s + 1);
    setFocusedMin(m => m + duration);
    setHistory(h => [{ title: activeTitle || '专注', minutes: duration, when: nowHHmm() }, ...h].slice(0, 12));
    setCustomTitle('');
  }, [duration, activeTitle]);

  const addTask = useCallback((title, minutes = 25) => {
    if (!title.trim()) return;
    setTasks(t => [...t, { id: 'tk' + Date.now(), title: title.trim(), minutes, done: false }]);
  }, []);

  const removeTask = useCallback((id) => {
    setTasks(t => t.filter(x => x.id !== id));
    if (selectedTaskId === id) setSelectedTaskId(null);
  }, [selectedTaskId]);

  const buyItem = useCallback((id) => {
    setShop(s => s.map(it => {
      if (it.id !== id) return it;
      if (it.owned) return it;
      if (points < it.price) return it;
      return { ...it, owned: true };
    }));
    const item = shop.find(i => i.id === id);
    if (item && !item.owned && points >= item.price) {
      setPoints(p => p - item.price);
    }
  }, [points, shop]);

  const equipItem = useCallback((id) => {
    setShop(s => s.map(it => ({ ...it, equipped: it.id === id ? !it.equipped : (it.equipped && !sameSlot(it.id, id) ? it.equipped : false) })));
    // simpler: only one item equipped at a time
    setShop(s => {
      const target = s.find(x => x.id === id);
      if (!target || !target.owned) return s;
      const goingOn = !target.equipped;
      return s.map(it => ({ ...it, equipped: it.id === id ? goingOn : false }));
    });
  }, []);

  const equippedItem = shop.find(i => i.equipped);

  return {
    tab, setTab,
    tasks, setTasks, addTask, removeTask,
    selectedTaskId, setSelectedTaskId,
    customTitle, setCustomTitle,
    duration, setDuration,
    points, setPoints,
    shop, buyItem, equipItem, equippedItem,
    sessions, focusedMin,
    history,
    running, paused, secondsLeft, totalSeconds,
    startSession, togglePause, stopSession, finishSession,
    activeTitle,
    plans, addPlan, removePlan, togglePlan, updatePlan,
    selectedDate, setSelectedDate,
    today, tomorrow,
    startPlanFocus: (planId) => {
      const pl = plans.find(p => p.id === planId);
      if (!pl) return;
      setCustomTitle(pl.title);
      setSelectedTaskId(null);
      setDuration(pl.minutes);
      setSecondsLeft(pl.minutes * 60);
      setRunning(true);
      setPaused(false);
      setTab('focus');
    },
  };
}

function sameSlot() { return true; }

function nowHHmm() {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function ymd(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate()+n); return r;
}
function parseYmd(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
window.ymd = ymd;
window.addDays = addDays;
window.parseYmd = parseYmd;

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
}

// ── icons (inline SVG, no dependencies) ───────────────────────
const Icon = ({ name, size = 20, stroke = 'currentColor', fill = 'none', sw = 1.6 }) => {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill, stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch(name) {
    case 'play':   return <svg {...props}><polygon points="6 4 20 12 6 20 6 4" fill={stroke} stroke="none"/></svg>;
    case 'pause':  return <svg {...props}><rect x="6" y="4" width="4" height="16" fill={stroke} stroke="none"/><rect x="14" y="4" width="4" height="16" fill={stroke} stroke="none"/></svg>;
    case 'stop':   return <svg {...props}><rect x="6" y="6" width="12" height="12" fill={stroke} stroke="none" rx="2"/></svg>;
    case 'plus':   return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'close':  return <svg {...props}><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>;
    case 'check':  return <svg {...props}><polyline points="4 12 10 18 20 6"/></svg>;
    case 'star':   return <svg {...props}><polygon points="12 2 15 9 22 9.5 17 14 18.5 21 12 17.5 5.5 21 7 14 2 9.5 9 9 12 2" fill={stroke} stroke="none"/></svg>;
    case 'flame':  return <svg {...props}><path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3-1-3 0-6 0-8z"/></svg>;
    case 'task':   return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="10" x2="17" y2="10"/><line x1="7" y1="14" x2="13" y2="14"/></svg>;
    case 'shop':   return <svg {...props}><path d="M3 7l1-3h16l1 3"/><rect x="4" y="7" width="16" height="13" rx="1"/><path d="M9 11a3 3 0 006 0"/></svg>;
    case 'chart':  return <svg {...props}><line x1="4" y1="20" x2="4" y2="10"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="14"/><line x1="22" y1="20" x2="2" y2="20"/></svg>;
    case 'user':   return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case 'bow':    return <svg {...props}><path d="M4 12c4-4 4 4 8 0s4 4 8 0c-4 4-4-4-8 0s-4-4-8 0z" fill={stroke} stroke="none"/><circle cx="12" cy="12" r="1.6" fill="#fff" stroke="none"/></svg>;
    case 'hat':    return <svg {...props}><rect x="7" y="4" width="10" height="11" rx="1" fill={stroke} stroke="none"/><rect x="3" y="14" width="18" height="3" rx="1" fill={stroke} stroke="none"/></svg>;
    case 'glass':  return <svg {...props}><circle cx="7" cy="13" r="4" fill={stroke} stroke="none"/><circle cx="17" cy="13" r="4" fill={stroke} stroke="none"/><line x1="11" y1="13" x2="13" y2="13"/></svg>;
    case 'crown':  return <svg {...props}><path d="M3 18l2-10 4 4 3-7 3 7 4-4 2 10z" fill={stroke} stroke="none"/><circle cx="5" cy="8" r="1.2" fill="#fff" stroke="none"/><circle cx="19" cy="8" r="1.2" fill="#fff" stroke="none"/><circle cx="12" cy="5" r="1.2" fill="#fff" stroke="none"/></svg>;
    case 'stars':  return <svg {...props}><path d="M5 5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill={stroke} stroke="none"/><path d="M16 11l1.2 3 3 .8-3 .8L16 19l-1-3.4-3-.8 3-.8z" fill={stroke} stroke="none"/></svg>;
    case 'scarf':  return <svg {...props}><path d="M7 8c2 1 8 1 10 0v4c-2 1-8 1-10 0z" fill={stroke} stroke="none"/><path d="M9 12l-1 8h2l1-7M14 12l1 8h-2l-1-7" fill={stroke} stroke="none"/></svg>;
    case 'arrow-right': return <svg {...props}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg>;
    case 'logout': return <svg {...props}><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"/><polyline points="14 8 20 12 14 16"/><line x1="20" y1="12" x2="9" y2="12"/></svg>;
    case 'sync':   return <svg {...props}><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><polyline points="3 21 3 16 8 16"/></svg>;
    case 'leaf':   return <svg {...props}><path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" fill={stroke} stroke="none" opacity=".4"/><path d="M5 19c0-8 6-14 14-14"/><path d="M5 19c4-4 8-6 12-7"/></svg>;
    default: return null;
  }
};

// ── the big black cat (vector) ────────────────────────────────
// expression: 'idle' | 'happy' | 'focus' | 'sleep' | 'celebrate'
function Cat({ size = 200, expression = 'idle', accessory = null, accent = '#7c3aed' }) {
  const eyeY = expression === 'sleep' ? 0 : 0;
  const isSleep  = expression === 'sleep';
  const isHappy  = expression === 'happy' || expression === 'celebrate';
  const isFocus  = expression === 'focus';

  const pupilScale = isSleep ? 0 : 1;
  const blink = isSleep || isFocus;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
      {/* tail */}
      <path d="M 50 150 Q 20 130 30 100 Q 40 80 60 90"
            fill="none" stroke="#1a1a1a" strokeWidth="22" strokeLinecap="round">
        {expression !== 'sleep' && (
          <animate attributeName="d"
                   values="M 50 150 Q 20 130 30 100 Q 40 80 60 90;
                           M 50 150 Q 25 125 35 95  Q 45 75 65 88;
                           M 50 150 Q 20 130 30 100 Q 40 80 60 90"
                   dur="3.6s" repeatCount="indefinite"/>
        )}
      </path>

      {/* body */}
      <ellipse cx="100" cy="135" rx="55" ry="45" fill="#1a1a1a"/>
      {/* feet */}
      <ellipse cx="78"  cy="172" rx="14" ry="8" fill="#1a1a1a"/>
      <ellipse cx="122" cy="172" rx="14" ry="8" fill="#1a1a1a"/>

      {/* head */}
      <g>
        <path d="M 60 80 L 68 50 L 86 72 Z" fill="#1a1a1a"/>
        <path d="M 140 80 L 132 50 L 114 72 Z" fill="#1a1a1a"/>
        <path d="M 65 53 L 73 60 L 80 56 Z" fill="#ff8da8" opacity=".6"/>
        <path d="M 135 53 L 127 60 L 120 56 Z" fill="#ff8da8" opacity=".6"/>
        <ellipse cx="100" cy="90" rx="50" ry="44" fill="#1a1a1a"/>
      </g>

      {/* eyes */}
      <g transform={`translate(0 ${eyeY})`}>
        {blink ? (
          <>
            <path d="M 78 88 Q 84 84 90 88" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
            <path d="M 110 88 Q 116 84 122 88" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round"/>
          </>
        ) : (
          <>
            <ellipse cx="84" cy="90" rx="6" ry={isHappy ? 5 : 8} fill={accent}/>
            <ellipse cx="116" cy="90" rx="6" ry={isHappy ? 5 : 8} fill={accent}/>
            <ellipse cx="84" cy="88" rx="2" ry="3" fill="#fff" transform={`scale(${pupilScale} ${pupilScale})`} style={{ transformOrigin: '84px 88px' }}/>
            <ellipse cx="116" cy="88" rx="2" ry="3" fill="#fff" transform={`scale(${pupilScale} ${pupilScale})`} style={{ transformOrigin: '116px 88px' }}/>
          </>
        )}
      </g>

      {/* nose + mouth */}
      <path d="M 96 104 L 100 107 L 104 104 Z" fill="#ff8da8"/>
      {isHappy ? (
        <path d="M 92 110 Q 100 118 108 110" fill="none" stroke="#ff8da8" strokeWidth="2.2" strokeLinecap="round"/>
      ) : (
        <path d="M 100 107 Q 96 112 92 110 M 100 107 Q 104 112 108 110" fill="none" stroke="#5a3a4a" strokeWidth="1.6" strokeLinecap="round"/>
      )}

      {/* whiskers */}
      <g stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".55">
        <line x1="60" y1="105" x2="78" y2="106"/>
        <line x1="60" y1="112" x2="78" y2="110"/>
        <line x1="140" y1="105" x2="122" y2="106"/>
        <line x1="140" y1="112" x2="122" y2="110"/>
      </g>

      {/* accessory */}
      {accessory === 'bow' && (
        <g transform="translate(100 56)">
          <path d="M -16 0 Q -22 -8 -10 -6 Q -4 0 -10 6 Q -22 8 -16 0 Z" fill="#ff5577"/>
          <path d="M 16 0 Q 22 -8 10 -6 Q 4 0 10 6 Q 22 8 16 0 Z" fill="#ff5577"/>
          <circle cx="0" cy="0" r="3.5" fill="#ff5577"/>
        </g>
      )}
      {accessory === 'hat' && (
        <g transform="translate(100 38)">
          <rect x="-22" y="0" width="44" height="4" rx="1" fill="#3a2a1a"/>
          <rect x="-14" y="-16" width="28" height="18" fill="#3a2a1a"/>
          <rect x="-14" y="-6" width="28" height="3" fill="#c0392b"/>
        </g>
      )}
      {accessory === 'glass' && (
        <g transform="translate(0 0)">
          <circle cx="84" cy="90" r="11" fill="#000" stroke="#333" strokeWidth="1.5"/>
          <circle cx="116" cy="90" r="11" fill="#000" stroke="#333" strokeWidth="1.5"/>
          <line x1="95" y1="90" x2="105" y2="90" stroke="#333" strokeWidth="2"/>
          <ellipse cx="80" cy="86" rx="2" ry="3" fill="#fff" opacity=".5"/>
          <ellipse cx="112" cy="86" rx="2" ry="3" fill="#fff" opacity=".5"/>
        </g>
      )}
      {accessory === 'crown' && (
        <g transform="translate(100 36)">
          <path d="M -22 6 L -18 -10 L -8 -2 L 0 -14 L 8 -2 L 18 -10 L 22 6 Z" fill="#fbbf24" stroke="#92740a" strokeWidth="1.5" strokeLinejoin="round"/>
          <circle cx="-18" cy="-10" r="2.2" fill="#ef4444"/>
          <circle cx="0" cy="-14" r="2.2" fill="#3b82f6"/>
          <circle cx="18" cy="-10" r="2.2" fill="#10b981"/>
        </g>
      )}
      {accessory === 'stars' && (
        <g>
          <text x="56" y="40" fontSize="14">✨</text>
          <text x="140" y="46" fontSize="12">✨</text>
          <text x="148" y="100" fontSize="10">⭐</text>
        </g>
      )}
      {accessory === 'scarf' && (
        <g transform="translate(100 130)">
          <path d="M -36 -6 Q 0 4 36 -6 L 36 4 Q 0 14 -36 4 Z" fill="#dc2626"/>
          <path d="M -28 0 L -34 24 L -22 22 L -18 4 Z" fill="#b91c1c"/>
        </g>
      )}

      {/* sleep z */}
      {isSleep && (
        <g fontSize="14" fill={accent} fontWeight="700" fontFamily="serif">
          <text x="150" y="40" opacity=".7">z</text>
          <text x="160" y="28" fontSize="10" opacity=".5">z</text>
        </g>
      )}

      {/* celebrate sparkles */}
      {expression === 'celebrate' && (
        <g fill={accent}>
          <circle cx="40" cy="40" r="3"><animate attributeName="r" values="0;4;0" dur="1.2s" repeatCount="indefinite"/></circle>
          <circle cx="160" cy="50" r="3"><animate attributeName="r" values="0;4;0" dur="1.2s" begin=".4s" repeatCount="indefinite"/></circle>
          <circle cx="170" cy="120" r="3"><animate attributeName="r" values="0;4;0" dur="1.2s" begin=".8s" repeatCount="indefinite"/></circle>
        </g>
      )}
    </svg>
  );
}

window.useCatApp = useCatApp;
window.fmtTime = fmtTime;
window.Icon = Icon;
window.Cat = Cat;
window.PRESETS = PRESETS;
