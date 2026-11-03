"use client";

import { useQueryClient } from "@tanstack/react-query";
import { DashboardBuilder } from "@/components/dashboard/builder";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSiteRouter as useRouter } from "@/lib/site-navigation";
import {
  List as ListIcon,
  Kanban,
  Calendar as CalendarIcon,
  ChartNoAxesGantt,
  Table2,
  Plus,
  Search,
  Users,
  Ellipsis,
  Star,
  ClipboardList,
  SearchX,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplatePicker } from "@/components/views/template-picker";
import { useList, useCreateTask, useToggleFavorite } from "@/lib/hooks";
import { useWorkspace } from "@/components/workspace-context";
import { hasDrafts } from "@/lib/drafts";
import { apiSend } from "@/lib/api";
import { ViewType } from "@/lib/enums";
import { applyViewState, type ViewState } from "@/lib/view-state";
import { FilterMenu, SortMenu, GroupMenu } from "@/components/views/filter-sort";
import { ListView } from "@/components/views/list-view";
import { BoardView } from "@/components/views/board-view";
import { CalendarView } from "@/components/views/calendar-view";
import { GanttView } from "@/components/views/gantt-view";
import { TableView } from "@/components/views/table-view";
import { TaskModal } from "@/components/task/task-modal";
import { StatusManager } from "@/components/status/status-manager";
import {PersonalView,usePersonalViews} from "./personal-view";
import {viewStateFromConfig} from "@/lib/view-preference-model";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

const VIEW_ICON: Record<ViewType, React.ReactNode> = {
  LIST: <ListIcon className="h-4 w-4" />,
  BOARD: <Kanban className="h-4 w-4" />,
  CALENDAR: <CalendarIcon className="h-4 w-4" />,
  GANTT: <ChartNoAxesGantt className="h-4 w-4" />,
  DASHBOARD: <ChartNoAxesGantt className="h-4 w-4" />,
  TABLE: <Table2 className="h-4 w-4" />,
};

