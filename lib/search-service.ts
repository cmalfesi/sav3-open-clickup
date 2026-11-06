import type {Actor} from './access-context';
import {canReadField} from './field-runtime';
import {AccessError} from './access-context';
export async function searchWorkspace(db:D1Database,a:Actor,query:string,offset=0,limit=25,listId?:string){
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const q=norm(query.trim());if(q.length>200)throw new AccessError(400,'Búsqueda demasiado larga.');
 if(!q)return {tasks:[],lists:[],nextOffset:null};
 const ids=a.access.resources('TASK').filter(t=>a.access.can('TASK',t.id)&&(!listId||t.listId===listId)).map(t=>t.id);
 const rs=await db.batch([
 db.prepare(`SELECT t.id,t.name,t.description,t.listId,s.name statusName,s.color statusColor,s.type statusType,l.name listName FROM Task t JOIN Status s ON s.id=t.statusId JOIN List l ON l.id=t.listId WHERE t.archived=0 AND t.id IN(SELECT value FROM json_each(?)) ORDER BY t.updatedAt DESC,t.id`).bind(JSON.stringify(ids)),
 db.prepare(`SELECT v.taskId,v.value,f.name fieldName,f.config fieldConfig,o.label FROM CustomFieldValue v JOIN CustomField f ON f.id=v.customFieldId LEFT JOIN CustomFieldOption o ON o.customFieldId=f.id AND (o.id=json_extract(v.value,'$') OR EXISTS(SELECT 1 FROM json_each(v.value) j WHERE j.value=o.id)) WHERE v.taskId IN(SELECT value FROM json_each(?))`).bind(JSON.stringify(ids)),
 db.prepare('SELECT l.id,l.name,l.color,s.name spaceName FROM List l JOIN Space s ON s.id=l.spaceId ORDER BY l.name')]);
 const values=new Map<string,string>();for(const v of rs[1].results as {taskId:string;value:string;label:string|null;fieldName:string;fieldConfig:string|null}[])if(canReadField(a,v.fieldConfig))values.set(v.taskId,(values.get(v.taskId)??'')+' '+v.fieldName+' '+(v.label??v.value));
 const found=(rs[0].results as {id:string;name:string;description:string|null;listId:string;listName:string;statusName:string;statusColor:string;statusType:string}[]).filter(t=>norm(t.name+' '+(t.description??'').replace(/<[^>]*>/g,' ')+' '+(values.get(t.id)??'')).includes(q));
 const tasks=found.slice(offset,offset+limit).map(t=>({id:t.id,name:t.name,listId:t.listId,list:{name:t.listName},status:{name:t.statusName,color:t.statusColor,type:t.statusType}}));
 const lists=(rs[2].results as {id:string;name:string;color:string;spaceName:string}[]).filter(l=>a.access.visibleList(l.id)&&norm(l.name).includes(q));
 return {tasks,lists:lists.slice(0,25).map(l=>({...l,space:{name:l.spaceName}})),nextOffset:offset+limit<found.length?offset+limit:null,total:found.length};
}
