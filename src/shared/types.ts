export type FocusStatus = "focused" | "distracted" | "uncertain";

export type TodayTask = {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
};

export type FocusSession = {
  localId: string;
  name: string;
  plannedMinutes: number;
  actualSeconds: number;
  startTime: number;
  endTime?: number;
  distractCount: number;
};

export type ActiveSession = {
  localId: string;
  name: string;
  duration: number;
  startTime: number;
  distractCount: number;
};

export type TimelineEntry = {
  time: number;
  status: FocusStatus;
  activity: string;
  reason?: string;
};

export type VisionResult = {
  status: FocusStatus;
  confidence: number;
  activity: string;
  reason: string;
  checkId?: string;
};

export type DailyStats = {
  totalMinutes: number;
  sessionCount: number;
  completedTasks: number;
  reminderCount: number;
  message: string;
};

export type WeekDayStats = {
  date: string;
  label: string;
  minutes: number;
  isToday: boolean;
};
