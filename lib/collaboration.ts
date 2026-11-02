import { randomUUID } from 'node:crypto';
import { type Actor } from './access-context';
export type ChangeTarget={taskId:string|null;listId:string};
export async function changeTargets(req:Request,db:D1Database,a:Actor):Promise<ChangeTarget[]>{
 const p=new URL(req.url).pathname.split('/').filter(Boolean);
 if(['GET','HEAD','OPTIONS'].includes(req.method))return [];
 const body=await req.clone().json().catch(()=>({})) as Record<string,unknown>;
 let ids:string[]=[], listId:string|undefined;
 if(p[0]==='mcp'||(p[1]==='integrations'&&p[2]==='mcp')){
  const rpc=body as {method?:string;params?:{name?:string;arguments?:Record<string,unknown>}};
  if(rpc.method!=='tools/call'||!['create_task','update_task','add_comment'].includes(rpc.params?.name??''))return [];
  const args=rpc.params?.arguments??{};if(typeof args.task_id==='string')ids=[args.task_id];if(typeof args.list_id==='string')listId=args.list_id;
 }else if(p[0]==='api'&&p[1]==='tasks'){
  ids=p[2]==='bulk'?(Array.isArray(body.ids)?body.ids.filter((id):id is string=>typeof id==='string'):[]):p[2]?[p[2]]:[];
  if(typeof body.listId==='string')listId=body.listId;
 }else if(p[0]==='api'&&['comments','attachments','checklists','checklist-items','time-entries','dependencies'].includes(p[1])){
  const sql:Record<string,string>={comments:'SELECT taskId FROM Comment WHERE id=?',attachments:'SELECT taskId FROM Attachment WHERE id=?',checklists:'SELECT taskId FROM Checklist WHERE id=?','checklist-items':'SELECT c.taskId FROM ChecklistItem i JOIN Checklist c ON c.id=i.checklistId WHERE i.id=?','time-entries':'SELECT taskId FROM TimeEntry WHERE id=?',dependencies:'SELECT blockerId taskId FROM TaskDependency WHERE id=?'};
  if(p[2]){const row=await db.prepare(sql[p[1]]).bind(p[2]).first<{taskId:string}>();if(row)ids=[row.taskId];}
 }
 const targets=ids.flatMap(id=>{const task=a.access.resources('TASK').find(t=>t.id===id);return task?.listId?[{taskId:req.method==='DELETE'?null:id,listId:task.listId}]:[]});
 if(listId)targets.push({taskId:null,listId});return targets;
}
export async function recordChanges(db:D1Database,a:Actor,targets:ChangeTarget[],response:Response,req?:Request){
 if(!response.ok||!targets.length)return;
 const payload=await response.clone().json().catch(()=>null) as {result?:{isError?:boolean}}|null;
 if(payload?.result?.isError)return;
 if(req?.method==='POST'){
  const data=payload as {id?:string;result?:{content?:{text?:string}[]}}|null;
  let id=data?.id;
  if(new URL(req.url).pathname.endsWith('/mcp')){try{id=JSON.parse(data?.result?.content?.[0]?.text??'{}').id;}catch{}}
  if(typeof id==='string'&&new URL(req.url).pathname!=='/api/tasks/bulk'){
   const created=await db.prepare('SELECT id,listId FROM Task WHERE id=?').bind(id).first<{id:string;listId:string}>();
   if(created)targets=targets.map(t=>t.taskId===null&&t.listId===created.listId?{taskId:id!,listId:t.listId}:t);
  }
 }
 const path=req?new URL(req.url).pathname:'';
 const extraAudit=path.startsWith('/api/')&&!path.includes('/mcp')&&!/^\/api\/(tasks(?:\/[^/]+)?$|comments|notifications)/.test(path)&&!path.endsWith('/comments')&&!path.includes('/fields/');
 if(extraAudit)for(const t of targets){if(t.taskId)await db.prepare("INSERT INTO Activity (id,taskId,userId,type,data,createdAt) SELECT ?,id,?,'content_changed',?,? FROM Task WHERE id=?").bind(randomUUID(),a.user.id,JSON.stringify({source:a.channel??'web',operation:req!.method,resource:path.split('/').filter(Boolean)[1]}),new Date().toISOString(),t.taskId).run();}
 const unique=[...new Map(targets.map(t=>[(t.taskId??'')+':'+t.listId,t])).values()];
 await db.batch(unique.map(t=>db.prepare('INSERT INTO ChangeEvent (taskId,listId,actorId,clientId,createdAt) VALUES (?,?,?,?,?)').bind(t.taskId,t.listId,a.user.id,a.clientId??null,Date.now())));
}
export async function changesResponse(req:Request,db:D1Database,a:Actor){
 const u=new URL(req.url),raw=u.searchParams.get('cursor'),client=u.searchParams.get('client'),listId=u.searchParams.get('list_id');
 if(listId&&!a.access.visibleList(listId))return Response.json({error:'Sin acceso.'},{status:403});
 const latest=await db.prepare('SELECT coalesce(max(seq),0) cursor FROM ChangeEvent').first<{cursor:number}>();
 const cursor=latest?.cursor??0;
 if(raw===null)return Response.json({cursor,changed:false});
 const from=Number(raw);if(!Number.isSafeInteger(from)||from<0)return Response.json({error:'Cursor inválido.'},{status:400});
 let dashboardLists:Set<string>|undefined;
 if(u.searchParams.get('view')==='dashboards'){
  dashboardLists=new Set<string>();const rows=await db.prepare('SELECT id,sources FROM Dashboard').all<{id:string;sources:string}>();
  for(const d of rows.results){if(!a.access.can('DASHBOARD',d.id))continue;const sources=JSON.parse(d.sources) as string[];for(const l of a.access.resources('LIST'))if(!sources.length||sources.includes(l.id))dashboardLists.add(l.id);}
 }
 const events=await db.prepare('SELECT seq,taskId,listId,clientId FROM ChangeEvent WHERE seq>? AND seq<=?'+(listId?' AND listId=?':'')+' ORDER BY seq').bind(...(listId?[from,cursor,listId]:[from,cursor])).all<{seq:number;taskId:string|null;listId:string;clientId:string|null}>();
 const changed=events.results.some(e=>!(client&&e.clientId===client)&&(!dashboardLists||dashboardLists.has(e.listId))&&(e.taskId?a.access.can('TASK',e.taskId):a.access.can('LIST',e.listId)));
 return Response.json({cursor,changed});
}
