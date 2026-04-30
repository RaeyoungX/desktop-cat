import { ActiveSessionView } from "./components/ActiveSessionView";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardHero } from "./components/DashboardHero";
import { DashboardTabs } from "./components/DashboardTabs";
import { ProfilePanel } from "./components/ProfilePanel";
import { ShopPanel } from "./components/ShopPanel";
import { SummaryPanel } from "./components/SummaryPanel";
import { TasksPanel } from "./components/TasksPanel";
import { useDashboardState } from "./hooks/useDashboardState";

export function DashboardPage() {
  const dashboard = useDashboardState();

  return (
    <div className="dashboard-shell">
      <DashboardHeader activeSession={dashboard.activeSession} />

      {dashboard.activeSession ? (
        <ActiveSessionView
          activeSession={dashboard.activeSession}
          detectorStatus={dashboard.detectorStatus}
          progress={dashboard.progress}
          remainingSeconds={dashboard.remainingSeconds}
          onFinish={() => void dashboard.finishSession()}
        />
      ) : (
        <>
          <DashboardHero />
          <DashboardTabs activeTab={dashboard.activeTab} onChange={dashboard.setActiveTab} />

          {dashboard.activeTab === "tasks" ? (
            <TasksPanel
              customDuration={dashboard.customDuration}
              duration={dashboard.duration}
              focusName={dashboard.focusName}
              newTaskText={dashboard.newTaskText}
              selectedTask={dashboard.selectedTask}
              selectedTaskId={dashboard.selectedTaskId}
              tasks={dashboard.tasks}
              onAddTask={() => void dashboard.addTask()}
              onCustomDurationChange={dashboard.setCustomDuration}
              onDurationChange={dashboard.setDuration}
              onFocusNameChange={dashboard.setFocusName}
              onPickTask={dashboard.pickTask}
              onRemoveTask={(task) => void dashboard.removeTask(task)}
              onSelectedTaskIdChange={dashboard.setSelectedTaskId}
              onStartFocus={() => void dashboard.startFocus()}
              onTaskTextChange={dashboard.setNewTaskText}
              onToggleTask={(task) => void dashboard.toggleTask(task)}
            />
          ) : null}

          {dashboard.activeTab === "summary" ? (
            <SummaryPanel
              dailyStats={dashboard.dailyStats}
              timeline={dashboard.timeline}
              weekStats={dashboard.weekStats}
            />
          ) : null}

          {dashboard.activeTab === "shop" ? (
            <ShopPanel
              equipped={dashboard.equipped}
              points={dashboard.points}
              onToggleEquip={(id) => void dashboard.toggleEquip(id)}
            />
          ) : null}

          {dashboard.activeTab === "profile" ? (
            <ProfilePanel points={dashboard.points} sessions={dashboard.sessions} />
          ) : null}
        </>
      )}
    </div>
  );
}
