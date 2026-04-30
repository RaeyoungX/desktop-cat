import { ActiveSessionView } from "./components/ActiveSessionView";
import { DashboardHeader } from "./components/DashboardHeader";
import { DashboardHero } from "./components/DashboardHero";
import { DashboardTabs } from "./components/DashboardTabs";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { ProfilePanel } from "./components/ProfilePanel";
import { ShopPanel } from "./components/ShopPanel";
import { SubscriptionPanel } from "./components/SubscriptionPanel";
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
              cloudUser={dashboard.cloudUser}
              equipped={dashboard.equipped}
              ownedItems={dashboard.ownedItems}
              points={dashboard.points}
              shopItems={dashboard.shopItems}
              onBuyItem={(id) => void dashboard.buyItem(id)}
              onToggleEquip={(id) => void dashboard.toggleEquip(id)}
            />
          ) : null}

          {dashboard.activeTab === "subscription" ? (
            <SubscriptionPanel
              billingCycle={dashboard.billingCycle}
              cloudBusy={dashboard.cloudBusy}
              cloudStatus={dashboard.cloudStatus}
              paymentMethod={dashboard.paymentMethod}
              paymentOrder={dashboard.paymentOrder}
              plans={dashboard.plans}
              subscription={dashboard.subscription}
              onBillingChange={dashboard.setBillingCycle}
              onClosePayment={dashboard.closePayment}
              onCreatePayment={(planId) => void dashboard.createPayment(planId)}
              onPaymentMethodChange={dashboard.setPaymentMethod}
            />
          ) : null}

          {dashboard.activeTab === "leaderboard" ? (
            <LeaderboardPanel
              cloudUser={dashboard.cloudUser}
              leaderboard={dashboard.leaderboard}
              myRank={dashboard.myRank}
            />
          ) : null}

          {dashboard.activeTab === "profile" ? (
            <ProfilePanel
              authEmail={dashboard.authEmail}
              authPassword={dashboard.authPassword}
              cloudBusy={dashboard.cloudBusy}
              cloudStatus={dashboard.cloudStatus}
              cloudUser={dashboard.cloudUser}
              points={dashboard.points}
              quota={dashboard.quota}
              sessions={dashboard.sessions}
              onEmailChange={dashboard.setAuthEmail}
              onPasswordChange={dashboard.setAuthPassword}
              onRefreshCloud={() => void dashboard.refreshCloud()}
              onSignIn={(mode) => void dashboard.signIn(mode)}
              onSignOut={() => void dashboard.signOut()}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
