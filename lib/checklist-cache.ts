import type {QueryClient} from "@tanstack/react-query";
import type {TaskDetail,UserLite,ListData} from "./queries";
import {apiSend} from "./api";
type Checklist=TaskDetail['checklists'][number];
type Item=Checklist['items'][number];
export type ChecklistCommand=
 | {kind:'addChecklist';name?:string}
 | {kind:'removeChecklist';checklistId:string}
 | {kind:'addItem';checklistId:string;name:string}
 | {kind:'editItem';checklistId:string;itemId:string;patch:{name?:string;resolved?:boolean;assigneeId?:string|null};assignee?:UserLite|null}
 | {kind:'removeItem';checklistId:string;itemId:string};
function count(qc:QueryClient,listId:string,taskId:string,n:number){
 qc.setQueryData<ListData>(['list',listId],old=>old?{...old,tasks:old.tasks.map(t=>t.id===taskId?{...t,_count:{...t._count,checklists:n}}:t)}:old);
}
export function checklistMutationOptions(qc:QueryClient,taskId:string,listId:string){
 const key=['task',taskId];
 return {
  mutationKey:['checklist-write',taskId],retry:false,
  mutationFn:(command:ChecklistCommand):Promise<Checklist|Item|{ok:true}>=>{
   switch(command.kind){
    case 'addChecklist':return apiSend(`/api/tasks/${taskId}/checklists`,'POST',{name:command.name});
    case 'removeChecklist':return apiSend(`/api/checklists/${command.checklistId}`,'DELETE');
    case 'addItem':return apiSend(`/api/checklists/${command.checklistId}/items`,'POST',{name:command.name});
    case 'editItem':return apiSend(`/api/checklist-items/${command.itemId}`,'PATCH',command.patch);
    case 'removeItem':return apiSend(`/api/checklist-items/${command.itemId}`,'DELETE');
   }
  },
  onMutate:async(command:ChecklistCommand)=>{
   await qc.cancelQueries({queryKey:key});
   const previous=qc.getQueryData<TaskDetail>(key)?.checklists;
   const temporaryId='pending-'+crypto.randomUUID();
   qc.setQueryData<TaskDetail>(key,old=>{
    if(!old)return old;
    let checklists=old.checklists;
    if(command.kind==='addChecklist')checklists=[...checklists,{id:temporaryId,taskId,name:command.name??'Checklist',position:Date.now(),items:[]}];
    else if(command.kind==='removeChecklist')checklists=checklists.filter(c=>c.id!==command.checklistId);
    else checklists=checklists.map(c=>{
     if(c.id!==command.checklistId)return c;
     let items=c.items;
     if(command.kind==='addItem')items=[...items,{id:temporaryId,checklistId:c.id,name:command.name,position:Date.now(),resolved:false,assigneeId:null,assignee:null}];
     else if(command.kind==='removeItem')items=items.filter(i=>i.id!==command.itemId);
     else items=items.map(i=>i.id===command.itemId?{...i,...command.patch,...(command.assignee!==undefined?{assignee:command.assignee}:{})}:i);
     return {...c,items};
    });
    return {...old,checklists,_count:{...old._count,checklists:checklists.length}};
   });
   return {previous,temporaryId};
  },
  onSuccess:(result:Checklist|Item|{ok:true},command:ChecklistCommand,ctx:{previous:Checklist[]|undefined;temporaryId:string})=>{
   qc.setQueryData<TaskDetail>(key,old=>{
    if(!old)return old;
    const checklists=old.checklists.map(c=>{
     if(command.kind==='addChecklist'&&c.id===ctx.temporaryId)return result as Checklist;
     if(command.kind==='addItem'&&c.id===command.checklistId)return {...c,items:c.items.map(i=>i.id===ctx.temporaryId?result as Item:i)};
     if(command.kind==='editItem'&&c.id===command.checklistId)return {...c,items:c.items.map(i=>i.id===command.itemId?result as Item:i)};
     return c;
    });
    return {...old,checklists};
   });
   count(qc,listId,taskId,qc.getQueryData<TaskDetail>(key)?.checklists.length??0);
   // The returned entity is authoritative. Avoid re-downloading the entire task/list.
   void qc.invalidateQueries({queryKey:key,refetchType:'none'});
  },
  onError:(_error:Error,_command:ChecklistCommand,ctx:{previous:Checklist[]|undefined;temporaryId:string}|undefined)=>{
   if(ctx?.previous)qc.setQueryData<TaskDetail>(key,old=>old?{...old,checklists:ctx.previous!,_count:{...old._count,checklists:ctx.previous!.length}}:old);
  },
 };
}
