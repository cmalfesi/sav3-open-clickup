import {randomUUID,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {ruleSchema,runRules,runScheduledWork} from './automation-service';
import {canReadField} from './field-runtime';
import {csvResponse} from './csv';
export async function workflowRoute(req:Request,db:D1Database,a:Actor|null,jobSecret?:string):Promise<Response|null>{
 const u=new URL(req.url),path=u.pathname;
 if(!/^\/api\/(workflows|reminders|jobs|historical)(\/|$)/.test(path)&&path!=='/api/notifications/snooze')return null;
 try{
 if(path==='/api/jobs/run'){
 if(req.method!=='POST')throw new AccessError(405,'Solo POST.');
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'')??'';
 const service=!!jobSecret&&token.length===jobSecret.length&&timingSafeEqual(Buffer.from(token),Buffer.from(jobSecret));
 if(!service&&(!a?.access.admin||a.kind==='token'))throw new AccessError(403,'Acceso de scheduler requerido.');
 if(!service&&req.headers.get('Origin')!==u.origin&&a?.kind!=='native')throw new AccessError(403,'Origen no permitido.');
 return Response.json(await runScheduledWork(db));
 }
 if(!a)throw new AccessError(401,'Iniciá sesión.');
 const mutation=!['GET','HEAD'].includes(req.method);
 if(mutation){if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');if(req.headers.get('Origin')!==u.origin&&!(['native','token'].includes(a.kind)&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');}
 if(path==='/api/notifications/snooze'&&req.method==='POST'){
 const p=z.object({id:z.string(),dueAt:z.number().int().min(Date.now()).max(Date.now()+365*86400000)}).parse(await req.json());
 const n=await db.prepare('SELECT taskId,body FROM Notification WHERE id=? AND userId=?').bind(p.id,a.user.id).first<{taskId:string|null;body:string}>();if(!n?.taskId)throw new AccessError(404,'Aviso no disponible.');a.access.assert('TASK',n.taskId);
 await db.batch([db.prepare('UPDATE Notification SET read=1 WHERE id=? AND userId=?').bind(p.id,a.user.id),db.prepare('INSERT INTO Reminder(id,taskId,userId,dueAt,body) VALUES(?,?,?,?,?)').bind(randomUUID(),n.taskId,a.user.id,p.dueAt,n.body)]);return Response.json({ok:true});
 }
 if(path==='/api/reminders'){
 if(req.method==='GET')return Response.json({items:(await db.prepare('SELECT r.*,t.name,t.listId FROM Reminder r JOIN Task t ON t.id=r.taskId WHERE r.userId=? AND r.cancelled=0 ORDER BY r.dueAt').bind(a.user.id).all()).results.filter(r=>a.access.can('TASK',String(r.taskId)))});
 if(req.method==='POST'){const p=z.object({taskId:z.string(),dueAt:z.number().int().min(Date.now()).max(Date.now()+365*86400000),body:z.string().trim().min(1).max(500)}).parse(await req.json());a.access.assert('TASK',p.taskId);const id=randomUUID();await db.prepare('INSERT INTO Reminder(id,taskId,userId,dueAt,body) VALUES(?,?,?,?,?)').bind(id,p.taskId,a.user.id,p.dueAt,p.body).run();return Response.json({id});}
 if(req.method==='DELETE'){const {id}=z.object({id:z.string()}).parse(await req.json());await db.prepare('UPDATE Reminder SET cancelled=1 WHERE id=? AND userId=?').bind(id,a.user.id).run();return Response.json({ok:true});}
 }
 if(path==='/api/workflows/status'&&req.method==='GET')return Response.json({lastRun:await db.prepare("SELECT updatedAt,value FROM OperationSetting WHERE key='lastJobRun'").first(),serviceEndpointConfigured:!!jobSecret});
 if(path==='/api/workflows'&&req.method==='GET'){
 const items=(await db.prepare('SELECT * FROM AutomationRule ORDER BY createdAt DESC').all()).results.filter(r=>a.access.can('LIST',String(r.listId),'EDIT')&&(a.access.admin||r.createdBy===a.user.id));return Response.json({items:items.map(r=>({...r,config:JSON.parse(String(r.config))}))});
 }
 if(path==='/api/workflows'&&req.method==='POST'){
 const raw=await req.json(),p=ruleSchema.parse(raw),id=z.object({id:z.string().optional()}).parse(raw).id??randomUUID();a.access.assert('LIST',p.listId,'EDIT');
 if(p.config.targetId&&p.config.action==='set_status'){const s=await db.prepare('SELECT listId FROM Status WHERE id=?').bind(p.config.targetId).first<{listId:string}>();if(s?.listId!==p.listId)throw new AccessError(400,'Estado destino de otra lista.');}
 const previous=await db.prepare('SELECT createdBy,listId,revision FROM AutomationRule WHERE id=?').bind(id).first<{createdBy:string;listId:string;revision:number}>();
 if(previous&&(previous.listId!==p.listId||!a.access.admin&&previous.createdBy!==a.user.id))throw new AccessError(403,'No podés editar esta regla.');
 if(previous&&p.revision!==previous.revision)throw new AccessError(409,'Otra sesión modificó la regla.');
 const write=previous?db.prepare('UPDATE AutomationRule SET name=?,config=?,enabled=?,revision=revision+1 WHERE id=? AND revision=?').bind(p.name,JSON.stringify(p.config),+p.enabled,id,p.revision!):db.prepare('INSERT INTO AutomationRule(id,listId,createdBy,name,config,enabled,createdAt) VALUES(?,?,?,?,?,?,?)').bind(id,p.listId,a.user.id,p.name,JSON.stringify(p.config),+p.enabled,Date.now());
 const result=await db.batch([write,db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'automation.configure',?,?)").bind(randomUUID(),a.user.id,id,Date.now())]);if(!result[0].meta.changes)throw new AccessError(409,'La regla cambió.');return Response.json({id});
 }
 if(path==='/api/workflows/run'&&req.method==='POST'){
 const p=z.object({id:z.string()}).parse(await req.json());const r=await db.prepare('SELECT listId,createdBy FROM AutomationRule WHERE id=?').bind(p.id).first<{listId:string;createdBy:string}>();if(!r)throw new AccessError(404,'Regla inexistente.');a.access.assert('LIST',r.listId,'EDIT');if(!a.access.admin&&r.createdBy!==a.user.id)throw new AccessError(403,'Regla de otra persona.');return Response.json(await runRules(db,Date.now(),p.id));
 }
 if(path==='/api/workflows/runs'&&req.method==='GET'){
 const items=(await db.prepare('SELECT x.*,r.name,r.listId,r.createdBy FROM AutomationRun x JOIN AutomationRule r ON r.id=x.ruleId ORDER BY x.createdAt DESC LIMIT 1000').all()).results.filter(r=>a.access.can('TASK',String(r.taskId))&&a.access.can('LIST',String(r.listId),'EDIT')&&(a.access.admin||r.createdBy===a.user.id));return Response.json({items:items.slice(0,100)});
 }
 if(path==='/api/historical'&&req.method==='GET')return historicalResponse(db,a,u);
 throw new AccessError(405,'Método no permitido.');
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'Revisá los datos de la solicitud.'},{status:400});console.error('[workflows]',e instanceof Error?e.message:'error');return Response.json({error:'No pudimos completar la operación.'},{status:500});}
}
async function historicalResponse(db:D1Database,a:Actor,u:URL){
 const listId=u.searchParams.get('listId');if(!listId||!a.access.visibleList(listId))throw new AccessError(403,'Lista no disponible.');
 const parse=(s:string|null,defaultValue:number)=>{if(!s)return defaultValue;const n=Date.parse(s);if(!Number.isFinite(n))throw new AccessError(400,'Fecha inválida.');return n;};
 const fieldId=u.searchParams.get('fieldId')??'__status__';
 if(fieldId!=='__status__'){const field=await db.prepare('SELECT config FROM CustomField WHERE id=?').bind(fieldId).first<{config:string|null}>();if(!field||!canReadField(a,field.config))throw new AccessError(403,'Campo no disponible.');}
 const from=parse(u.searchParams.get('from'),0),to=parse(u.searchParams.get('to'),Date.now()),startId=u.searchParams.get('startId'),endId=u.searchParams.get('endId');if(from>to)throw new AccessError(400,'Rango de fechas inválido.');
 const rows=(await db.prepare('SELECT h.*,t.name,coalesce(o.label,s.name) stage FROM StageTransition h JOIN Task t ON t.id=h.taskId LEFT JOIN Status s ON s.id=h.toId LEFT JOIN CustomFieldOption o ON o.id=h.toId AND o.customFieldId=h.fieldId WHERE h.listId=? AND h.fieldId=? AND h.occurredAt<=? ORDER BY h.taskId,h.occurredAt,h.id').bind(listId,fieldId,to).all<{id:number;taskId:string;name:string;stage:string|null;toId:string;fromId:string|null;occurredAt:number;baseline:number}>()).results.filter(r=>a.access.can('TASK',r.taskId));
 const grouped=new Map<string,typeof rows>();for(const r of rows){const all=grouped.get(r.taskId)??[];all.push(r);grouped.set(r.taskId,all);}
 const durations:Record<string,{stage:string;closedHours:number[];open:number;baseline:number}>={},cohort:string[]=[],converted:string[]=[];
 for(const [taskId,events]of grouped){let entry:number|undefined;for(let i=0;i<events.length;i++){const r=events[i],next=events[i+1],d=durations[r.toId]??{stage:r.stage??r.toId,closedHours:[],open:0,baseline:0};durations[r.toId]=d;
 if(r.occurredAt>=from){if(r.baseline)d.baseline++;else if(next)d.closedHours.push((next.occurredAt-r.occurredAt)/3600000);else d.open++;}
 if(!r.baseline&&r.toId===startId&&r.occurredAt>=from&&entry===undefined){entry=r.occurredAt;cohort.push(taskId);}if(entry!==undefined&&r.toId===endId&&r.occurredAt>=entry&&!converted.includes(taskId))converted.push(taskId);
 }}
 const summary=Object.entries(durations).map(([id,d])=>{const v=d.closedHours.sort((a,b)=>a-b),n=v.length;return {id,stage:d.stage,medianHours:n?(v[Math.floor((n-1)/2)]+v[Math.ceil((n-1)/2)])/2:null,completedIntervals:n,openIntervals:d.open,baselineIntervals:d.baseline};});
 const coverage=rows.length?new Date(Math.min(...rows.map(r=>r.occurredAt))).toISOString():null;
 const events=rows.filter(r=>r.occurredAt>=from);if(u.searchParams.get('format')==='csv')return csvResponse([['Tarea','Estado','Fecha UTC','Punto inicial sin historia'],...events.map(r=>[r.name,r.stage,new Date(r.occurredAt).toISOString(),r.baseline?'Sí':'No'])],'historial-estados');
 return Response.json({coverage,from:new Date(from).toISOString(),to:new Date(to).toISOString(),summary,events:events.slice(-500),cohort:startId&&endId?{entered:cohort.length,reached:converted.length,percent:cohort.length?100*converted.length/cohort.length:null}:null,definition:'La cohorte incluye la primera entrada registrada al estado inicial dentro del período. Mide si llegó al estado final antes del corte. Excluye el punto inicial importado. Las medianas incluyen solo intervalos completos con inicio conocido.'});
}
