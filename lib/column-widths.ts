export type TaskColumn = { id: string; label: string; width: number; min: number; max: number };
export const COLUMN_WIDTH_MIN = 64;
export const COLUMN_WIDTH_MAX = 1600;

const builtins: Record<string, TaskColumn> = {
  name: { id: 'name', label: 'Name', width: 600, min: 240, max: 1600 },
  status: { id: 'status', label: 'Status', width: 160, min: 100, max: 600 },
  assignee: { id: 'assignee', label: 'Assignee', width: 130, min: 80, max: 600 },
  priority: { id: 'priority', label: 'Priority', width: 110, min: 80, max: 400 },
  dueDate: { id: 'dueDate', label: 'Due date', width: 130, min: 100, max: 400 },
  startDate: { id: 'startDate', label: 'Start date', width: 130, min: 100, max: 400 },
};
const fieldWidths: Record<string, number> = {
  TEXT: 240, TEXTAREA: 320, NUMBER: 130, MONEY: 150, DROPDOWN: 180,
  LABELS: 220, DATE: 130, CHECKBOX: 80, URL: 260, EMAIL: 240,
  PHONE: 170, RATING: 150, PROGRESS: 160, FORMULA: 160,
};

export function taskColumns(view: 'LIST' | 'TABLE', fields: { id: string; name: string; type: string }[]): TaskColumn[] {
  const ids = view === 'LIST' ? ['name', 'assignee', 'dueDate', 'priority'] : ['name', 'status', 'assignee', 'priority', 'dueDate', 'startDate'];
  return [...ids.map(id => builtins[id]), ...fields.map(field => ({
    id: `field:${field.id}`, label: field.name, width: fieldWidths[field.type] ?? 180,
    min: field.type === 'CHECKBOX' ? 64 : 100, max: 1600,
  }))];
}

export function columnWidth(column: TaskColumn, value?: number): number {
  return Number.isFinite(value) ? Math.min(column.max, Math.max(column.min, Math.round(value!))) : column.width;
}

export function columnLayout(columns: TaskColumn[], widths: Record<string, number> = {}) {
  const values = columns.map(column => columnWidth(column, widths[column.id]));
  // Explicit tracks never use a task title's intrinsic/min-content width.
  return { template: [...values, 44].map(width => `${width}px`).join(' '), width: values.reduce((sum, width) => sum + width, 44) };
}
