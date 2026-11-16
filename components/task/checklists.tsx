"use client";
import {useRef,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import * as Checkbox from "@radix-ui/react-checkbox";
import {Check,Plus,Trash2,SquareCheckBig,LoaderCircle} from "lucide-react";
import {apiGet} from "@/lib/api";
import {checklistMutationOptions,type ChecklistCommand} from "@/lib/checklist-cache";
import {AssigneeControl} from "@/components/menus/assignee-control";
import {cn} from "@/lib/utils";
import type {TaskDetail,UserLite} from "@/lib/queries";
type ChecklistData=TaskDetail['checklists'][number];
type Run=(command:ChecklistCommand)=>Promise<boolean>;
const iconButton="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover hover:text-cu-urgent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-cu-purple";

export function Checklists({taskId,listId,checklists}:{taskId:string;listId:string;checklists:ChecklistData[]}){
 const qc=useQueryClient(),lock=useRef(false);
 const mutation=useMutation(checklistMutationOptions(qc,taskId,listId));
 const {data:members=[]}=useQuery({queryKey:['checklist-assignees',taskId],queryFn:({signal})=>apiGet<UserLite[]>(`/api/tasks/${taskId}/checklist-assignees`,signal),enabled:checklists.length>0,staleTime:30_000});
 const run:Run=async command=>{
  if(lock.current)return false;lock.current=true;
  try{await mutation.mutateAsync(command);return true;}catch{return false;}finally{lock.current=false;}
 };
 const busy=mutation.isPending;
 return <section className="mt-6" aria-busy={busy}>
  <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-cu-text-secondary"><SquareCheckBig className="h-4 w-4"/>Checklists{busy&&<span role="status" className="ml-auto flex items-center gap-1 text-xs font-normal"><LoaderCircle className="h-3 w-3 animate-spin motion-reduce:animate-none"/>Guardando…</span>}</div>
  {checklists.map(cl=><ChecklistBlock key={cl.id} checklist={cl} members={members} busy={busy} run={run}/>)}
  <button type="button" disabled={busy} onClick={()=>void run({kind:'addChecklist'})} className="mt-2 flex items-center gap-1.5 rounded px-1 py-1 text-[13px] text-cu-text-tertiary hover:text-cu-text-secondary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-cu-purple"><Plus className="h-3.5 w-3.5"/>Agregar checklist</button>
 </section>;
}
function ChecklistBlock({checklist,members,busy,run}:{checklist:ChecklistData;members:UserLite[];busy:boolean;run:Run}){
 const [adding,setAdding]=useState('');
 const done=checklist.items.filter(i=>i.resolved).length,total=checklist.items.length;
 async function addItem(){
  const name=adding.trim();if(!name||busy)return;
  if(await run({kind:'addItem',checklistId:checklist.id,name}))setAdding(current=>current.trim()===name?'':current);
 }
 return <div className="mb-3 rounded-lg border border-cu-border">
  <div className="flex items-center gap-2 border-b border-cu-border px-3 py-2">
   <span className="text-[13px] font-semibold">{checklist.name}</span><span className="text-[11px] text-cu-text-tertiary">{done}/{total}</span>
   <div className="ml-2 h-1.5 w-24 overflow-hidden rounded-full bg-cu-hover-strong"><div className="h-full rounded-full bg-cu-purple transition-all motion-reduce:transition-none" style={{width:`${total?Math.round(done/total*100):0}%`}}/></div>
   <button type="button" disabled={busy} aria-label={`Eliminar checklist ${checklist.name}`} onClick={()=>void run({kind:'removeChecklist',checklistId:checklist.id})} className={iconButton+' ml-auto'}><Trash2 className="h-3.5 w-3.5"/></button>
  </div>
  <div className="p-1.5">
   {checklist.items.map(item=><ChecklistRow key={item.id} item={item} members={members} busy={busy} run={run}/>)}
   <form className="flex items-center gap-2 px-1.5 py-1" onSubmit={e=>{e.preventDefault();void addItem();}}>
    <Plus className="h-4 w-4 shrink-0 text-cu-text-tertiary"/>
    <input disabled={checklist.id.startsWith("pending-")} aria-label={`Nuevo ítem en ${checklist.name}`} value={adding} maxLength={2000} onChange={e=>setAdding(e.target.value)} placeholder="Agregar un ítem" className="min-w-0 flex-1 rounded bg-transparent text-[13px] outline-none placeholder:text-cu-text-tertiary focus-visible:ring-2 focus-visible:ring-cu-purple"/>
    {adding.trim()&&<button disabled={busy} className="rounded px-2 py-1 text-xs text-cu-purple hover:bg-cu-hover disabled:opacity-50">{busy?'Guardando…':'Agregar'}</button>}
   </form>
  </div>
 </div>;
}
function ChecklistRow({item,members,busy,run}:{item:ChecklistData['items'][number];members:UserLite[];busy:boolean;run:Run}){
 const [draft,setDraft]=useState<string|null>(null);
 const edit=(patch:{name?:string;resolved?:boolean;assigneeId?:string|null},assignee?:UserLite|null)=>run({kind:'editItem',checklistId:item.checklistId,itemId:item.id,patch,assignee});
 async function rename(){const name=(draft??item.name).trim();if(name&&name!==item.name&&await edit({name}))setDraft(null);}
 return <div className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-cu-hover/60">
  <Checkbox.Root disabled={busy} checked={item.resolved} aria-label={`Completar ${item.name}`} onCheckedChange={c=>void edit({resolved:!!c})} className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-cu-purple',item.resolved?'border-cu-purple bg-cu-purple':'border-cu-border-strong')}><Checkbox.Indicator><Check className="h-3 w-3 text-white" strokeWidth={3}/></Checkbox.Indicator></Checkbox.Root>
  <input disabled={busy} aria-label="Nombre del ítem" value={draft??item.name} maxLength={2000} onChange={e=>setDraft(e.target.value)} onBlur={()=>void rename()} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.blur();}}} className={cn('min-w-0 flex-1 rounded bg-transparent text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-cu-purple',item.resolved&&'text-cu-text-tertiary line-through')}/>
  <AssigneeControl single disabled={busy} label={`Responsable de ${item.name}`} size="sm" members={members} assignees={item.assignee?[item.assignee]:[]} onChange={ids=>void edit({assigneeId:ids[0]??null},members.find(u=>u.id===ids[0])??null)}/>
  <button type="button" disabled={busy} aria-label={`Eliminar ítem ${item.name}`} onClick={()=>void run({kind:'removeItem',checklistId:item.checklistId,itemId:item.id})} className={iconButton}><Trash2 className="h-3.5 w-3.5"/></button>
 </div>;
}
