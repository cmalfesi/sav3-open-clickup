import type { QueryClient } from "@tanstack/react-query";
import { apiGet, apiSend } from "./api";
import type { ListData, TaskWithRelations, TaskDetail } from "./queries";
import type { TaskPatch } from "./tasks";

type Edit = { taskId: string; patch: TaskPatch };
type Snapshot = { list: ListData | undefined; detail: TaskDetail | undefined };
const reconcile = new WeakMap<QueryClient, Set<string>>();
function pending(qc: QueryClient, taskId: string) {
  return qc.getMutationCache().findAll({status:"pending"}).filter(m =>
    m.options.mutationKey?.[0] === "task-write" && (m.state.variables as Edit | undefined)?.taskId === taskId).length;
}
function markConcurrent(qc: QueryClient, taskId: string) {
  let ids = reconcile.get(qc); if (!ids) { ids = new Set(); reconcile.set(qc,ids); } ids.add(taskId);
}

export function putSavedTask(qc: QueryClient, listId: string | undefined, task: TaskWithRelations) {
  if (listId) qc.setQueryData<ListData>(["list",listId], old => {
    if (!old) return old;
    let found = false;
    let tasks = old.tasks.flatMap(t => {
      if (t.id === task.id) { found = true; return task.archived ? [] : [task]; }
      if (t.id === task.parentId) {
        found = true;
        const subtasks = t.subtasks.filter(s=>s.id!==task.id);
        if (!task.archived) subtasks.push(task);
        subtasks.sort((a,b)=>a.position-b.position);
        return [{...t,subtasks,_count:{...t._count,subtasks:subtasks.length}}];
      }
      return [t];
    });
    if (!found && !task.parentId && !task.archived) tasks = [...tasks,task];
    tasks.sort((a,b)=>a.position-b.position);
    return {...old,tasks};
  });
  qc.setQueryData<TaskDetail>(["task",task.id], old => old ? {...old,...task} : old);
}

function optimistic<T extends TaskWithRelations>(task: T, patch: TaskPatch, statuses: T["status"][]): T {
  const status = statuses.find(s=>s.id===patch.statusId) ?? task.status;
  return {...task,
    name:patch.name ?? task.name, description:patch.description === undefined ? task.description : patch.description,
    priority:patch.priority === undefined ? task.priority : patch.priority, statusId:patch.statusId ?? task.statusId,status,
    position:patch.position ?? task.position, timeEstimate:patch.timeEstimate === undefined ? task.timeEstimate : patch.timeEstimate,
    recurrence:patch.recurrence === undefined ? task.recurrence : patch.recurrence,
    startDate:patch.startDate === undefined ? task.startDate : patch.startDate ? new Date(patch.startDate) : null,
    dueDate:patch.dueDate === undefined ? task.dueDate : patch.dueDate ? new Date(patch.dueDate) : null,
  };
}

/** Shared by rows and the detail dialog, including rollback and concurrent-write reconciliation. */
export function taskUpdateOptions(qc: QueryClient, listId: string | undefined) {
  return {
    mutationKey:["task-write",listId] as const,
    mutationFn:({taskId,patch}:Edit)=>apiSend<TaskWithRelations>(`/api/tasks/${taskId}`,"PATCH",patch),
    onMutate:async ({taskId,patch}:Edit):Promise<Snapshot> => {
      await Promise.all([qc.cancelQueries({queryKey:["list",listId]}),qc.cancelQueries({queryKey:["task",taskId]})]);
      if (pending(qc,taskId)>1) markConcurrent(qc,taskId);
      const list = qc.getQueryData<ListData>(["list",listId]);
      const detail = qc.getQueryData<TaskDetail>(["task",taskId]);
      const statuses = list?.list.statuses ?? detail?.list.statuses ?? [];
      if (listId) qc.setQueryData<ListData>(["list",listId], old => old ? {...old,tasks:old.tasks.map(t=>
        t.id===taskId ? optimistic(t,patch,statuses) : {...t,subtasks:t.subtasks.map(s=>s.id===taskId ? {...s,
          name:patch.name ?? s.name,priority:patch.priority===undefined?s.priority:patch.priority,
          statusId:patch.statusId??s.statusId,status:statuses.find(x=>x.id===patch.statusId)??s.status,
          dueDate:patch.dueDate===undefined?s.dueDate:patch.dueDate?new Date(patch.dueDate):null} : s)})} : old);
      qc.setQueryData<TaskDetail>(["task",taskId], old => old ? optimistic(old,patch,statuses) : old);
      return {list,detail};
    },
    onSuccess:(task:TaskWithRelations,{taskId,patch}:Edit) => {
      if (pending(qc,taskId)>1) markConcurrent(qc,taskId);
      else putSavedTask(qc,listId,task);
      if (patch.statusId && task.recurrence && task.status.type==="DONE" && listId)
        void qc.invalidateQueries({queryKey:["list",listId]});
    },
    onError:(_error:Error,{taskId}:Edit,ctx:Snapshot|undefined) => {
      if (pending(qc,taskId)>1) {markConcurrent(qc,taskId);return;}
      if (listId && ctx?.list) qc.setQueryData<ListData>(["list",listId],old=>old ? {...old,tasks:old.tasks.map(t=>{
        const previous=ctx.list!.tasks.find(p=>p.id===t.id);
        if (t.id===taskId) return previous ?? t;
        return {...t,subtasks:t.subtasks.map(s=>s.id===taskId ? previous?.subtasks.find(p=>p.id===taskId)??s : s)};
      })} : old);
      if (ctx?.detail) qc.setQueryData(["task",taskId],ctx.detail);
    },
    onSettled:async (_task:TaskWithRelations|undefined,_error:Error|null,{taskId}:Edit) => {
      if (pending(qc,taskId)>1) {markConcurrent(qc,taskId);return;}
      if (reconcile.get(qc)?.delete(taskId)) {
        try { const saved=await apiGet<TaskDetail>(`/api/tasks/${taskId}`);
          if (pending(qc,taskId)<=1) putSavedTask(qc,listId,saved);
        } catch { if (listId) void qc.invalidateQueries({queryKey:["list",listId]}); }
      }
      void qc.invalidateQueries({queryKey:["task",taskId]});
      void qc.invalidateQueries({queryKey:["my-tasks"]});
    },
  };
}
