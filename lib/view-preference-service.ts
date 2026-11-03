import { AccessError,type Actor } from './access-context';
import { preferencePatchSchema,viewPreferenceSchema,type ListViewPreferences } from './view-preference-model';
import { z } from 'zod';

export async function viewPreferenceRoute(req:Request,db:D1Database,actor:Actor|null):Promise<Response|null>{
 const match=new URL(req.url).pathname.match(/^\/api\/lists\/([^/]+)\/view-preferences$/);if(!match)return null;
 try{
  if(!actor)throw new AccessError(401,'Iniciá sesión.');
  if(actor.kind==='token')throw new AccessError(403,'Las preferencias personales se gestionan desde tu sesión.');
  const listId=decodeURIComponent(match[1]);
  if(!actor.access.visibleList(listId))throw new AccessError(403,'No tenés acceso a esta lista.');
  const rows=(await db.prepare('SELECT id,type,config FROM View WHERE listId=?').bind(listId).all<{id:string;type:string;config:string|null}>()).results;
  const allowed=new Set(rows.filter(v=>{if(v.type!=='DASHBOARD')return true;try{return actor.access.can('DASHBOARD',JSON.parse(v.config??'{}').dashboardId);}catch{return false;}}).map(v=>v.id));
  if(req.method==='GET'){
   const result=(await db.prepare('SELECT p.viewId,p.state FROM UserViewPreference p JOIN View v ON v.id=p.viewId WHERE p.userId=? AND v.listId=?').bind(actor.user.id,listId).all<{viewId:string;state:string}>()).results;
   const selected=await db.prepare('SELECT activeViewId FROM UserListPreference WHERE userId=? AND listId=?').bind(actor.user.id,listId).first<{activeViewId:string|null}>();
   const data:ListViewPreferences={activeViewId:selected?.activeViewId&&allowed.has(selected.activeViewId)?selected.activeViewId:null,views:Object.fromEntries([...allowed].map(id=>[id,{}]))};
   for(const row of result)if(allowed.has(row.viewId)){const parsed=viewPreferenceSchema.safeParse(JSON.parse(row.state));if(parsed.success)data.views[row.viewId]=parsed.data;}
   return Response.json(data);
  }
  if(req.method!=='PATCH')throw new AccessError(405,'Método no permitido.');
  if(req.headers.get('Origin')!==new URL(req.url).origin&&!(actor.kind==='native'&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
  if(Number(req.headers.get('Content-Length')??0)>65536)throw new AccessError(413,'Preferencias demasiado grandes.');
  const raw=await req.text();if(raw.length>65536)throw new AccessError(413,'Preferencias demasiado grandes.');
  let input:unknown;try{input=JSON.parse(raw);}catch{throw new AccessError(400,'JSON inválido.');}
  const patch=preferencePatchSchema.parse(input);
  for(const id of [...Object.keys(patch.views),...(patch.activeViewId?[patch.activeViewId]:[])])if(!allowed.has(id))throw new AccessError(403,'La vista no pertenece a esta lista o no está disponible.');
  const writes=Object.entries(patch.views).map(([viewId,state])=>db.prepare('INSERT INTO UserViewPreference (userId,viewId,state,updatedAt) VALUES (?,?,?,?) ON CONFLICT(userId,viewId) DO UPDATE SET state=json_patch(UserViewPreference.state,excluded.state),updatedAt=excluded.updatedAt WHERE length(json_patch(UserViewPreference.state,excluded.state))<=65536').bind(actor.user.id,viewId,JSON.stringify(state),Date.now()));
  if(patch.activeViewId)writes.push(db.prepare('INSERT INTO UserListPreference (userId,listId,activeViewId,updatedAt) VALUES (?,?,?,?) ON CONFLICT(userId,listId) DO UPDATE SET activeViewId=excluded.activeViewId,updatedAt=excluded.updatedAt').bind(actor.user.id,listId,patch.activeViewId,Date.now()));
  if(writes.length){const results=await db.batch(writes);if(results.some(r=>!r.meta.changes))throw new AccessError(413,'Se alcanzó el límite de preferencias de una vista.');}
  return Response.json({ok:true});
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError)return Response.json({error:'Preferencias inválidas.'},{status:400});console.error('[view-preferences]',e instanceof Error?e.message:'error');return Response.json({error:'No pudimos guardar tus preferencias.'},{status:500});}
}
