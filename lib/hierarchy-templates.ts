import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {effectiveFieldIds} from './custom-field-service';
type ListSnapshot={name:string;folder:string|null;statuses:{id:string;name:string;color:string;type:string;position:number}[];views:{name:string;type:string;config:string|null;position:number}[];fieldIds:string[]};
type Structure={spaceName:string;private:boolean;lists:ListSnapshot[];spaceFields:string[]};
export async function hierarchyTemplateRoute(req:Request,db:D1Database,a:Actor|null):Promise<Response|null>{
 const u=new URL(req.url);if(u.pathname!=='/api/hierarchy-templates'&&u.pathname!=='/api/hierarchy-templates/apply')return null;
 try{if(!a)throw new AccessError(401,'Iniciá sesión.');if(!a.access.admin||a.kind==='token')throw new AccessError(403,'Solo administradores desde el sitio.');if(req.method==='GET')return Response.json({items:(await db.prepare('SELECT id,name,kind,createdAt FROM HierarchyTemplate WHERE workspaceId=? ORDER BY createdAt DESC').bind(a.workspaceId).all()).results});
 if(req.method!=='POST'||req.headers.get('Origin')!==u.origin&&!(a.kind==='native'&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
 if(u.pathname.endsWith('/apply')){
 const p=z.object({id:z.string(),name:z.string().trim().min(1).max(100),spaceId:z.string().optional()}).parse(await req.json()),template=await db.prepare('SELECT kind,config FROM HierarchyTemplate WHERE id=? AND workspaceId=?').bind(p.id,a.workspaceId).first<{kind:string;config:string}>();if(!template)throw new AccessError(404,'Plantilla inexistente.');
 const config=JSON.parse(template.config) as Structure,writes:D1PreparedStatement[]=[],spaceId=template.kind==='SPACE'?randomUUID():p.spaceId;if(!spaceId)throw new AccessError(400,'Elegí un espacio destino.');if(template.kind==='LIST')a.access.assert('SPACE',spaceId,'EDIT');
 for(const fieldId of new Set([...config.spaceFields,...config.lists.flatMap(l=>l.fieldIds)]))if(!await db.prepare('SELECT id FROM CustomField WHERE id=?').bind(fieldId).first())throw new AccessError(409,'Un campo de la plantilla fue eliminado. Actualizá la plantilla.');
 if(template.kind==='SPACE'){writes.push(db.prepare('INSERT INTO Space(id,workspaceId,name,private,position) VALUES(?,?,?,?,?)').bind(spaceId,a.workspaceId,p.name,+config.private,Date.now()));if(config.private)writes.push(db.prepare("INSERT INTO ResourcePolicy(resourceType,resourceId,restricted) VALUES('SPACE',?,1)").bind(spaceId),db.prepare("INSERT INTO ResourceGrant(userId,resourceType,resourceId,level) VALUES(?,'SPACE',?,'EDIT')").bind(a.user.id,spaceId));for(const f of config.spaceFields)writes.push(db.prepare('INSERT OR IGNORE INTO CustomFieldLocation(customFieldId,spaceId) VALUES(?,?)').bind(f,spaceId));}
 const folders=new Map<string,string>();let firstList='';
 for(const l of config.lists){let folderId:string|null=null;if(template.kind==='SPACE'&&l.folder){folderId=folders.get(l.folder)??randomUUID();if(!folders.has(l.folder)){folders.set(l.folder,folderId);writes.push(db.prepare('INSERT INTO Folder(id,spaceId,name,position) VALUES(?,?,?,?)').bind(folderId,spaceId,l.folder,folders.size));}}
 const listId=randomUUID();firstList||=listId;writes.push(db.prepare('INSERT INTO List(id,spaceId,folderId,name,position) VALUES(?,?,?,?,?)').bind(listId,spaceId,folderId,template.kind==='LIST'?p.name:l.name,Date.now()));const statusIds=new Map(l.statuses.map(s=>[s.id,randomUUID()]));
 for(const s of l.statuses)writes.push(db.prepare('INSERT INTO Status(id,listId,name,color,type,position) VALUES(?,?,?,?,?,?)').bind(statusIds.get(s.id)!,listId,s.name,s.color,s.type,s.position));
 const remap=(v:unknown):unknown=>typeof v==='string'?statusIds.get(v)??v:Array.isArray(v)?v.map(remap):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,value])=>[k,remap(value)])):v;
 for(const v of l.views)writes.push(db.prepare('INSERT INTO View(id,listId,name,type,config,position) VALUES(?,?,?,?,?,?)').bind(randomUUID(),listId,v.name,v.type,JSON.stringify(remap(JSON.parse(v.config??'{}'))),v.position));
 for(const f of l.fieldIds)writes.push(db.prepare('INSERT OR IGNORE INTO CustomFieldLocation(customFieldId,listId) VALUES(?,?)').bind(f,listId));
 }
 writes.push(db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'template.apply-structure',?,?)").bind(randomUUID(),a.user.id,spaceId,Date.now()));await db.batch(writes);return Response.json({spaceId,listId:firstList,lists:config.lists.length});
 }
 const p=z.object({name:z.string().trim().min(1).max(100),kind:z.enum(['LIST','SPACE']),sourceId:z.string()}).parse(await req.json());a.access.assert(p.kind,p.sourceId,'EDIT');
 const lists=(await db.prepare('SELECT l.id,l.name,f.name folder,l.spaceId FROM List l LEFT JOIN Folder f ON f.id=l.folderId WHERE '+(p.kind==='LIST'?'l.id=?':'l.spaceId=?')+' ORDER BY l.position').bind(p.sourceId).all<{id:string;name:string;folder:string|null;spaceId:string}>()).results;
 const spaceId=p.kind==='SPACE'?p.sourceId:lists[0]?.spaceId,space=spaceId?await db.prepare('SELECT name,private FROM Space WHERE id=?').bind(spaceId).first<{name:string;private:number}>():null;if(!space)throw new AccessError(404,'Ubicación inexistente.');
 const snapshots:ListSnapshot[]=[];
 for(const l of lists){const [statuses,views]=await db.batch([db.prepare('SELECT id,name,color,type,position FROM Status WHERE listId=? ORDER BY position').bind(l.id),db.prepare("SELECT name,type,config,position FROM View WHERE listId=? AND type<>'DASHBOARD' ORDER BY position").bind(l.id)]);snapshots.push({name:l.name,folder:l.folder,statuses:statuses.results as ListSnapshot['statuses'],views:views.results as ListSnapshot['views'],fieldIds:await effectiveFieldIds(db,l.id)});}
 const fields=(await db.prepare('SELECT customFieldId FROM CustomFieldLocation WHERE spaceId=?').bind(spaceId).all<{customFieldId:string}>()).results;
 const id=randomUUID(),config:Structure={spaceName:space.name,private:!!space.private,lists:snapshots,spaceFields:fields.map(f=>f.customFieldId)};
 await db.prepare('INSERT INTO HierarchyTemplate(id,workspaceId,name,kind,config,createdBy,createdAt) VALUES(?,?,?,?,?,?,?)').bind(id,a.workspaceId,p.name,p.kind,JSON.stringify(config),a.user.id,Date.now()).run();return Response.json({id});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:'No pudimos guardar o aplicar la plantilla.'},{status:e instanceof AccessError?e.status:400});}
}
