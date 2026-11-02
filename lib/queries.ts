import { actor } from "./access-context";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma, getD1 } from "@/lib/db";
import { readListTasks } from "./list-task-reader";

// ----------------------------------------------------------------------------
// Reusable include shapes (single source of truth for API <-> client types)
// ----------------------------------------------------------------------------

export const userSelect = {
  id: true,
  name: true,
  email: true,
  color: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export const taskInclude = {
  status: true,
  assignees: { include: { user: { select: userSelect } } },
  tags: { include: { tag: true } },
  customFieldValues: true,
  subtasks: {
    where: { archived: false },
    orderBy: { position: "asc" },
    include: {
      status: true,
      assignees: { include: { user: { select: userSelect } } },
    },
  },
  _count: { select: { comments: true, subtasks: true, checklists: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
export function visibleTask<T extends {subtasks: {id:string}[];_count:{subtasks:number}}>(task:T):T {
  const a=actor();
  return {...task,subtasks:task.subtasks.filter(t=>a.access.can("TASK",t.id)),_count:{...task._count,subtasks:task.subtasks.filter(t=>a.access.can("TASK",t.id)).length}};
}
export type SubtaskWithRelations = TaskWithRelations["subtasks"][number];
export type UserLite = Prisma.UserGetPayload<{ select: typeof userSelect }>;

// ----------------------------------------------------------------------------
// Workspace tree (for sidebar)
// ----------------------------------------------------------------------------

export async function getWorkspaceTree() {
  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      members: { include: { user: { select: userSelect } } },
      spaces: {
        orderBy: { position: "asc" },
        include: {
          folders: {
            orderBy: { position: "asc" },
            include: {
              lists: {
                orderBy: { position: "asc" },
                include: { _count: { select: { tasks: true } } },
              },
            },
          },
          lists: {
            where: { folderId: null },
            orderBy: { position: "asc" },
            include: { _count: { select: { tasks: true } } },
          },
        },
      },
    },
  });
  if (!workspace) return workspace;
  const a = actor();
  const visibleList = (l: (typeof workspace.spaces)[number]["lists"][number]) => { l._count.tasks = a.access.resources("TASK").filter(t=>t.listId===l.id&&a.access.can("TASK",t.id)).length; return a.access.visibleList(l.id); };
  workspace.spaces = workspace.spaces.map(s=>({...s,lists:s.lists.filter(visibleList),folders:s.folders.map(f=>({...f,lists:f.lists.filter(visibleList)})).filter(f=>f.lists.length>0)})).filter(s=>a.access.can("SPACE",s.id)||s.lists.length>0||s.folders.length>0);
  if (!a.access.admin) {
    const enabled=await getD1().prepare('SELECT userId FROM AccountAccess WHERE enabled=1').all<{userId:string}>();
    const ids=new Set(enabled.results.map(u=>u.userId));
    workspace.members=workspace.members.filter(m=>m.userId===a.user.id||ids.has(m.userId));
  }
  return workspace;
}

export type WorkspaceTree = NonNullable<Awaited<ReturnType<typeof getWorkspaceTree>>>;
export type SpaceNode = WorkspaceTree["spaces"][number];
export type FolderNode = SpaceNode["folders"][number];
export type ListNode = SpaceNode["lists"][number];

// ----------------------------------------------------------------------------
// List detail (statuses, custom fields, views, tasks)
// ----------------------------------------------------------------------------

export async function getListData(listId: string) {
  const a = actor();
  if (!a.access.visibleList(listId)) return null;
  const [list, loaded] = await Promise.all([prisma.list.findUnique({
    where: { id: listId },
    include: {
      space: { select: { id: true, name: true, color: true, icon: true } },
      folder: { select: { id: true, name: true } },
      statuses: { orderBy: { position: "asc" } },
      customFields: {
        orderBy: { position: "asc" },
        include: { options: { orderBy: { position: "asc" } } },
      },
      views: { orderBy: { position: "asc" } },
    },
  }), readListTasks(getD1(),listId)]);
  if (!list) return null;

  const tasks = loaded.tasks.filter(t => {
    if (!a.access.can("TASK",t.id)) return false;
    return !t.parentId || !a.access.can("TASK",t.parentId);
  }).map(visibleTask);
  const dependencies = loaded.dependencies;
  return { list, tasks, dependencies:dependencies.filter(d=>a.access.can("TASK",d.blockerId)&&a.access.can("TASK",d.blockedId)) };
}

export type ListData = NonNullable<Awaited<ReturnType<typeof getListData>>>;
export type ListWithMeta = ListData["list"];
export type StatusModel = ListWithMeta["statuses"][number];
export type CustomFieldWithOptions = ListWithMeta["customFields"][number];

// ----------------------------------------------------------------------------
// Task detail (full, for the task modal)
// ----------------------------------------------------------------------------

export async function getTaskDetail(taskId: string) {
  const a=actor(); a.access.assert("TASK",taskId);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      ...taskInclude,
      createdBy: { select: userSelect },
      watchers: { include: { user: { select: userSelect } } },
      attachments: { orderBy: { createdAt: "desc" } },
      timeEntries: {
        orderBy: { startedAt: "desc" },
        include: { user: { select: userSelect } },
      },
      blockedBy: {
        include: {
          blocker: {
            select: { id: true, name: true, listId: true, status: { select: { name: true, color: true, type: true } } },
          },
        },
      },
      blocking: {
        include: {
          blocked: {
            select: { id: true, name: true, listId: true, status: { select: { name: true, color: true, type: true } } },
          },
        },
      },
      checklists: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: userSelect },
          reactions: true,
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: userSelect } },
      },
      list: {
        select: {
          id: true,
          name: true,
          spaceId: true,
          statuses: { orderBy: { position: "asc" } },
          customFields: {
            orderBy: { position: "asc" },
            include: { options: { orderBy: { position: "asc" } } },
          },
        },
      },
    },
  });
  if (!task) return null;
  task.subtasks=task.subtasks.filter(t=>a.access.can("TASK",t.id));
  task._count.subtasks=task.subtasks.length;
  task.blockedBy=task.blockedBy.filter(d=>a.access.can("TASK",d.blockerId));
  task.blocking=task.blocking.filter(d=>a.access.can("TASK",d.blockedId));
  // Imported activity payloads may contain cross-resource names.
  if(!a.access.admin) task.activities=task.activities.filter(x=>{const d=x.data as Record<string,unknown>|null;return ['web','mcp','api'].includes(String(d?.source));});
  return task;
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
