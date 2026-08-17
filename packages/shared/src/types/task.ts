export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskSummary {
  id: string;
  projectId: string;
  sessionId: string | null;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItemSummary {
  id: string;
  taskId: string;
  description: string;
  status: TaskStatus;
  order: number;
}

export interface TaskWithItems extends TaskSummary {
  items: TaskItemSummary[];
}
