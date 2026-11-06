import { matchFieldFilter, type FieldFilter } from "./advanced-filters";
import type { TaskWithRelations } from "@/lib/queries";
import type { Priority } from "@/lib/enums";
import { PRIORITY_CONFIG } from "@/lib/constants";

export type SortField = "priority" | "dueDate" | "name" | "created" | null;
export type GroupBy = "status" | "assignee" | "priority" | "none" | `field:${string}`;

export type ViewState = {
  filters: {
    priorities: Priority[];
    assignees: string[];
    tags: string[];
    statuses?: string[];
    dueFrom?: string;
    dueTo?: string;
    noDueDate?: boolean;
    custom?: FieldFilter[];
  };
  sort: { field: SortField; dir: "asc" | "desc" };
  groupBy: GroupBy;
};

export const EMPTY_VIEW_STATE: ViewState = {
  filters: { priorities: [], assignees: [], tags: [] },
  sort: { field: null, dir: "asc" },
  groupBy: "status",
};

export function countActiveFilters(vs: ViewState): number {
  return (
    vs.filters.priorities.length +
    vs.filters.assignees.length +
    vs.filters.tags.length + (vs.filters.statuses?.length ?? 0) + (vs.filters.custom?.length ?? 0) + Number(!!vs.filters.dueFrom) + Number(!!vs.filters.dueTo) + Number(!!vs.filters.noDueDate)
  );
}

export function applyViewState(
  tasks: TaskWithRelations[],
  vs: ViewState,
): TaskWithRelations[] {
  let out = tasks;
  const { priorities, assignees, tags } = vs.filters;

  if (priorities.length) {
    const set = new Set(priorities);
    out = out.filter((t) => t.priority && set.has(t.priority));
  }
  if (assignees.length) {
    const set = new Set(assignees);
    out = out.filter((t) => t.assignees.some((a) => set.has(a.userId)));
  }
  if (tags.length) {
    const set = new Set(tags);
    out = out.filter((t) => t.tags.some((tg) => set.has(tg.tagId)));
  }

  if(vs.filters.statuses?.length)out=out.filter(t=>vs.filters.statuses!.includes(t.statusId));
  if(vs.filters.noDueDate)out=out.filter(t=>!t.dueDate);
  if(vs.filters.dueFrom)out=out.filter(t=>!!t.dueDate&&new Date(t.dueDate).toISOString().slice(0,10)>=vs.filters.dueFrom!);
  if(vs.filters.dueTo)out=out.filter(t=>!!t.dueDate&&new Date(t.dueDate).toISOString().slice(0,10)<=vs.filters.dueTo!);
  if(vs.filters.custom?.length)out=out.filter(t=>vs.filters.custom!.every(f=>matchFieldFilter(t.customFieldValues.find(v=>v.customFieldId===f.fieldId)?.value,f)));
  if (vs.sort.field) {
    const dir = vs.sort.dir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => cmp(a, b, vs.sort.field!) * dir);
  }
  return out;
}

function cmp(a: TaskWithRelations, b: TaskWithRelations, field: SortField): number {
  switch (field) {
    case "priority": {
      const pa = a.priority ? PRIORITY_CONFIG[a.priority].order : 99;
      const pb = b.priority ? PRIORITY_CONFIG[b.priority].order : 99;
      return pa - pb;
    }
    case "dueDate": {
      const da = a.dueDate ? +new Date(a.dueDate) : Infinity;
      const db = b.dueDate ? +new Date(b.dueDate) : Infinity;
      return da - db;
    }
    case "name":
      return a.name.localeCompare(b.name);
    case "created":
      return +new Date(a.createdAt) - +new Date(b.createdAt);
    default:
      return 0;
  }
}
