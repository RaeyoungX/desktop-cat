import { Check, Play, Plus, Trash2 } from "lucide-react";
import type { TodayTask } from "../../../shared/types";
import { DURATIONS } from "../constants";

type TasksPanelProps = {
  customDuration: string;
  duration: number;
  focusName: string;
  newTaskText: string;
  selectedTask: TodayTask | null;
  selectedTaskId: string | null;
  tasks: TodayTask[];
  onAddTask: () => void;
  onDurationChange: (duration: number) => void;
  onCustomDurationChange: (value: string) => void;
  onFocusNameChange: (value: string) => void;
  onPickTask: (task: TodayTask) => void;
  onRemoveTask: (task: TodayTask) => void;
  onSelectedTaskIdChange: (id: string | null) => void;
  onStartFocus: () => void;
  onTaskTextChange: (value: string) => void;
  onToggleTask: (task: TodayTask) => void;
};

export function TasksPanel({
  customDuration,
  duration,
  focusName,
  newTaskText,
  selectedTask,
  selectedTaskId,
  tasks,
  onAddTask,
  onDurationChange,
  onCustomDurationChange,
  onFocusNameChange,
  onPickTask,
  onRemoveTask,
  onSelectedTaskIdChange,
  onStartFocus,
  onTaskTextChange,
  onToggleTask,
}: TasksPanelProps) {
  return (
    <main className="panel-stack">
      <section className="panel">
        <div className="section-head">
          <span>今日任务</span>
          <span>{tasks.filter((task) => task.done).length}/{tasks.length}</span>
        </div>
        <div className="add-row">
          <input
            value={newTaskText}
            onChange={(event) => onTaskTextChange(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") onAddTask(); }}
            placeholder="添加一条今日 Todo..."
            maxLength={50}
          />
          <button onClick={onAddTask} aria-label="添加任务"><Plus size={16} /></button>
        </div>
        <div className="task-list">
          {tasks.length === 0 ? <div className="empty">还没有任务，先写一件小事。</div> : null}
          {tasks.map((task) => (
            <div key={task.id} className={`task-row ${task.done ? "done" : ""} ${selectedTaskId === task.id ? "selected" : ""}`} onClick={() => onPickTask(task)}>
              <button onClick={(event) => { event.stopPropagation(); onToggleTask(task); }} aria-label="完成任务">
                {task.done ? <Check size={13} /> : null}
              </button>
              <span>{task.text}</span>
              <button className="danger-button" onClick={(event) => { event.stopPropagation(); onRemoveTask(task); }} aria-label="删除任务">
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
          onChange={(event) => {
            onFocusNameChange(event.target.value);
            onSelectedTaskIdChange(null);
          }}
          placeholder="选择或输入任务..."
          maxLength={60}
        />
        <div className="duration-grid">
          {DURATIONS.map((minutes) => (
            <button key={minutes} className={duration === minutes ? "selected" : ""} onClick={() => onDurationChange(minutes)}>
              {minutes === 60 ? "1 小时" : `${minutes} 分钟`}
            </button>
          ))}
          <input
            value={customDuration}
            onChange={(event) => {
              onCustomDurationChange(event.target.value);
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value > 0) onDurationChange(Math.min(480, Math.round(value)));
            }}
            placeholder="自定义"
            type="number"
            min={1}
            max={480}
          />
        </div>
        <button className="primary-button" disabled={!focusName.trim()} onClick={onStartFocus}>
          <Play size={17} /> 开始专注{selectedTask ? `：${selectedTask.text}` : ""}
        </button>
      </section>
    </main>
  );
}
