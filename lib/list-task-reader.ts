import type { Task, Status, CustomFieldValue, TaskDependency } from "@/lib/generated/prisma/client";
import type { TaskWithRelations } from "./queries";

type DateKey = "startDate" | "dueDate" | "createdAt" | "updatedAt" | "completedAt";
type RawTask = Omit<Task, DateKey | "archived"> & Record<DateKey, string | number | null> & { archived: number };
type Assignee = { taskId: string; userId: string; name: string; email: string; color: string; avatarUrl: string | null };
type Tag = { taskId: string; tagId: string; spaceId: string; name: string; color: string };
type Count = { taskId: string; total: number };

function dates(row: RawTask): Task {
  const date = (value: string | number | null) => value === null ? null : new Date(
    typeof value === "string" && /^\d{4}-\d\d-\d\d \d\d:/.test(value) ? value.replace(" ", "T") + "Z" : value
  );
  return { ...row, archived: !!row.archived, startDate: date(row.startDate), dueDate: date(row.dueDate),
    completedAt: date(row.completedAt), createdAt: date(row.createdAt)!, updatedAt: date(row.updatedAt)! };
}

function group<T extends { taskId: string }>(rows: T[]) {
  const result = new Map<string, T[]>();
  for (const row of rows) { const list = result.get(row.taskId) ?? []; list.push(row); result.set(row.taskId, list); }
  return result;
}

/** One bounded-parameter D1 batch, independent of list size. Authorization stays in queries.ts. */
async function readTaskSet(db: D1Database, listId: string, taskId?: string) {
  const scope = taskId ? "(t.id=? OR t.parentId=?)" : "t.listId=?";
  const active = taskId ? "(t.archived=0 OR t.id=?)" : "t.archived=0";
  const params = taskId ? [taskId,taskId,taskId] : [listId];
  const statements = [
    db.prepare(`SELECT t.* FROM Task t WHERE ${scope} AND ${active} ORDER BY t.position,t.id`).bind(...params),
    db.prepare(`SELECT DISTINCT s.* FROM Status s JOIN Task t ON t.statusId=s.id WHERE ${scope} AND ${active}`).bind(...params),
    db.prepare(`SELECT a.taskId,a.userId,u.name,u.email,u.color,u.avatarUrl FROM TaskAssignee a JOIN Task t ON t.id=a.taskId JOIN User u ON u.id=a.userId WHERE ${scope} AND ${active}`).bind(...params),
    db.prepare(`SELECT a.taskId,a.tagId,g.spaceId,g.name,g.color FROM TaskTag a JOIN Task t ON t.id=a.taskId JOIN Tag g ON g.id=a.tagId WHERE ${scope} AND ${active}`).bind(...params),
    db.prepare(`SELECT v.* FROM CustomFieldValue v JOIN Task t ON t.id=v.taskId WHERE ${scope} AND ${active}`).bind(...params),
    db.prepare(`SELECT c.taskId,count(*) total FROM Comment c JOIN Task t ON t.id=c.taskId WHERE ${scope} AND ${active} GROUP BY c.taskId`).bind(...params),
    db.prepare(`SELECT c.taskId,count(*) total FROM Checklist c JOIN Task t ON t.id=c.taskId WHERE ${scope} AND ${active} GROUP BY c.taskId`).bind(...params),
    taskId ? db.prepare("SELECT id,blockerId,blockedId FROM TaskDependency WHERE 0") : db.prepare("SELECT d.id,d.blockerId,d.blockedId FROM TaskDependency d JOIN Task a ON a.id=d.blockerId JOIN Task b ON b.id=d.blockedId WHERE a.listId=? AND b.listId=? AND a.parentId IS NULL AND b.parentId IS NULL AND a.archived=0 AND b.archived=0").bind(listId,listId),
  ];
  const [taskRows,statusRows,assigneeRows,tagRows,valueRows,commentRows,checklistRows,dependencyRows] = await db.batch(statements);
  const tasks = (taskRows.results as RawTask[]).map(dates);
  const statuses = new Map((statusRows.results as Status[]).map(s => [s.id,s]));
  const assignees = group((assigneeRows.results as Assignee[]).map(a => ({ taskId:a.taskId,userId:a.userId,
    user:{ id:a.userId,name:a.name,email:a.email,color:a.color,avatarUrl:a.avatarUrl } })));
  const tags = group((tagRows.results as Tag[]).map(t => ({ taskId:t.taskId,tagId:t.tagId,
    tag:{ id:t.tagId,spaceId:t.spaceId,name:t.name,color:t.color } })));
  const values = group((valueRows.results as (Omit<CustomFieldValue,"value"> & {value:string})[]).map(v => ({...v,value:JSON.parse(v.value) as CustomFieldValue["value"]})));
  const comments = new Map((commentRows.results as Count[]).map(c => [c.taskId,c.total]));
  const checklists = new Map((checklistRows.results as Count[]).map(c => [c.taskId,c.total]));
  const base = tasks.map(t => ({ ...t, status:statuses.get(t.statusId)!, assignees:assignees.get(t.id) ?? [] }));
  const children = new Map<string, typeof base>();
  for (const t of base) if (t.parentId) { const rows=children.get(t.parentId) ?? [];rows.push(t);children.set(t.parentId,rows); }
  const complete: TaskWithRelations[] = base.map(t => ({ ...t, tags:tags.get(t.id) ?? [],
    customFieldValues:values.get(t.id) ?? [], subtasks:children.get(t.id) ?? [],
    _count:{comments:comments.get(t.id) ?? 0,checklists:checklists.get(t.id) ?? 0,subtasks:children.get(t.id)?.length ?? 0} }));
  return { tasks:complete, dependencies:dependencyRows.results as Pick<TaskDependency,"id"|"blockerId"|"blockedId">[] };
}

export function readListTasks(db:D1Database,listId:string) { return readTaskSet(db,listId); }
export async function readTaskRelations(db:D1Database,taskId:string) {
  const result=await readTaskSet(db,"",taskId);
  const task=result.tasks.find(t=>t.id===taskId);
  if (!task) throw new Error("Task not found");
  return task;
}
