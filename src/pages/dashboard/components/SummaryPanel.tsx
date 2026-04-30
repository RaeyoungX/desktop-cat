import { CheckCircle2, Zap, ZapOff } from "lucide-react";
import type { DailyStats, TimelineEntry, WeekDayStats } from "../../../shared/types";

type SummaryPanelProps = {
  dailyStats: DailyStats;
  timeline: TimelineEntry[];
  weekStats: WeekDayStats[];
};

export function SummaryPanel({ dailyStats, timeline, weekStats }: SummaryPanelProps) {
  const maxWeekMinutes = Math.max(1, ...weekStats.map((item) => item.minutes));

  return (
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
          {weekStats.map((day) => (
            <div key={day.date}>
              <span>{day.minutes}</span>
              <div className="bar-wrap">
                <div className={day.isToday ? "today" : ""} style={{ height: `${Math.max(day.minutes ? 8 : 0, (day.minutes / maxWeekMinutes) * 100)}%` }} />
              </div>
              <small>{day.label}</small>
            </div>
          ))}
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
  );
}
