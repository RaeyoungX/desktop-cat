import { useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  Check,
  CheckCircle2,
  Clock3,
  ListTodo,
  LogOut,
  PawPrint,
  Play,
  Plus,
  SquareCheck,
  Star,
  Trash2,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { buildDailyStats, buildWeekStats, sessionMinutes } from "../../shared/stats";
import { createTask } from "../../shared/tasks";
import type { ActiveSession, FocusSession, TimelineEntry, TodayTask } from "../../shared/types";

const DURATIONS = [25, 45, 60, 90];
const SHOP_ITEMS = [
  { id: "bow", name: "蝴蝶结", cost: 25 },
  { id: "hat", name: "礼帽", cost: 50 },
  { id: "glasses", name: "墨镜", cost: 60 },
  { id: "crown", name: "王冠", cost: 80 },
  { id: "stars", name: "星星气", cost: 40 },
];

function formatTimer(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function getPoints(sessions: FocusSession[]): number {
  return sessions.reduce((sum, session) => sum + sessionMinutes(session), 0);
}

export function Dashboard() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState("");
  const [focusName, setFocusName] = useState("");
  const [duration, setDuration] = useState(25);
  const [customDuration, setCustomDuration] = useState("");
  const [activeTab, setActiveTab] = useState<"tasks" | "summary" | "shop" | "profile">("tasks");
  const [now, setNow] = useState(Date.now());
  const [detectorStatus, setDetectorStatus] = useState("");
  const [equipped, setEquipped] = useState<string[]>([]);

  useEffect(() => {
    void Promise.all([
      window.desktopCat.tasks.list(),
      window.desktopCat.sessions.list(),
      window.desktopCat.sessions.timeline(),
      window.desktopCat.sessions.get(),
      window.desktopCat.cat.getEquipped(),
    ]).then(([loadedTasks, loadedSessions, loadedTimeline, session, loadedEquipped]) => {
      setTasks(loadedTasks);
      setSessions(loadedSessions);
      setTimeline(loadedTimeline);
      setActiveSession(session);
      setEquipped(loadedEquipped);
      if (!session) {
        const first = loadedTasks.find((task) => !task.done);
        if (first) {
          setSelectedTaskId(first.id);
          setFocusName(first.text);
        }
      }
    });

    const cleanups = [
      window.desktopCat.events.onTimeline((entry) => setTimeline((items) => [...items, entry])),
      window.desktopCat.events.onSessionChanged((session) => {
        setActiveSession(session);
        if (!session) void window.desktopCat.sessions.list().then(setSessions);
      }),
      window.desktopCat.events.onDistractDetected(() => {
        void window.desktopCat.sessions.get().then(setActiveSession);
      }),
      window.desktopCat.events.onDetectorStatus(setDetectorStatus),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null;
  const dailyStats = useMemo(() => buildDailyStats(tasks, sessions), [tasks, sessions]);
  const weekStats = useMemo(() => buildWeekStats(sessions), [sessions]);
  const points = getPoints(sessions);
  const elapsedSeconds = activeSession ? Math.floor((now - activeSession.startTime) / 1000) : 0;
  const totalSeconds = activeSession ? activeSession.duration * 60 : duration * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progress = activeSession ? Math.min(100, (elapsedSeconds / totalSeconds) * 100) : 0;

  useEffect(() => {
    if (activeSession && remainingSeconds <= 0) {
      void finishSession();
    }
  }, [activeSession, remainingSeconds]);

  async function persistTasks(next: TodayTask[]) {
    setTasks(next);
    await window.desktopCat.tasks.save(next);
  }

  async function addTask() {
    const text = newTaskText.trim();
    if (!text) return;
    const task = createTask(text);
    const next = [...tasks, task];
    setNewTaskText("");
    setSelectedTaskId(task.id);
    setFocusName(task.text);
    await persistTasks(next);
  }

  async function toggleTask(task: TodayTask) {
    const next = tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item);
    if (!task.done && selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  async function removeTask(task: TodayTask) {
    const next = tasks.filter((item) => item.id !== task.id);
    if (selectedTaskId === task.id) {
      setSelectedTaskId(null);
      setFocusName("");
    }
    await persistTasks(next);
  }

  function pickTask(task: TodayTask) {
    if (task.done) return;
    setSelectedTaskId(task.id);
    setFocusName(task.text);
  }

  async function startFocus() {
    const name = focusName.trim();
    if (!name || activeSession) return;
    const nextSession = await window.desktopCat.sessions.start({ name, duration });
    setActiveSession(nextSession);
    setDetectorStatus("");
  }

  async function finishSession() {
    const ended = await window.desktopCat.sessions.end({ completedTaskId: selectedTaskId });
    if (!ended) return;
    const nextSessions = await window.desktopCat.sessions.list();
    setSessions(nextSessions);
    if (selectedTaskId) {
      const nextTasks = tasks.map((task) => task.id === selectedTaskId ? { ...task, done: true } : task);
      await persistTasks(nextTasks);
    }
    setActiveSession(null);
    setSelectedTaskId(null);
    setFocusName("");
    setActiveTab("summary");
  }

  async function toggleEquip(id: string) {
    const next = equipped.includes(id) ? equipped.filter((item) => item !== id) : [...equipped, id];
    setEquipped(await window.desktopCat.cat.equipItems(next));
  }

  return (
    <div className="dashboard-shell">
      <header className="titlebar">
        <div className="brand">
          <span className="brand-mark">猫</span>
          <div>
            <strong>Desktop Cat</strong>
            <span>{activeSession ? "专注中" : "今天要做什么？"}</span>
          </div>
        </div>
        <button className="icon-button" onClick={() => window.desktopCat.app.closeDashboard()} aria-label="关闭">
          <X size={17} />
        </button>
      </header>

      {activeSession ? (
        <section className="active-panel">
          <div className="active-badge"><span /> 专注中</div>
          <img className="active-cat" src="/assets/cat-sitsit.png" alt="" />
          <h1>{activeSession.name}</h1>
          <p><Clock3 size={14} /> 计划 {activeSession.duration} 分钟</p>
          <div className="timer">{formatTimer(remainingSeconds)}</div>
          <div className="progress-track"><div style={{ width: `${progress}%` }} /></div>
          <div className={`focus-health ${activeSession.distractCount > 2 ? "danger" : activeSession.distractCount > 0 ? "warn" : ""}`}>
            {activeSession.distractCount > 0 ? `已提醒 ${activeSession.distractCount} 次` : "猫咪正在安静巡逻"}
          </div>
          {detectorStatus ? <div className="detector-status">{detectorStatus}</div> : null}
          <button className="primary-button" onClick={() => void finishSession()}>
            <SquareCheck size={17} /> 结束专注
          </button>
        </section>
      ) : (
        <>
          <section className="hero">
            <div>
              <div className="small-label"><PawPrint size={13} /> 专注模式</div>
              <h1>今天让猫咪盯着哪件事？</h1>
              <p>写下目标，开始计时。截图只用于当次 AI 判断，不落盘。</p>
            </div>
            <img src="/assets/cat-sitsit.png" alt="Desktop Cat" />
          </section>

          <nav className="tabs">
            {[
              ["tasks", "任务", ListTodo],
              ["summary", "总结", BarChart2],
              ["shop", "装扮", Star],
              ["profile", "我的", PawPrint],
            ].map(([key, label, Icon]) => (
              <button
                key={key as string}
                className={activeTab === key ? "active" : ""}
                onClick={() => setActiveTab(key as typeof activeTab)}
              >
                <Icon size={14} /> {label as string}
              </button>
            ))}
          </nav>

          {activeTab === "tasks" ? (
            <main className="panel-stack">
              <section className="panel">
                <div className="section-head">
                  <span>今日任务</span>
                  <span>{tasks.filter((task) => task.done).length}/{tasks.length}</span>
                </div>
                <div className="add-row">
                  <input
                    value={newTaskText}
                    onChange={(event) => setNewTaskText(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Enter") void addTask(); }}
                    placeholder="添加一条今日 Todo..."
                    maxLength={50}
                  />
                  <button onClick={() => void addTask()} aria-label="添加任务"><Plus size={16} /></button>
                </div>
                <div className="task-list">
                  {tasks.length === 0 ? <div className="empty">还没有任务，先写一件小事。</div> : null}
                  {tasks.map((task) => (
                    <div key={task.id} className={`task-row ${task.done ? "done" : ""} ${selectedTaskId === task.id ? "selected" : ""}`} onClick={() => pickTask(task)}>
                      <button onClick={(event) => { event.stopPropagation(); void toggleTask(task); }} aria-label="完成任务">
                        {task.done ? <Check size={13} /> : null}
                      </button>
                      <span>{task.text}</span>
                      <button className="danger-button" onClick={(event) => { event.stopPropagation(); void removeTask(task); }} aria-label="删除任务">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="section-head"><span>专注目标</span></div>
                <input
                  className="focus-input"
                  value={focusName}
                  onChange={(event) => { setFocusName(event.target.value); setSelectedTaskId(null); }}
                  placeholder="选择或输入任务..."
                  maxLength={60}
                />
                <div className="duration-grid">
                  {DURATIONS.map((minutes) => (
                    <button key={minutes} className={duration === minutes ? "selected" : ""} onClick={() => setDuration(minutes)}>
                      {minutes === 60 ? "1 小时" : `${minutes} 分钟`}
                    </button>
                  ))}
                  <input
                    value={customDuration}
                    onChange={(event) => {
                      setCustomDuration(event.target.value);
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value > 0) setDuration(Math.min(480, Math.round(value)));
                    }}
                    placeholder="自定义"
                    type="number"
                    min={1}
                    max={480}
                  />
                </div>
                <button className="primary-button" disabled={!focusName.trim()} onClick={() => void startFocus()}>
                  <Play size={17} /> 开始专注{selectedTask ? `：${selectedTask.text}` : ""}
                </button>
              </section>
            </main>
          ) : null}

          {activeTab === "summary" ? (
            <main className="panel-stack">
              <section className="summary-hero">
                <span>今日专注</span>
                <strong>{dailyStats.totalMinutes}<em>分钟</em></strong>
              </section>
              <section className="stat-grid">
                <div><Zap size={15} /><strong>{dailyStats.sessionCount}</strong><span>专注次数</span></div>
                <div><CheckCircle2 size={15} /><strong>{dailyStats.completedTasks}</strong><span>完成任务</span></div>
                <div><ZapOff size={15} /><strong>{dailyStats.reminderCount}</strong><span>提醒次数</span></div>
              </section>
              <section className="cat-message">
                <img src="/assets/cat-loaf.png" alt="" />
                <p>{dailyStats.message}</p>
              </section>
              <section className="panel">
                <div className="section-head"><span>本周趋势</span></div>
                <div className="week-chart">
                  {weekStats.map((day) => {
                    const max = Math.max(1, ...weekStats.map((item) => item.minutes));
                    return (
                      <div key={day.date}>
                        <span>{day.minutes}</span>
                        <div className="bar-wrap"><div className={day.isToday ? "today" : ""} style={{ height: `${Math.max(day.minutes ? 8 : 0, (day.minutes / max) * 100)}%` }} /></div>
                        <small>{day.label}</small>
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="panel">
                <div className="section-head"><span>检测时间线</span></div>
                <div className="timeline-list">
                  {timeline.length === 0 ? <div className="empty">专注进行中会生成检测记录。</div> : null}
                  {timeline.slice(-20).reverse().map((entry) => (
                    <div key={`${entry.time}-${entry.activity}`} className={`timeline-row ${entry.status}`}>
                      {entry.status === "distracted" ? <ZapOff size={14} /> : <Zap size={14} />}
                      <div><strong>{entry.activity}</strong><span>{new Date(entry.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span></div>
                    </div>
                  ))}
                </div>
              </section>
            </main>
          ) : null}

          {activeTab === "shop" ? (
            <main className="panel-stack">
              <section className="shop-header"><Star size={19} /><strong>{points}</strong><span>积分</span></section>
              <section className="shop-list">
                {SHOP_ITEMS.map((item) => (
                  <div className="shop-item" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.cost} 积分</span>
                    </div>
                    <button onClick={() => void toggleEquip(item.id)}>{equipped.includes(item.id) ? "取下" : "装备"}</button>
                  </div>
                ))}
              </section>
            </main>
          ) : null}

          {activeTab === "profile" ? (
            <main className="panel-stack">
              <section className="profile-card">
                <div className="avatar">猫</div>
                <div>
                  <strong>本地用户</strong>
                  <span>登录和云同步接口已预留</span>
                </div>
                <LogOut size={16} />
              </section>
              <section className="stat-grid">
                <div><Star size={15} /><strong>{points}</strong><span>累计积分</span></div>
                <div><Zap size={15} /><strong>{sessions.length}</strong><span>专注次数</span></div>
                <div><Clock3 size={15} /><strong>{sessions.reduce((sum, item) => sum + sessionMinutes(item), 0)}</strong><span>专注分钟</span></div>
              </section>
            </main>
          ) : null}
        </>
      )}
    </div>
  );
}
