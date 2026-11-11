import {z} from 'zod';
import {AccessError,type Actor} from './access-context';

export const presenceSchema=z.object({clientId:z.string().uuid(),visible:z.boolean(),idleMs:z.number().int().min(0).max(86400000),resources:z.array(z.object({type:z.enum(['LIST','TASK','DASHBOARD']),id:z.string().min(1).max(200)})).max(3).default([])});
export async function recordPresence(db:D1Database,a:Actor,input:z.infer<typeof presenceSchema>,now=Date.now()){
 await db.batch([
  db.prepare('INSERT INTO UserPresence(userId,clientId,sessionId,lastSeen,lastActive,visible) VALUES(?,?,?,?,?,?) ON CONFLICT(userId,clientId) DO UPDATE SET sessionId=excluded.sessionId,lastSeen=excluded.lastSeen,lastActive=max(UserPresence.lastActive,excluded.lastActive),visible=excluded.visible').bind(a.user.id,input.clientId,a.sessionId??null,now,now-input.idleMs,+input.visible),
  db.prepare('DELETE FROM UserPresence WHERE lastSeen<?').bind(now-7*86400000)
 ]);
 const denied=input.resources.filter(r=>r.type==='LIST'?!a.access.visibleList(r.id):!a.access.can(r.type,r.id));
 return {revision:a.permissionRevision,denied};
}
export async function presenceOverview(db:D1Database,workspaceId:string,now=Date.now()){
 const users=(await db.prepare('SELECT u.id,u.name,u.email,coalesce(a.enabled,0) enabled FROM User u JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? LEFT JOIN AccountAccess a ON a.userId=u.id ORDER BY u.name').bind(workspaceId).all<{id:string;name:string;email:string;enabled:number}>()).results;
 const rows=(await db.prepare('SELECT p.*,s.expiresAt FROM UserPresence p LEFT JOIN Session s ON s.id=p.sessionId').all<{userId:string;lastSeen:number;lastActive:number;visible:number;sessionId:string|null;expiresAt:string|null}>()).results;
 return {now,users:users.map(u=>{
  const all=rows.filter(r=>r.userId===u.id),recent=all.filter(r=>r.lastSeen>=now-90000&&(!r.sessionId||r.expiresAt&&Date.parse(r.expiresAt)>now));
  const lastSeen=all.length?Math.max(...all.map(r=>r.lastSeen)):null,lastActive=all.length?Math.max(...all.map(r=>r.lastActive)):null;
  const state=!u.enabled?'disabled':!all.length?'unknown':recent.some(r=>r.visible&&r.lastActive>=now-120000)?'active':recent.length?'idle':'offline';
  return {...u,state,lastSeen,lastActive};
 })};
}
export async function presenceRoute(req:Request,db:D1Database,a:Actor|null){
 const path=new URL(req.url).pathname;if(path!=='/api/presence'&&path!=='/api/team/presence')return null;
 try{
  if(!a)throw new AccessError(401,'Iniciá sesión.');
  if(a.kind==='token')throw new AccessError(403,'La presencia corresponde al uso de la web.');
  if(path==='/api/team/presence'){
   if(a.role!=='OWNER')throw new AccessError(403,'Solo el propietario/superadmin puede ver usuarios conectados.');
   if(req.method!=='GET')throw new AccessError(405,'Solo GET.');
   return Response.json(await presenceOverview(db,a.workspaceId));
  }
  if(req.method!=='POST')throw new AccessError(405,'Solo POST.');
  if(req.headers.get('Origin')!==new URL(req.url).origin)throw new AccessError(403,'Origen no permitido.');
  if(Number(req.headers.get('Content-Length')??0)>4096)throw new AccessError(413,'Solicitud demasiado grande.');
  return Response.json(await recordPresence(db,a,presenceSchema.parse(await req.json())));
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'Datos de presencia inválidos.'},{status:400});console.error('[presence]',e instanceof Error?e.name:'error');return Response.json({error:'No pudimos actualizar la presencia.'},{status:500});}
}
