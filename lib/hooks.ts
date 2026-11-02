"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { taskUpdateOptions, putSavedTask } from "./task-cache";
import { apiGet, apiSend } from "@/lib/api";
import type { ListData, TaskWithRelations, UserLite, WorkspaceTree } from "@/lib/queries";

export type Bootstrap = { currentUser: UserLite; workspace: WorkspaceTree; favorites: string[]; authorization:{role:string;admin:boolean} };

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) => apiSend<{ favorited: boolean }>(`/api/lists/${listId}/favorite`, "POST"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bootstrap"] }),
  });
}

// ----------------------------------------------------------------------------
// Queries
// ----------------------------------------------------------------------------

/** Subscribe to the SSE stream and invalidate caches so collaborators' changes appear live. */
export function useRealtime() {
  // Other-user changes are offered by ChangesNotice, never applied over drafts.
  // Inbox has independent polling; it does not require a process-local SSE event.
}

export type NotificationItem = {
  id: string;
  type: string;
  body: string;
  read: boolean;
  createdAt: string;
  actor: UserLite | null;
  task: { id: string; name: string; listId: string } | null;
};

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<{ notifications: NotificationItem[]; unread: number }>("/api/notifications"),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => apiSend("/api/notifications/read", "POST", { ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export type MyTask = {
  id: string;
  name: string;
  listId: string;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  status: { name: string; color: string; type: string };
  list: { name: string; space: { name: string; color: string } };
};

export function useMyTasks() {
  return useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => apiGet<{ tasks: MyTask[] }>("/api/me/tasks"),
    placeholderData: keepPreviousData,
  });
}

export type TaskTemplate = {
  id: string;
  name: string;
  taskName: string;
  description: string | null;
  priority: string | null;
  checklists: { name: string; items: string[] }[] | null;
};

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => apiGet<TaskTemplate[]>("/api/templates"),
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fromTaskId: string; name: string }) =>
      apiSend<TaskTemplate>("/api/templates", "POST", v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend(`/api/templates/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useApplyTemplate(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      apiSend<TaskWithRelations>(`/api/lists/${listId}/apply-template`, "POST", { templateId }),
    onSuccess: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useBootstrap() {
  return useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiGet<Bootstrap>("/api/bootstrap"),
    staleTime: 5 * 60_000,
  });
}

export function useList(listId: string | undefined) {
  return useQuery({
    queryKey: ["list", listId],
    queryFn: () => apiGet<ListData>(`/api/lists/${listId}`),
    enabled: !!listId,
    // keep the previous list visible while the next one loads (no skeleton flash)
    placeholderData: keepPreviousData,
  });
}

// ----------------------------------------------------------------------------
// Hierarchy CRUD (spaces / folders / lists) — all refresh the sidebar tree
// ----------------------------------------------------------------------------

type ListLite = { id: string; name: string; spaceId: string };

export function useHierarchy() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["bootstrap"] });

  const createSpace = useMutation({
    mutationFn: (name: string) => apiSend<{ id: string }>("/api/spaces", "POST", { name }),
    onSuccess: refresh,
  });
  const createFolder = useMutation({
    mutationFn: (v: { spaceId: string; name: string }) =>
      apiSend<{ id: string }>("/api/folders", "POST", v),
    onSuccess: refresh,
  });
  const createList = useMutation({
    mutationFn: (v: { spaceId: string; folderId?: string | null; name: string }) =>
      apiSend<ListLite>("/api/lists", "POST", v),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: (v: { kind: "spaces" | "folders" | "lists"; id: string; name: string }) =>
      apiSend(`/api/${v.kind}/${v.id}`, "PATCH", { name: v.name }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (v: { kind: "spaces" | "folders" | "lists"; id: string }) =>
      apiSend(`/api/${v.kind}/${v.id}`, "DELETE"),
    onSuccess: refresh,
  });

  return { createSpace, createFolder, createList, rename, remove };
}

export type TagModel = { id: string; spaceId: string; name: string; color: string };

export function useTags(spaceId: string | undefined) {
  return useQuery({
    queryKey: ["tags", spaceId],
    queryFn: () => apiGet<TagModel[]>(`/api/spaces/${spaceId}/tags`),
    enabled: !!spaceId,
  });
}

export function useCreateTag(spaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiSend<TagModel>(`/api/spaces/${spaceId}/tags`, "POST", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags", spaceId] }),
  });
}

// ----------------------------------------------------------------------------
// Mutations (optimistic where it matters for UX feel)
// ----------------------------------------------------------------------------

export function useUpdateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation(taskUpdateOptions(qc,listId));
}

export function useCreateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listId: string;
      name: string;
      statusId?: string;
      parentId?: string | null;
      priority?: string | null;
      assigneeIds?: string[];
    }) => apiSend<TaskWithRelations>("/api/tasks", "POST", input),
    onSuccess: (task) => {
      putSavedTask(qc,listId,task);
      void qc.invalidateQueries({queryKey:["bootstrap"],refetchType:"none"});
    },
  });
}

export function useDuplicateTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend<TaskWithRelations>(`/api/tasks/${taskId}/duplicate`, "POST"),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useBulk(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      ids: string[];
      patch?: { statusId?: string; priority?: string | null; assigneeIds?: string[] };
      delete?: boolean;
    }) => apiSend("/api/tasks/bulk", "POST", input),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useSetFieldValue(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; fieldId: string; value: unknown }) =>
      apiSend(`/api/tasks/${v.taskId}/fields/${v.fieldId}`, "PUT", { value: v.value }),
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}

export function useDeleteTask(listId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      apiSend<{ ok: true }>(`/api/tasks/${taskId}`, "DELETE"),
    onMutate: async (taskId) => {
      if (!listId) return;
      await qc.cancelQueries({ queryKey: ["list", listId] });
      const prev = qc.getQueryData<ListData>(["list", listId]);
      if (prev) {
        qc.setQueryData<ListData>(["list", listId], {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== taskId),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev && listId) qc.setQueryData(["list", listId], ctx.prev);
    },
    onSettled: () => {
      if (listId) qc.invalidateQueries({ queryKey: ["list", listId] });
    },
  });
}
