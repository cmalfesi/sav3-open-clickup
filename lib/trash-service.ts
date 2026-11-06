import {randomUUID} from 'node:crypto';
import {AccessError,type Actor} from './access-context';
export async function trashTasks(db:D1Database,a:Actor,ids:string[]){
 if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');
 const tasks=(await db.prepare(`WITH RECURSIVE subtree(id) AS (SELECT id FROM Task WHERE id IN(SELECT value FROM json_each(?)) UNION SELECT t.id FROM Task t JOIN subtree p ON t.parentId=p.id) SELECT t.id,t.name,t.listId,t.archived FROM Task t JOIN subtree s ON s.id=t.id`).bind(JSON.stringify(ids)).all<{id:string;name:string;listId:string;archived:number}>()).results;
 if(!tasks.length)throw new AccessError(404,'No hay tareas para eliminar.');
 tasks.forEach(t=>a.access.assert('TASK',t.id,'EDIT'));
 const batchId=randomUUID(),now=Date.now(),writes:D1PreparedStatement[]=[];
 for(const t of tasks)writes.push(db.prepare("INSERT INTO TrashEntity(id,kind,entityId,batchId,name,listId,previousArchived,deletedBy,deletedAt) VALUES(?,'TASK',?,?,?,?,?,?,?) ON CONFLICT(kind,entityId) DO NOTHING").bind(randomUUID(),t.id,batchId,t.name,t.listId,t.archived,a.user.id,now));
 writes.push(db.prepare('UPDATE Task SET archived=1 WHERE id IN(SELECT value FROM json_each(?))').bind(JSON.stringify(tasks.map(t=>t.id))),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'task.trash',?,?)").bind(randomUUID(),a.user.id,batchId,now));
 await db.batch(writes);return {ok:true,batchId,count:tasks.length};
}
export async function trashDashboard(db:D1Database,a:Actor,id:string){
 a.access.assert('DASHBOARD',id,'EDIT');if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');
 const d=await db.prepare('SELECT name,createdBy FROM Dashboard WHERE id=?').bind(id).first<{name:string;createdBy:string}>();if(!d)throw new AccessError(404,'Dashboard inexistente.');if(!a.access.admin&&d.createdBy!==a.user.id)throw new AccessError(403,'Solo el creador o un administrador.');
 await db.batch([db.prepare("INSERT INTO TrashEntity(id,kind,entityId,batchId,name,deletedBy,deletedAt) VALUES(?,'DASHBOARD',?,?,?,?,?)").bind(randomUUID(),id,id,d.name,a.user.id,Date.now()),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'dashboard.trash',?,?)").bind(randomUUID(),a.user.id,id,Date.now())]);return {ok:true};
}
export async function restoreTrash(db:D1Database,a:Actor,batchId:string){
 if(!a.access.admin||a.tokenScope==='read')throw new AccessError(403,'Solo administradores.');
 const records=(await db.prepare('SELECT * FROM TrashEntity WHERE batchId=?').bind(batchId).all<{kind:string;entityId:string;listId:string|null;previousArchived:number}>()).results;
 if(!records.length)return {ok:true,restored:0};
 const writes:D1PreparedStatement[]=[];
 for(const r of records){if(r.kind==='TASK'){if(!await db.prepare('SELECT id FROM Task WHERE id=? AND listId=?').bind(r.entityId,r.listId).first())throw new AccessError(409,'La tarea o su lista de destino ya no existe.');a.access.assert('LIST',r.listId!,'EDIT');writes.push(db.prepare('UPDATE Task SET archived=? WHERE id=?').bind(r.previousArchived,r.entityId));}else if(!await db.prepare('SELECT id FROM Dashboard WHERE id=?').bind(r.entityId).first())throw new AccessError(409,'El dashboard ya no existe.');}
 writes.push(db.prepare('DELETE FROM TrashEntity WHERE batchId=?').bind(batchId),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'trash.restore',?,?)").bind(randomUUID(),a.user.id,batchId,Date.now()));await db.batch(writes);return {ok:true,restored:records.length};
}
