import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Access,AccessError,type Actor,type Grant,type Role} from './access-context';
import {resourceGraph} from './team-service';
export const ruleSchema=z.object({listId:z.string().min(1),name:z.string().trim().min(1).max(100),enabled:z.boolean().default(false),revision:z.number().int().positive().optional(),config:z.object({trigger:z.enum(['status_changed','overdue','inactive']),statusId:z.string().optional(),days:z.number().int().min(1).max(365).default(7),action:z.enum(['notify','assign','set_status']),targetId:z.string().optional(),message:z.string().trim().min(1).max(500).default('Revisar seguimiento de esta tarea.'),simulation:z.boolean().default(true)})});
export async function activeServiceActor(db:D1Database,userId:string):Promise<Actor|null>{
 const account=await db.prepare('SELECT u.id,u.email,u.name,u.color,u.avatarUrl,m.workspaceId,m.role,a.scopeAll FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id WHERE u.id=?').bind(userId).first<Actor['user']&{workspaceId:string;role:Role;scopeAll:number}>();if(!account)return null;
 const [g,p]=await db.batch([db.prepare('SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=?').bind(userId),db.prepare('SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1')]);
 return {user:{id:account.id,email:account.email,name:account.name,color:account.color,avatarUrl:account.avatarUrl},workspaceId:account.workspaceId,role:account.role,kind:'native',channel:'api',access:new Access(account.role,!!account.scopeAll,await resourceGraph(db),g.results as Grant[],(p.results as {resourceType:string;resourceId:string}[]).map(r=>r.resourceType+':'+r.resourceId))};
}
export async function runReminders(db:D1Database,now=Date.now()){
 const due=(await db.prepare('SELECT * FROM Reminder WHERE cancelled=0 AND deliveredAt IS NULL AND dueAt<=? ORDER BY dueAt LIMIT 100').bind(now).all<{id:string;taskId:string;userId:string;dueAt:number;body:string}>()).results;let delivered=0;
 for(const r of due){const a=await activeServiceActor(db,r.userId);if(!a?.access.can('TASK',r.taskId)){await db.prepare('UPDATE Reminder SET cancelled=1 WHERE id=?').bind(r.id).run();continue;}
 const id='reminder:'+r.id+':'+r.dueAt;
 const result=await db.batch([db.prepare("INSERT OR IGNORE INTO Notification(id,userId,taskId,type,body,read,createdAt) SELECT ?,?,?,'reminder',?,0,? WHERE EXISTS(SELECT 1 FROM Reminder WHERE id=? AND dueAt=? AND deliveredAt IS NULL AND cancelled=0)").bind(id,r.userId,r.taskId,r.body,new Date(now).toISOString(),r.id,r.dueAt),db.prepare('UPDATE Reminder SET deliveredAt=? WHERE id=? AND dueAt=? AND deliveredAt IS NULL AND cancelled=0').bind(now,r.id,r.dueAt)]);delivered+=result[0].meta.changes;
 }return {delivered};
}
export async function runRules(db:D1Database,now=Date.now(),onlyRule?:string){
 const rules=(await db.prepare('SELECT * FROM AutomationRule WHERE enabled=1'+(onlyRule?' AND id=?':'')+' ORDER BY createdAt LIMIT 100').bind(...(onlyRule?[onlyRule]:[])).all<{id:string;listId:string;createdBy:string;revision:number;config:string}>()).results;
 const stats={executed:0,simulated:0,failed:0,skipped:0};
 for(const r of rules){const a=await activeServiceActor(db,r.createdBy);if(!a||a.role==='GUEST'||!a.access.can('LIST',r.listId,'EDIT'))continue;const config=ruleSchema.shape.config.parse(JSON.parse(r.config));
 const tasks=(await db.prepare(`SELECT t.id,t.name,t.statusId,t.updatedAt,t.dueDate,s.type,coalesce((SELECT max(id) FROM StageTransition h WHERE h.taskId=t.id AND h.baseline=0 AND h.fieldId='__status__'),0) transitionId FROM Task t JOIN Status s ON s.id=t.statusId WHERE t.listId=? AND t.archived=0 AND NOT EXISTS(SELECT 1 FROM TrashEntity e WHERE e.kind='TASK' AND e.entityId=t.id) LIMIT 1000`).bind(r.listId).all<{id:string;name:string;statusId:string;updatedAt:string;dueDate:string|null;type:string;transitionId:number}>()).results;
 for(const t of tasks){if(!a.access.can('TASK',t.id,'EDIT'))continue;let event='';
 if(config.trigger==='status_changed'){if(!t.transitionId||config.statusId&&t.statusId!==config.statusId)continue;event='transition:'+t.transitionId;}
 else if(config.trigger==='overdue'){if(!t.dueDate||new Date(t.dueDate).getTime()>=now||['DONE','CLOSED'].includes(t.type))continue;event='due:'+t.dueDate;}
 else{if(['DONE','CLOSED'].includes(t.type)||new Date(t.updatedAt).getTime()>now-config.days*86400000)continue;event='inactive:'+t.updatedAt;}
 const eventKey=[r.id,r.revision,config.simulation?'simulation':'live',t.id,event].join(':'),runId=randomUUID();
 const prior=await db.prepare('SELECT status,attempts FROM AutomationRun WHERE eventKey=?').bind(eventKey).first<{status:string;attempts:number}>();if(prior&&(prior.status!=='failed'||prior.attempts>=3)){stats.skipped++;continue;}
 const guard='EXISTS(SELECT 1 FROM AutomationRun WHERE id=? AND status=\'running\')';
 const writes=[db.prepare("INSERT INTO AutomationRun(id,ruleId,taskId,eventKey,status,createdAt,attempts) VALUES(?,?,?,?,'running',?,1) ON CONFLICT(eventKey) DO UPDATE SET id=excluded.id,status='running',attempts=AutomationRun.attempts+1,createdAt=excluded.createdAt WHERE AutomationRun.status='failed' AND AutomationRun.attempts<3").bind(runId,r.id,t.id,eventKey,now)];
 try{
 if(!config.simulation){
 if(config.action==='notify'){
 const recipients=(await db.prepare('SELECT userId FROM TaskAssignee WHERE taskId=?').bind(t.id).all<{userId:string}>()).results;
 for(const recipient of recipients){const target=await activeServiceActor(db,recipient.userId);if(target?.access.can('TASK',t.id))writes.push(db.prepare(`INSERT OR IGNORE INTO Notification(id,userId,actorId,taskId,type,body,read,createdAt) SELECT ?,?,?,?,'automation',?,0,? WHERE ${guard}`).bind(runId+':'+recipient.userId,recipient.userId,a.user.id,t.id,config.message,new Date(now).toISOString(),runId));}
 }else if(config.action==='assign'){
 if(!config.targetId||!await activeServiceActor(db,config.targetId))throw new AccessError(400,'Responsable deshabilitado.');
 writes.push(db.prepare(`INSERT OR IGNORE INTO TaskAssignee(taskId,userId) SELECT ?,? WHERE ${guard}`).bind(t.id,config.targetId,runId));
 }else{
 const status=await db.prepare('SELECT listId FROM Status WHERE id=?').bind(config.targetId??'').first<{listId:string}>();if(status?.listId!==r.listId)throw new AccessError(400,'Estado destino inválido.');
 writes.push(db.prepare(`UPDATE Task SET statusId=?,updatedAt=?,completedAt=CASE WHEN (SELECT type FROM Status WHERE id=?) IN('DONE','CLOSED') THEN ? ELSE NULL END WHERE id=? AND updatedAt=? AND ${guard}`).bind(config.targetId!,new Date(now).toISOString(),config.targetId!,new Date(now).toISOString(),t.id,t.updatedAt,runId));
 }
 writes.push(db.prepare(`INSERT INTO Activity(id,taskId,userId,type,data,createdAt) SELECT ?,?,?,'automation',?,? WHERE ${guard}`).bind(randomUUID(),t.id,a.user.id,JSON.stringify({source:'api',ruleId:r.id,runId,action:config.action}),new Date(now).toISOString(),runId));
 writes.push(db.prepare(`INSERT INTO ChangeEvent(taskId,listId,actorId,createdAt) SELECT ?,?,?,? WHERE ${guard}`).bind(t.id,r.listId,a.user.id,now,runId));
 }
 writes.push(db.prepare('UPDATE AutomationRun SET status=?,detail=? WHERE id=?').bind(config.simulation?'simulated':'completed',config.simulation?'Simulación: '+config.action:config.message,runId));
 const result=await db.batch(writes);if(result[0].meta.changes){if(config.simulation)stats.simulated++;else stats.executed++;}
 }catch(e){stats.failed++;await db.prepare("INSERT INTO AutomationRun(id,ruleId,taskId,eventKey,status,detail,createdAt,attempts) VALUES(?,?,?,?,'failed',?,?,1) ON CONFLICT(eventKey) DO UPDATE SET status='failed',detail=excluded.detail,attempts=AutomationRun.attempts+1,createdAt=excluded.createdAt WHERE AutomationRun.status='failed'").bind(runId,r.id,t.id,eventKey,e instanceof Error?e.message.slice(0,500):'Error',now).run();}
 }
 }return stats;
}
export async function runScheduledWork(db:D1Database,now=Date.now()){
 const reminders=await runReminders(db,now),rules=await runRules(db,now);
 await db.prepare("INSERT INTO OperationSetting(key,value,updatedAt,updatedBy) VALUES('lastJobRun',?,?, 'scheduler') ON CONFLICT(key) DO UPDATE SET value=excluded.value,updatedAt=excluded.updatedAt").bind(JSON.stringify({reminders,rules}),now).run();return {reminders,rules};
}
