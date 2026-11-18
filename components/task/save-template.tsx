"use client";

import {useRef,useState,type ReactNode} from "react";
import {useSiteRouter as useRouter} from "@/lib/site-navigation";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import {Ellipsis,BookmarkPlus,Copy,FolderInput,Link2,Hash,ExternalLink,Archive,Trash2,Settings2,Link,Bell,ChevronRight} from "lucide-react";
import {apiSend} from "@/lib/api";
import {taskPath} from "@/lib/task-links";
import {useSaveTemplate,useDuplicateTask,useUpdateTask} from "@/lib/hooks";
import {useWorkspace} from "@/components/workspace-context";
import {openFieldManager} from "@/components/custom-fields/manager";
import type {TaskDetail} from "@/lib/queries";
import {useTaskLinks,TaskCopyDialog} from "./task-links";

const itemClass="flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[13px] outline-none hover:bg-cu-hover focus:bg-cu-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40";
export function TaskMenu({task,onClose,onOpenTask,onShowFields,onShowDependencies,onReminder}:{
 task:TaskDetail;onClose:()=>void;onOpenTask?:(id:string,listId?:string)=>void;
 onShowFields:()=>void;onShowDependencies:()=>void;onReminder:()=>void;
}){
 const taskId=task.id,listId=task.listId,p=task.menuPermissions;
 const [dialog,setDialog]=useState<'template'|'archive'|'delete'|null>(null);
 const [name,setName]=useState(task.name),[error,setError]=useState('');
 const triggerRef=useRef<HTMLButtonElement>(null),afterClose=useRef<(()=>void)|null>(null);
 const whenClosed=(action:()=>void)=>{afterClose.current=action;};
 const lock=useRef(false),save=useSaveTemplate(),duplicate=useDuplicateTask(listId),update=useUpdateTask(listId),qc=useQueryClient(),router=useRouter();
 const {workspace}=useWorkspace(),links=useTaskLinks(listId,taskId);
 const moveLists=new Set(p?.moveListIds??[]);
 const otherLists=workspace.spaces.flatMap(s=>[...s.lists,...s.folders.flatMap(f=>f.lists)]).filter(l=>moveLists.has(l.id));
 const move=useMutation({
  mutationFn:(target:string)=>apiSend<{listId:string}>(`/api/tasks/${taskId}/move`,"POST",{listId:target}),
  onSuccess:r=>{void qc.invalidateQueries({queryKey:["list",listId]});router.push(taskPath(r.listId,taskId));},
 });
 const remove=useMutation({
  mutationFn:()=>apiSend(`/api/tasks/${taskId}`,"DELETE"),
  onSuccess:()=>{void qc.invalidateQueries({queryKey:["list",listId]});if(task.parentId)void qc.invalidateQueries({queryKey:["task",task.parentId]});qc.removeQueries({queryKey:["task",taskId],exact:true});onClose();},
 });
 const busy=save.isPending||duplicate.isPending||move.isPending||update.isPending||remove.isPending;
 const show=(kind:typeof dialog)=>{setName(task.name);setError('');setDialog(kind);};
 async function submit(){
  if(lock.current||busy||!dialog||dialog==='template'&&!name.trim())return;
  lock.current=true;setError('');
  try{
   if(dialog==='template'){await save.mutateAsync({fromTaskId:taskId,name:name.trim()});setDialog(null);}
   if(dialog==='archive'){await update.mutateAsync({taskId,patch:{archived:!task.archived}});setDialog(null);onClose();}
   if(dialog==='delete'){await remove.mutateAsync();setDialog(null);}
  }catch(e){setError((e as Error).message);}finally{lock.current=false;}
 }
 return <>
  <DropdownMenu.Root>
   <DropdownMenu.Trigger asChild><button ref={triggerRef} type="button" aria-label="Opciones de la tarea" title="Opciones de la tarea" className="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple"><Ellipsis className="h-4 w-4"/></button></DropdownMenu.Trigger>
   <DropdownMenu.Portal>
    <DropdownMenu.Content sideOffset={6} align="end" collisionPadding={8} onCloseAutoFocus={event=>{const action=afterClose.current;if(action){event.preventDefault();afterClose.current=null;action();}}} className="z-[70] max-h-[min(80dvh,640px)] w-[270px] max-w-[92vw] overflow-y-auto rounded-lg border border-cu-border bg-cu-panel p-1 shadow-xl">
     <Action icon={<Link2/>} onSelect={links.copyLink}>Copiar vínculo</Action>
     <Action icon={<Hash/>} onSelect={links.copyId}>Copiar ID</Action>
     <DropdownMenu.Item asChild className={itemClass}><a href={taskPath(listId,taskId)} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Abrir en otra pestaña</a></DropdownMenu.Item>
     <DropdownMenu.Separator className="my-1 border-t border-cu-border"/>
     {p?.canRemind&&<Action disabled={busy} icon={<Bell/>} onSelect={()=>whenClosed(onReminder)}>Recordarme esta tarea</Action>}
     <Action icon={<Link/>} onSelect={()=>whenClosed(onShowDependencies)}>Dependencias</Action>
     <Action icon={<Settings2/>} onSelect={()=>whenClosed(onShowFields)}>Ver campos personalizados</Action>
     {p?.canManageFields&&<Action disabled={busy} icon={<Settings2/>} onSelect={()=>whenClosed(()=>openFieldManager({location:{type:'LIST',id:listId}}))}>Administrar campos</Action>}
     {p?.canDuplicate&&<Action disabled={busy} icon={<Copy/>} onSelect={()=>duplicate.mutate(taskId,{onSuccess:copy=>{if(onOpenTask)onOpenTask(copy.id,copy.listId);else router.push(taskPath(copy.listId,copy.id));}})}>Duplicar tarea</Action>}
     {p?.canMove&&otherLists.length>0&&<DropdownMenu.Sub>
      <DropdownMenu.SubTrigger disabled={busy} className={itemClass}><FolderInput size={16}/>Mover a<ChevronRight className="ml-auto h-3 w-3"/></DropdownMenu.SubTrigger>
      <DropdownMenu.Portal><DropdownMenu.SubContent collisionPadding={8} sideOffset={4} className="z-[75] max-h-[320px] min-w-[200px] max-w-[90vw] overflow-y-auto rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg">
       {otherLists.map(list=><DropdownMenu.Item key={list.id} onSelect={()=>move.mutate(list.id)} className={itemClass}>{list.name}</DropdownMenu.Item>)}
      </DropdownMenu.SubContent></DropdownMenu.Portal>
     </DropdownMenu.Sub>}
     {p?.canSaveTemplate&&<Action disabled={busy} icon={<BookmarkPlus/>} onSelect={()=>whenClosed(()=>show('template'))}>Guardar como plantilla</Action>}
     {(p?.canEdit||p?.canDelete)&&<DropdownMenu.Separator className="my-1 border-t border-cu-border"/>}
     {p?.canEdit&&<Action disabled={busy} icon={<Archive/>} onSelect={()=>whenClosed(()=>show('archive'))}>{task.archived?'Desarchivar tarea':'Archivar tarea'}</Action>}
     {p?.canDelete&&<Action disabled={busy} icon={<Trash2/>} danger onSelect={()=>whenClosed(()=>show('delete'))}>Eliminar tarea</Action>}
    </DropdownMenu.Content>
   </DropdownMenu.Portal>
  </DropdownMenu.Root>
  <Dialog.Root open={dialog!==null} onOpenChange={open=>{if(!open&&!busy)setDialog(null);}}>
   <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40"/>
    <Dialog.Content onCloseAutoFocus={event=>{event.preventDefault();triggerRef.current?.focus();}} className="fixed left-1/2 top-1/2 z-[80] w-[min(420px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl outline-none">
     <Dialog.Title className="text-sm font-semibold">{dialog==='template'?'Guardar como plantilla':dialog==='delete'?'Eliminar tarea':task.archived?'Desarchivar tarea':'Archivar tarea'}</Dialog.Title>
     <Dialog.Description className="mt-2 break-words text-sm text-cu-text-secondary">
      {dialog==='template'?'Guarda una plantilla reutilizable con los datos admitidos de esta tarea.':dialog==='delete'?`«${task.name}» y sus subtareas irán a la papelera. Un administrador puede restaurarlas.`:`«${task.name}» ${task.archived?'volverá a la lista activa.':'se ocultará de las vistas activas. Su contenido se conserva.'}`}
     </Dialog.Description>
     <form onSubmit={e=>{e.preventDefault();void submit();}} className="mt-4 space-y-4">
      {dialog==='template'&&<label className="block text-xs">Nombre de la plantilla<input autoFocus value={name} maxLength={200} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded border border-cu-border bg-cu-bg px-3 py-2 text-sm outline-none focus:border-cu-purple"/></label>}
      {error&&<p role="alert" className="text-xs text-cu-urgent">{error}</p>}
      <div className="flex justify-end gap-2">
       <Dialog.Close disabled={busy} type="button" className="rounded px-3 py-2 text-sm text-cu-text-secondary hover:bg-cu-hover">Cancelar</Dialog.Close>
       <button disabled={busy||dialog==='template'&&!name.trim()} className="rounded bg-cu-purple px-3 py-2 text-sm text-white hover:bg-cu-purple-dark disabled:opacity-40">{busy?'Guardando…':dialog==='delete'?'Enviar a papelera':dialog==='template'?'Guardar plantilla':'Confirmar'}</button>
      </div>
     </form>
    </Dialog.Content>
   </Dialog.Portal>
  </Dialog.Root>
  <TaskCopyDialog value={links.manual} onClose={links.closeManual}/>
 </>;
}
function Action({children,icon,onSelect,disabled,danger}:{children:ReactNode;icon:ReactNode;onSelect:()=>void;disabled?:boolean;danger?:boolean}){
 return <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className={itemClass+(danger?' text-cu-urgent':'')}><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>{children}</DropdownMenu.Item>;
}
