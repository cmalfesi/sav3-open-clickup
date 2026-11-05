import { effectiveFieldIds } from './custom-field-service';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AccessError,type Actor } from './access-context';
import { dashboardSchema,emptyDashboard,type DashboardConfig,type DashboardData,type DashboardTask } from './dashboard-model';
type RecordRow={id:string;name:string;sources:string;createdBy:string;createdAt:number;config:string|null;revision:number|null;archived:number|null;updatedAt:number|null};
const iso=(v:unknown):string|null=>{if(v===null||v===undefined)return null;const date=new Date(typeof v==='number'?v:String(v).replace(/^(\d{4}-\d\d-\d\d) (\d\d:.*)$/,'$1T$2Z'));return Number.isFinite(date.getTime())?date.toISOString():null;};
const decode=(v:unknown)=>{if(typeof v!=='string')return v;try{return JSON.parse(v);}catch{return v;}};
async function rows<T>(db:D1Database,sql:string,...args:(string|number)[]){return(await db.prepare(sql).bind(...args).all<T>()).results;}
const select='SELECT d.*,c.config,c.revision,c.archived,c.updatedAt FROM Dashboard d LEFT JOIN DashboardDocument c ON c.dashboardId=d.id';
const edit=(a:Actor,id:string)=>a.role!=='GUEST'&&a.tokenScope!=='read'&&a.access.can('DASHBOARD',id,'EDIT');
const manage=(a:Actor,createdBy:string)=>a.access.admin||a.user.id===createdBy;
const canDelete=(a:Actor,d:RecordRow)=>edit(a,d.id)&&manage(a,d.createdBy);
export async function readDashboard(db:D1Database,a:Actor,id:string){
 a.access.assert('DASHBOARD',id);const row=await db.prepare(select+' WHERE d.id=?').bind(id).first<RecordRow>();if(!row)throw new AccessError(404,'No existe el dashboard.');
 return {id:row.id,name:row.name,config:row.config?dashboardSchema.parse(JSON.parse(row.config)):emptyDashboard(JSON.parse(row.sources)),revision:row.revision??0,archived:!!row.archived,updatedAt:row.updatedAt??row.createdAt,canEdit:edit(a,id),canShare:manage(a,row.createdBy)};
}
export async function dashboardDataset(db:D1Database,a:Actor,config:DashboardConfig):Promise<DashboardData>{
 const rs=await db.batch([
  db.prepare('SELECT t.id,t.name,t.listId,t.parentId,t.statusId,t.priority,t.createdAt,t.dueDate,t.completedAt,t.archived,t.timeEstimate,s.name statusName,s.color statusColor,s.type statusType FROM Task t JOIN Status s ON s.id=t.statusId'),
  db.prepare('SELECT id,name FROM List'),db.prepare('SELECT id,name,color,listId FROM Status'),
  db.prepare('SELECT a.taskId,a.userId,u.name,u.color FROM TaskAssignee a JOIN User u ON u.id=a.userId'),
  db.prepare('SELECT t.taskId,t.tagId,g.name,g.color FROM TaskTag t JOIN Tag g ON g.id=t.tagId'),
  db.prepare('SELECT id,listId,name,type FROM CustomField'),db.prepare('SELECT id,customFieldId,label name,color FROM CustomFieldOption'),
  db.prepare('SELECT taskId,customFieldId,value FROM CustomFieldValue'),
  db.prepare('SELECT a.id,a.taskId,a.type,a.createdAt,a.data,u.name userName FROM Activity a LEFT JOIN User u ON u.id=a.userId ORDER BY a.createdAt DESC'),
  db.prepare('SELECT u.id,u.name,u.color FROM User u JOIN AccountAccess a ON a.userId=u.id WHERE a.enabled=1'),
 ]);
 const tasks=(rs[0].results as Omit<DashboardTask,'assignees'|'tags'|'fields'>[]).filter(t=>a.access.can('TASK',t.id)&&(!config.sources.length||config.sources.includes(t.listId))).map(t=>({...t,createdAt:iso(t.createdAt)??'',dueDate:iso(t.dueDate),completedAt:iso(t.completedAt),assignees:[] as string[],tags:[] as string[],fields:{} as Record<string,unknown>}));
 const index=new Map(tasks.map(t=>[t.id,t]));
 const members=new Map<string,DashboardData['members'][number]>((rs[9].results as DashboardData['members']).map(u=>[u.id,u]));
 for(const r of rs[3].results as {taskId:string;userId:string;name:string;color:string}[]){const t=index.get(r.taskId);if(t){t.assignees.push(r.userId);members.set(r.userId,{id:r.userId,name:r.name,color:r.color});}}
 const tags=new Map<string,DashboardData['tags'][number]>();for(const r of rs[4].results as {taskId:string;tagId:string;name:string;color:string}[]){const t=index.get(r.taskId);if(t){t.tags.push(r.tagId);tags.set(r.tagId,{id:r.tagId,name:r.name,color:r.color});}}
 for(const r of rs[7].results as {taskId:string;customFieldId:string;value:unknown}[]){const t=index.get(r.taskId);if(t)t.fields[r.customFieldId]=decode(r.value);}
 const listIds=new Set((rs[1].results as {id:string}[]).filter(l=>a.access.visibleList(l.id)&&(!config.sources.length||config.sources.includes(l.id))).map(l=>l.id));
 const availableFields = new Set(await effectiveFieldIds(db,[...listIds]));
 const options=rs[6].results as {id:string;customFieldId:string;name:string;color:string}[];
 const activities=(rs[8].results as {id:string;taskId:string;type:string;createdAt:string;data:string|null;userName:string|null}[]).filter(r=>index.has(r.taskId)&&(a.access.admin||['web','api','mcp'].includes(String((decode(r.data) as {source?:string}|null)?.source)))).map(r=>({id:r.id,taskId:r.taskId,taskName:index.get(r.taskId)!.name,listId:index.get(r.taskId)!.listId,userName:r.userName??'Sistema',type:r.type,createdAt:iso(r.createdAt)??''})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,200);
 return {tasks,lists:(rs[1].results as DashboardData['lists']).filter(l=>listIds.has(l.id)),statuses:(rs[2].results as DashboardData['statuses']).filter(s=>listIds.has(s.listId!)),members:[...members.values()],tags:[...tags.values()],fields:(rs[5].results as {id:string;listId:string;name:string;type:string}[]).filter(f=>availableFields.has(f.id)).map(f=>({...f,options:options.filter(o=>o.customFieldId===f.id)})),activities,refreshedAt:new Date().toISOString()};
}
async function validateSources(a:Actor,config:DashboardConfig){for(const id of config.sources)if(!a.access.visibleList(id))throw new AccessError(403,'Una fuente seleccionada no está disponible con tus permisos.');}
export async function createDashboard(
 db:D1Database,a:Actor,name:string,config:DashboardConfig,listId?:string,
 ids:{id:string;viewId:string}={id:randomUUID(),viewId:randomUUID()},
){
 if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');
 await validateSources(a,config);
 if(listId)a.access.assert('LIST',listId,'EDIT');
 const {id}=ids,now=Date.now(),json=JSON.stringify(config);
 const writes=[
  db.prepare('INSERT INTO Dashboard (id,name,sources,createdBy,createdAt) VALUES (?,?,?,?,?)').bind(id,name,JSON.stringify(config.sources),a.user.id,now),
  db.prepare('INSERT INTO DashboardDocument (dashboardId,config,revision,writeKey,updatedAt) VALUES (?,?,1,?,?)').bind(id,json,randomUUID(),now),
  db.prepare("INSERT INTO ResourcePolicy (resourceType,resourceId,restricted) VALUES ('DASHBOARD',?,1)").bind(id),
  db.prepare("INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) VALUES (?,'DASHBOARD',?,'EDIT')").bind(a.user.id,id),
  db.prepare('INSERT INTO DashboardHistory (id,dashboardId,actorId,revision,name,config,createdAt) VALUES (?,?,?,1,?,?,?)').bind(randomUUID(),id,a.user.id,name,json,now),
 ];
 const viewId=listId?ids.viewId:undefined;
 if(listId&&viewId)writes.push(db.prepare(
  "INSERT INTO View (id,listId,name,type,config,position) VALUES (?,?,?,'DASHBOARD',?,(SELECT coalesce(max(position),0)+1 FROM View WHERE listId=?))",
 ).bind(viewId,listId,name,JSON.stringify({dashboardId:id}),listId));
 await db.batch(writes);
 return {id,viewId};
}
export async function dashboardRoute(req:Request,db:D1Database,a:Actor|null):Promise<Response|null>{
 const path=new URL(req.url).pathname;if(!/^\/api\/dashboards(?:\/|$)/.test(path))return null;
 try{
  if(!a)throw new AccessError(401,'Iniciá sesión.');
  const mutating=!['GET','HEAD'].includes(req.method);
  if(mutating){if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');const origin=req.headers.get('Origin');if(origin!==new URL(req.url).origin&&!(a.kind==='native'&&!origin))throw new AccessError(403,'Origen no permitido.');}
  const [, , ,id,action]=path.split('/');
  if(!id&&req.method==='GET'){
   const all=await rows<RecordRow>(db,select+' ORDER BY d.createdAt DESC');const tasks=await rows<{id:string;listId:string;type:string}>(db,'SELECT t.id,t.listId,s.type FROM Task t JOIN Status s ON s.id=t.statusId WHERE t.archived=0');
   return Response.json({admin:a.access.admin,canCreate:a.role!=='GUEST',dashboards:all.filter(d=>a.access.can('DASHBOARD',d.id)).map(d=>{const sources=JSON.parse(d.sources) as string[],ts=tasks.filter(t=>a.access.can('TASK',t.id)&&(!sources.length||sources.includes(t.listId)));return {id:d.id,name:d.name,total:ts.length,done:ts.filter(t=>['DONE','CLOSED'].includes(t.type)).length,archived:!!d.archived,canEdit:edit(a,d.id),canDelete:canDelete(a,d)};})});
  }
  if(Number(req.headers.get('Content-Length')??0)>262144)throw new AccessError(413,'Configuración demasiado grande.');
  const raw=mutating?await req.text():'';if(raw.length>262144)throw new AccessError(413,'Configuración demasiado grande.');
  let body:unknown={};try{body=raw?JSON.parse(raw):{};}catch{throw new AccessError(400,'JSON inválido.');}
  if(!id&&req.method==='POST'){
   const p=z.object({name:z.string().trim().min(1).max(100),sources:z.array(z.string()).max(200).default([]),listId:z.string().optional()}).parse(body);
   const config=emptyDashboard(p.sources);
   return Response.json(await createDashboard(db,a,p.name,config,p.listId));
  }
  if(id&&!action&&req.method==='DELETE'){
   a.access.assert('DASHBOARD',id);
   const dashboard=await db.prepare('SELECT * FROM Dashboard WHERE id=?').bind(id).first<RecordRow>();
   if(!dashboard)throw new AccessError(404,'No existe el dashboard.');
   if(!canDelete(a,dashboard))throw new AccessError(403,'Solo el creador o un administrador puede eliminar el dashboard.');
   const result=await db.batch([
    db.prepare("DELETE FROM View WHERE type='DASHBOARD' AND json_extract(CASE WHEN json_valid(config) THEN config ELSE '{}' END,'$.dashboardId')=?").bind(id),
    db.prepare("DELETE FROM ResourceGrant WHERE resourceType='DASHBOARD' AND resourceId=?").bind(id),
    db.prepare("DELETE FROM ResourcePolicy WHERE resourceType='DASHBOARD' AND resourceId=?").bind(id),
    db.prepare("INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt) SELECT ?,?,'dashboard.delete',id,? FROM Dashboard WHERE id=?").bind(randomUUID(),a.user.id,Date.now(),id),
    db.prepare('DELETE FROM Dashboard WHERE id=?').bind(id),
   ]);
   if(!result[4].meta.changes)throw new AccessError(404,'No existe el dashboard.');
   return Response.json({ok:true});
  }
  const current=await readDashboard(db,a,id);
  if(req.method==='GET'&&!action)return Response.json(current);
  if(req.method==='GET'&&action==='data')return Response.json(await dashboardDataset(db,a,current.config));
  if(req.method==='GET'&&action==='history')return Response.json({history:await rows(db,'SELECT h.revision,h.createdAt,u.name actor FROM DashboardHistory h LEFT JOIN User u ON u.id=h.actorId WHERE dashboardId=? ORDER BY revision DESC LIMIT 50',id)});
  if(action==='share'){
   if(!current.canShare)throw new AccessError(403,'Solo el creador o un administrador puede compartir el panel.');
   if(req.method==='GET')return Response.json({users:await rows(db,'SELECT u.id,u.name,u.email,m.role FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id WHERE m.workspaceId=?',a.workspaceId),grants:await rows(db,"SELECT userId,level FROM ResourceGrant WHERE resourceType='DASHBOARD' AND resourceId=?",id)});
   if(req.method==='POST'){
    const p=z.object({userId:z.string(),level:z.enum(['NONE','VIEW','EDIT'])}).parse(body);
    const target=await db.prepare('SELECT u.id FROM User u JOIN AccountAccess a ON a.userId=u.id WHERE u.id=? AND a.enabled=1').bind(p.userId).first();if(!target)throw new AccessError(400,'El usuario debe tener una cuenta habilitada.');
    const creator=await db.prepare('SELECT createdBy FROM Dashboard WHERE id=?').bind(id).first<{createdBy:string}>();if(p.userId===creator?.createdBy)throw new AccessError(400,'No se puede quitar el acceso del creador.');
    const [grant]=await db.batch([
     db.prepare("INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) SELECT ?,'DASHBOARD',id,? FROM Dashboard WHERE id=? ON CONFLICT(userId,resourceType,resourceId) DO UPDATE SET level=excluded.level").bind(p.userId,p.level,id),
     db.prepare("INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt) SELECT ?,?,'dashboard.share',?,? FROM Dashboard WHERE id=?").bind(randomUUID(),a.user.id,id+':'+p.userId,Date.now(),id),
    ]);
    if(!grant.meta.changes)throw new AccessError(404,'No existe el dashboard.');
    return Response.json({ok:true});
   }
  }
  if(req.method==='PUT'&&!action){
   if(!current.canEdit)throw new AccessError(403,'No tenés permiso para editar este dashboard.');
   const p=z.object({name:z.string().trim().min(1).max(100),config:dashboardSchema,revision:z.number().int().min(0),archived:z.boolean().optional()}).parse(body);await validateSources(a,p.config);
   const nonce=randomUUID(),now=Date.now();
   // Seed a definition for legacy summaries without replacing any existing editor state.
   if(current.revision===0)await db.prepare('INSERT OR IGNORE INTO DashboardDocument (dashboardId,config,revision,writeKey,updatedAt) VALUES (?,?,0,?,?)').bind(id,JSON.stringify(current.config),randomUUID(),now).run();
   const guard='EXISTS(SELECT 1 FROM DashboardDocument WHERE dashboardId=? AND writeKey=?)';
   const writes=[db.prepare('UPDATE DashboardDocument SET config=?,revision=revision+1,writeKey=?,updatedAt=?,archived=? WHERE dashboardId=? AND revision=?').bind(JSON.stringify(p.config),nonce,now,p.archived===undefined?+current.archived:+p.archived,id,p.revision),db.prepare('UPDATE Dashboard SET name=?,sources=? WHERE id=? AND '+guard).bind(p.name,JSON.stringify(p.config.sources),id,id,nonce),db.prepare("UPDATE View SET name=? WHERE type='DASHBOARD' AND json_extract(config,'$.dashboardId')=? AND "+guard).bind(p.name,id,id,nonce),db.prepare('INSERT INTO DashboardHistory (id,dashboardId,actorId,revision,name,config,createdAt) SELECT ?,?,?,?, ?,?,? WHERE '+guard).bind(randomUUID(),id,a.user.id,p.revision+1,p.name,JSON.stringify(p.config),now,id,nonce)];
   const result=await db.batch(writes);if(!result[0].meta.changes)throw new AccessError(409,'Otra persona guardó una versión más reciente. Conservá tu borrador, recargá el panel y aplicá los cambios sobre esa versión.');
   return Response.json({ok:true,revision:p.revision+1,updatedAt:now});
  }
  throw new AccessError(405,'Método no permitido.');
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError)return Response.json({error:e.issues.map(i=>i.message).join('; ')},{status:400});console.error('[dashboards]',e instanceof Error?e.message:'error');return Response.json({error:'No pudimos procesar el dashboard.'},{status:500});}
}
