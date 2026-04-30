import { useState } from "react";
import { Clock3, LogOut, RefreshCw, Star, UserRound, Zap } from "lucide-react";
import type { CloudUser, QuotaSnapshot } from "../../../shared/cloud";
import { sessionMinutes } from "../../../shared/stats";
import type { FocusSession } from "../../../shared/types";

type ProfilePanelProps = {
  authEmail: string;
  authPassword: string;
  authPasswordConfirm: string;
  cloudBusy: boolean;
  cloudStatus: string;
  cloudUser: CloudUser | null;
  points: number;
  quota: QuotaSnapshot | null;
  sessions: FocusSession[];
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmChange: (value: string) => void;
  onRefreshCloud: () => void;
  onSignIn: (mode: "signin" | "signup") => void;
  onSignOut: () => void;
};

export function ProfilePanel({
  authEmail,
  authPassword,
  authPasswordConfirm,
  cloudBusy,
  cloudStatus,
  cloudUser,
  points,
  quota,
  sessions,
  onEmailChange,
  onPasswordChange,
  onPasswordConfirmChange,
  onRefreshCloud,
  onSignIn,
  onSignOut,
}: ProfilePanelProps) {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const localMinutes = sessions.reduce((sum, item) => sum + sessionMinutes(item), 0);
  const totalSessions = cloudUser?.stats.totalSessions ?? sessions.length;
  const totalMins = cloudUser?.stats.totalMins ?? localMinutes;

  return (
    <main className="panel-stack">
      <section className="profile-card cloud-profile-card">
        <img src="/assets/cat-sitsit.png" alt="" />
        <div>
          <strong>{cloudUser?.email ?? "本地用户"}</strong>
          <span>{cloudUser ? `${cloudUser.stats.levelName} · ${cloudUser.plan.toUpperCase()}` : "登录后启用云同步、订阅和商店库存"}</span>
        </div>
        {cloudUser ? (
          <button className="mini-icon-button" onClick={onSignOut} title="登出"><LogOut size={15} /></button>
        ) : <UserRound size={17} />}
      </section>

      {!cloudUser ? (
        <section className="panel auth-panel">
          <div className="auth-title">
            <strong>{authMode === "signin" ? "登录账号" : "创建账号"}</strong>
            <span>{authMode === "signin" ? "登录后启用 AI 检测和云同步" : "新账号默认包含 5 小时免费 AI 检测额度"}</span>
          </div>
          <input value={authEmail} onChange={(event) => onEmailChange(event.target.value)} placeholder="Email" />
          <input value={authPassword} onChange={(event) => onPasswordChange(event.target.value)} placeholder="Password" type="password" />
          {authMode === "signup" ? (
            <input
              value={authPasswordConfirm}
              onChange={(event) => onPasswordConfirmChange(event.target.value)}
              placeholder="Confirm password"
              type="password"
            />
          ) : null}
          <button className="auth-submit" disabled={cloudBusy} onClick={() => onSignIn(authMode)}>
            {cloudBusy ? "处理中..." : authMode === "signin" ? "登录" : "创建账号"}
          </button>
          <button
            className="auth-switch"
            onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
            type="button"
          >
            {authMode === "signin" ? "还没有账号？去注册" : "已有账号？去登录"}
          </button>
        </section>
      ) : null}

      <section className="cloud-status">
        <span>{cloudStatus}</span>
        <button onClick={onRefreshCloud} title="刷新云端状态"><RefreshCw size={14} /></button>
      </section>

      {quota ? (
        <section className="panel quota-panel">
          <div className="section-head"><span>AI 检测额度</span><strong>{quota.remainingHours}h / {quota.planHours}h</strong></div>
          <div className="progress-track quota-track"><div style={{ width: `${Math.min(100, quota.quotaPct)}%` }} /></div>
          <span>本月已用 {quota.usedHours} 小时，重置时间 {new Date(quota.resetAt).toLocaleDateString()}</span>
        </section>
      ) : null}

      <section className="stat-grid">
        <div><Star size={15} /><strong>{points}</strong><span>累计积分</span></div>
        <div><Zap size={15} /><strong>{totalSessions}</strong><span>专注次数</span></div>
        <div><Clock3 size={15} /><strong>{totalMins}</strong><span>专注分钟</span></div>
      </section>
    </main>
  );
}