export function ListPage({ listId }: { listId: string }) {const {currentUser}=useWorkspace();return <ListPageContent key={currentUser.id+':'+listId} listId={listId}/>;}
function ListPageContent({ listId }: { listId: string }) {
  const qc=useQueryClient();
  const [viewBusy,setViewBusy]=useState(false),[viewError,setViewError]=useState('');
  const { data, isLoading, error } = useList(listId);
  const create = useCreateTask(listId);
  const { favorites } = useWorkspace();
  const toggleFav = useToggleFavorite();
  const isFav = favorites.includes(listId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [statusMgr, setStatusMgr] = useState(false);
  const [templatePicker, setTemplatePicker] = useState(false);
  const personal=usePersonalViews(listId);

  const views = data?.list.views ?? [];
  const activeView = views.find((v) => v.id === activeViewId) ?? views[0];

  const presentation=activeView?personal.data?.views[activeView.id]??{}:{};
  const vs=presentation.viewState??viewStateFromConfig(activeView?.config);
  // Restore an explicit link first, then this user's last selected view.
  useEffect(() => {
    if(!personal.loading&&personal.data&&views.length&&(!activeViewId||!views.some(v=>v.id===activeViewId))){
      const view=views.find(v=>v.id===searchParams.get("view"))??views.find(v=>v.id===personal.data!.activeViewId)??views[0];
      setActiveViewId(view.id);if(personal.data.activeViewId!==view.id)personal.update({views:{},activeViewId:view.id});
    }
  }, [views,activeViewId,personal.loading,personal.data,personal.update,searchParams]);

  function selectView(view: { id: string; config: unknown }) {
    if(activeView?.type==='DASHBOARD'&&hasDrafts()){setViewError('Guardá o descartá los cambios del dashboard antes de cambiar de vista.');return;}
    setViewError('');
    setActiveViewId(view.id);
    window.history.replaceState(null,"",pathname+"?view="+encodeURIComponent(view.id));
    personal.update({views:{},activeViewId:view.id});
  }

  function updateVs(next:ViewState){if(activeView)personal.update({views:{[activeView.id]:{viewState:next}}});}

  // open the task modal when navigated with ?task=ID (e.g. from command palette)
  useEffect(() => {
    if (taskParam) setOpenTaskId(taskParam);
  }, [taskParam]);

  function closeTask() {
    setOpenTaskId(null);
    if (taskParam) router.replace(pathname+(activeViewId?"?view="+encodeURIComponent(activeViewId):""));
  }

  const shownData = useMemo(
    () => (data ? { ...data, tasks: applyViewState(data.tasks, vs) } : data),
    [data, vs],
  );

  async function addTask() {
    if (!data || create.isPending) return;
    try {
    const task = await create.mutateAsync({
      listId,
      name: "New task",
      statusId: data.list.statuses[0]?.id,
    });
    setOpenTaskId(task.id);
    } catch { /* Global mutation feedback displays the save failure. */ }
  }

  // global "c" keyboard shortcut → create a task in this list
  useEffect(() => {
    const handler = () => void addTask();
    window.addEventListener("create-task", handler);
    return () => window.removeEventListener("create-task", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, listId]);

  if (isLoading||personal.loading) return <PageSkeleton />;
  if(personal.error)return <div className="p-6 text-sm"><p role="alert">No pudimos recuperar tu vista: {personal.error}</p><button className="mt-3 rounded border border-cu-border px-3 py-2" onClick={personal.retry}>Reintentar</button></div>;
  if (error || !data)
    return (
      <div className="flex h-full items-center justify-center text-sm text-cu-text-secondary">
        Couldn&apos;t load this list.
      </div>
    );

  const { list } = data;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      {/* breadcrumb / title bar */}
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="flex items-center gap-1.5 text-[13px] text-cu-text-secondary">
          <span
            className="flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white"
            style={{ backgroundColor: list.space.color }}
          >
            {list.space.icon ?? list.space.name[0]}
          </span>
          {list.space.name}
          {list.folder && <span className="text-cu-text-tertiary">/ {list.folder.name}</span>}
        </span>
      </div>
      <div className="flex items-center gap-2 px-4 pt-1">
        <h1 className="text-lg font-semibold text-cu-text">{list.name}</h1>
        <button
          onClick={() => toggleFav.mutate(listId)}
          aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          className={cn("hover:text-[#ffcc00]", isFav ? "text-[#ffcc00]" : "text-cu-text-tertiary")}
        >
          <Star className={cn("h-4 w-4", isFav && "fill-current")} />
        </button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="rounded p-1 text-cu-text-tertiary hover:bg-cu-hover">
              <Ellipsis className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              sideOffset={4}
              align="start"
              className="z-50 min-w-[180px] rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg"
            >
              <DropdownMenu.Item
                onSelect={() => setStatusMgr(true)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none hover:bg-cu-hover"
              >
                Edit statuses
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => setTemplatePicker(true)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] outline-none hover:bg-cu-hover"
              >
                New from template
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* view tabs */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-cu-border px-3">
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto">
          {list.views.map((v) => (
            <button
              key={v.id}
              onClick={() => selectView(v)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors",
                activeView?.id === v.id
                  ? "border-cu-purple font-medium text-cu-text"
                  : "border-transparent text-cu-text-secondary hover:text-cu-text",
              )}
            >
              {VIEW_ICON[v.type]}
              {v.name}
            </button>
          ))}
          <DropdownMenu.Root><DropdownMenu.Trigger asChild><button disabled={viewBusy} className="flex shrink-0 items-center gap-1 px-2 py-2 text-[13px] text-cu-text-tertiary hover:text-cu-text"><Plus className="h-4 w-4" /> Vista</button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="z-50 rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg"><DropdownMenu.Item className="cursor-pointer rounded p-3 text-sm outline-none hover:bg-cu-hover" onSelect={async()=>{setViewBusy(true);setViewError('');try{const created=await apiSend<{id:string;viewId:string}>('/api/dashboards','POST',{name:'Nuevo dashboard',sources:[listId],listId});await qc.invalidateQueries({queryKey:['list',listId]});setActiveViewId(created.viewId);personal.update({views:{},activeViewId:created.viewId});window.history.replaceState(null,'',pathname+'?view='+created.viewId);}catch(e){setViewError((e as Error).message);}finally{setViewBusy(false);}}}>Dashboard configurable</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
        </div>

        <div className="flex items-center gap-1 text-cu-text-secondary">
          <span role="status" className="mr-2 text-[11px] text-cu-text-tertiary">Vista personal · {personal.saving?"Guardando…":personal.saveError?"Guardado pendiente":"Guardado automático"}</span>
          <ToolbarButton icon={<Users className="h-4 w-4" />} label="Assignee" />
          <GroupMenu state={vs} onChange={updateVs} />
          <FilterMenu state={vs} onChange={updateVs} tasks={data.tasks} />
          <SortMenu state={vs} onChange={updateVs} />
          <button className="rounded p-1.5 hover:bg-cu-hover">
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={addTask}
            className="ml-1 flex items-center gap-1 rounded bg-cu-purple px-2.5 py-1.5 text-[13px] font-medium text-white hover:bg-cu-purple-dark"
          >
            <Plus className="h-4 w-4" /> Add Task
          </button>
        </div>
      </div>

      {viewError&&<p role="alert" className="px-4 py-2 text-sm text-red-600">{viewError}</p>}
      {personal.saveError&&<p role="status" className="flex items-center gap-2 px-4 py-2 text-xs text-cu-text-secondary">Guardado personal pendiente.<button className="text-cu-purple underline" onClick={personal.retry}>Reintentar</button></p>}
      <PersonalView key={activeView?.id} state={presentation} groupBy={vs.groupBy} update={patch=>{if(activeView)personal.update({views:{[activeView.id]:patch}});}}>
      {/* active view */}
      {activeView?.type==='DASHBOARD' ? <DashboardBuilder key={activeView.id} dashboardId={String((activeView.config as {dashboardId?:string}|null)?.dashboardId??'')}/> : shownData && shownData.tasks.length === 0 ? (
        data.tasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="This list is empty"
            subtitle="Create your first task to get started."
            action={
              <button
                onClick={addTask}
                className="flex items-center gap-1 rounded-md bg-cu-purple px-3 py-1.5 text-[13px] font-medium text-white hover:bg-cu-purple-dark"
              >
                <Plus className="h-4 w-4" /> Add Task
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No tasks match your filters"
            subtitle="Try clearing or adjusting the active filters."
          />
        )
      ) : (
        <>
          {activeView?.type === "LIST" && <ListView sorting={!!vs.sort.field} data={shownData!} onOpenTask={setOpenTaskId} groupBy={vs.groupBy} />}
          {activeView?.type === "BOARD" && <BoardView sorting={!!vs.sort.field} data={shownData!} onOpenTask={setOpenTaskId} groupBy={vs.groupBy} />}
          {activeView?.type === "CALENDAR" && <CalendarView data={shownData!} onOpenTask={setOpenTaskId} />}
          {activeView?.type === "GANTT" && <GanttView data={shownData!} onOpenTask={setOpenTaskId} />}
          {activeView?.type === "TABLE" && <TableView data={shownData!} onOpenTask={setOpenTaskId} groupBy={vs.groupBy} />}
        </>
      )}

      </PersonalView>
      {openTaskId && (
        <TaskModal taskId={openTaskId} listId={listId} onClose={closeTask} onOpenTask={setOpenTaskId} />
      )}
      {statusMgr && (
        <StatusManager listId={listId} statuses={data.list.statuses} onClose={() => setStatusMgr(false)} />
      )}
      {templatePicker && (
        <TemplatePicker
          listId={listId}
          onClose={() => setTemplatePicker(false)}
          onCreated={(taskId) => setOpenTaskId(taskId)}
        />
      )}
    </div>
  );
}

function ToolbarButton({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] hover:bg-cu-hover">
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3 p-6">
      <div className="h-7 w-56 animate-pulse rounded bg-cu-hover" />
      <div className="h-9 w-full animate-pulse rounded bg-cu-hover" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-9 w-full animate-pulse rounded bg-cu-hover/60" />
      ))}
    </div>
  );
}
