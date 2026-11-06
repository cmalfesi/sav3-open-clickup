import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {streamBackup,validateBackup} from './backup-service';
import {restoreTrash} from './trash-service';
import {csvResponse} from './csv';
export async function operationalRoute(req:Request,db:D1Database,bucket:R2Bucket|undefined,a:Actor|null,assets?:Fetcher):Promise<Response|null>{
 const u=new URL(req.url);if(!u.pathname.startsWith('/api/operations/'))return null;
 try{
 if(!a)throw new AccessError(401,'Iniciá sesión.');
 if(!a.access.admin||a.kind==='token')throw new AccessError(403,'Solo administradores desde el sitio.');
 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('Origin')!==u.origin&&!(a.kind==='native'&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
 const p=u.pathname.slice('/api/operations/'.length);
 if(p==='trash'&&req.method==='GET')return Response.json({items:(await db.prepare('SELECT batchId,kind,name,deletedAt,count(*) total FROM TrashEntity GROUP BY batchId ORDER BY deletedAt DESC').all()).results});
 if(p==='trash/restore'&&req.method==='POST'){const b=z.object({batchId:z.string().min(1)}).parse(await req.json());return Response.json(await restoreTrash(db,a,b.batchId));}
 if(p==='backup'&&req.method==='POST'){
 const completed=async()=>{await db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'backup.export',?,?)").bind(randomUUID(),a.user.id,new Date().toISOString(),Date.now()).run();};
 const stream=await streamBackup(db,bucket,assets?path=>assets.fetch(new Request(u.origin+path)):undefined,completed);
 return new Response(stream,{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="sav3-backup-${new Date().toISOString().slice(0,10)}.json"`}});
 }
 if(p==='backup/validate'&&req.method==='POST'){const raw=await req.text();if(raw.length>32*1024*1024)throw new AccessError(413,'Respaldo demasiado grande.');const b=validateBackup(JSON.parse(raw));return Response.json({ok:true,createdAt:b.createdAt,counts:Object.fromEntries(Object.entries(b.tables).map(([k,v])=>[k,v.length])),files:b.files.length,message:'Integridad comprobada. Restaurar requiere una base vacía en un entorno aislado.'});}
 if(p==='audit'&&req.method==='GET'){
 const offset=Math.max(0,Math.floor(Number(u.searchParams.get('offset')))||0),q=u.searchParams.get('q')?.slice(0,200)??'',limit=u.searchParams.get('format')==='csv'?10000:100;
 const [admin,activity]=await db.batch([db.prepare('SELECT a.id,a.actorId,u.name actor,a.action,a.targetId,a.createdAt FROM AccessAudit a LEFT JOIN User u ON u.id=a.actorId ORDER BY a.createdAt DESC'),db.prepare('SELECT a.id,a.userId actorId,u.name actor,a.type action,a.taskId targetId,a.data,a.createdAt FROM Activity a LEFT JOIN User u ON u.id=a.userId ORDER BY a.createdAt DESC')]);
 const rows=([...admin.results,...activity.results] as Record<string,unknown>[]).map((r):Record<string,unknown>&{createdAt:string}=>({...r,createdAt:typeof r.createdAt==='number'?new Date(r.createdAt).toISOString():String(r.createdAt)})).filter(r=>!q||JSON.stringify(r).toLowerCase().includes(q.toLowerCase())).sort((x,y)=>y.createdAt.localeCompare(x.createdAt));
 const items=rows.slice(offset,offset+limit);if(u.searchParams.get('format')==='csv')return csvResponse([['Fecha UTC','Usuario','Acción','Recurso','Detalle'],...items.map(r=>[r.createdAt,r.actor,r.action,r.targetId,r.data??''])],'auditoria');return Response.json({items,nextOffset:offset+limit<rows.length?offset+limit:null,total:rows.length});
 }
 throw new AccessError(405,'Operación no disponible.');
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError||e instanceof SyntaxError)return Response.json({error:'Solicitud inválida.'},{status:400});console.error('[operations]',e instanceof Error?e.message:'error');return Response.json({error:'No pudimos completar la operación.'},{status:500});}
}
