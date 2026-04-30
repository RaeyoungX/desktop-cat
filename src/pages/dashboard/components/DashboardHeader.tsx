import { X } from "lucide-react";
import { IconButton } from "../../../components/IconButton";
import type { ActiveSession } from "../../../shared/types";

type DashboardHeaderProps = {
  activeSession: ActiveSession | null;
};

export function DashboardHeader({ activeSession }: DashboardHeaderProps) {
  return (
    <header className="titlebar">
      <div className="brand">
        <div>
          <strong>Desktop Cat</strong>
          <span>{activeSession ? "专注中" : "今天要做什么？"}</span>
        </div>
      </div>
      <IconButton onClick={() => window.desktopCat.app.closeDashboard()} aria-label="关闭">
        <X size={17} />
      </IconButton>
    </header>
  );
}
