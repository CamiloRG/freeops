export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: string | null;
}

export interface KanbanColumn {
  id: string;
  name: string;
  position: number;
  wipLimit: number | null;
  isDefault?: boolean;
  tasks: KanbanTask[];
}

export interface KanbanBoardData {
  id: string;
  columns: KanbanColumn[];
}
