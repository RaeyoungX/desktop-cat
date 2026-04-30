import { Clock3, LogOut, Star, Zap } from "lucide-react";
import { sessionMinutes } from "../../../shared/stats";
import type { FocusSession } from "../../../shared/types";

type ProfilePanelProps = {
  points: number;
  sessions: FocusSession[];
};

export function ProfilePanel({ points, sessions }: ProfilePanelProps) {
  return (
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
  );
}
