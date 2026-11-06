import {createHash} from 'node:crypto';
import {AccessError} from './access-context';
// Explicit allowlist. Credentials, sessions, invitations, OAuth state and delivery secrets never leave the site.
export const backupTables=['User','Workspace','WorkspaceMember','Space','Folder','List','Status','CustomField','CustomFieldOption','CustomFieldLocation','CustomFieldRevision','Task','TaskAssignee','TaskWatcher','Tag','TaskTag','CustomFieldValue','Checklist','ChecklistItem','Comment','CommentReaction','Activity','Attachment','TimeEntry','TaskDependency','View','Favorite','TaskTemplate','TemplateMetadata','HierarchyTemplate','AccountAccess','ResourceGrant','ResourcePolicy','Dashboard','DashboardDocument','DashboardHistory','ReportSchedule','ReportDelivery','Notification','NotificationPreference','UserListPreference','UserViewPreference','AccessAudit','TrashEntity','StageTransition','Reminder','AutomationRule','AutomationRun'] as const;
type Row=Record<string,string|number|null>;
export type Backup={format:'sav3-workspace';schema:1;createdAt:string;tables:Record<string,Row[]>;checksums:Record<string,string>;files:{key:string;mime:string;data:string;checksum:string}[]};
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
function fileRecords(tables:Backup['tables']){
 const records=tables.Attachment.map(a=>({id:String(a.id),url:String(a.url),name:String(a.name),mime:String(a.mime)}));
 for(const w of tables.Workspace){const match=String(w.avatarUrl??'').match(/^\/api\/workspace\/branding\/logo\/([a-f0-9-]{36})$/);if(match)records.push({id:'workspace-brand/'+w.id+'/'+match[1],url:'/api/files/workspace-logo',name:'Logo del espacio',mime:'application/octet-stream'});}
 for(const u of tables.User)if(String(u.avatarUrl??'').startsWith('/api/avatar/'))records.push({id:'avatar_'+u.id,url:'/api/files/avatar',name:'Avatar',mime:'application/octet-stream'});
 return records;
}
export async function makeBackup(db:D1Database,bucket?:R2Bucket,staticFiles?:(path:string)=>Promise<Response>):Promise<Backup>{
 const results=await db.batch(backupTables.map(t=>db.prepare(t==='User'?'SELECT id,email,name,color,avatarUrl,createdAt FROM User':`SELECT * FROM "${t}"`)));
 const tables:Record<string,Row[]>={},checksums:Record<string,string>={},files:Backup['files']=[];
 for(let i=0;i<backupTables.length;i++){const name=backupTables[i];tables[name]=results[i].results as Row[];checksums[name]=hash(JSON.stringify(tables[name]));}
 let bytes=JSON.stringify(tables).length;if(bytes>20*1024*1024)throw new AccessError(413,'Este respaldo necesita el procedimiento de exportación por lotes.');
 for(const attachment of fileRecords(tables)){const url=String(attachment.url),key=String(attachment.id);let data:ArrayBuffer,mime=String(attachment.mime);
 if(url.startsWith('/api/files/')){const file=await bucket?.get(key);if(!file)throw new AccessError(409,'Falta el adjunto '+attachment.name+'. El respaldo no se marcó como completo.');data=await file.arrayBuffer();mime=file.httpMetadata?.contentType??mime;}
 else if(url.startsWith('/restored-files/')&&staticFiles){const r=await staticFiles(url);if(!r.ok)throw new AccessError(409,'No pudimos incluir el adjunto '+attachment.name);data=await r.arrayBuffer();}
 else throw new AccessError(409,'Adjunto no portable: '+attachment.name);
 bytes+=data.byteLength*1.4;if(bytes>24*1024*1024)throw new AccessError(413,'Los adjuntos superan 24 MB. Usá el procedimiento por lotes documentado.');
 const binary=new Uint8Array(data);files.push({key,mime,data:Buffer.from(binary).toString('base64'),checksum:hash(binary)});
 }
 return {format:'sav3-workspace',schema:1,createdAt:new Date().toISOString(),tables,checksums,files};
}
export function validateBackup(raw:unknown):Backup{
 if(!raw||typeof raw!=='object')throw new AccessError(400,'Respaldo inválido.');
 const b=raw as Backup;if(b.format!=='sav3-workspace'||b.schema!==1||!b.tables||!b.checksums||!Array.isArray(b.files))throw new AccessError(400,'Formato no compatible.');
 for(const name of Object.keys(b.tables)){if(!backupTables.includes(name as typeof backupTables[number]))throw new AccessError(400,'Tabla no admitida.');if(!Array.isArray(b.tables[name])||hash(JSON.stringify(b.tables[name]))!==b.checksums[name])throw new AccessError(400,'Checksum incorrecto en '+name);}
 for(const name of backupTables)if(!b.tables[name])throw new AccessError(400,'Tabla faltante: '+name);
 for(const file of b.files)if(hash(Buffer.from(file.data,'base64'))!==file.checksum)throw new AccessError(400,'Adjunto dañado.');
 const userColumns=new Set(['id','email','name','color','avatarUrl','createdAt']);if(b.tables.User.some(row=>Object.keys(row).some(k=>!userColumns.has(k))))throw new AccessError(400,'El respaldo no debe contener credenciales.');
 const expected=new Set(fileRecords(b.tables).map(f=>f.id));if(new Set(b.files.map(f=>f.key)).size!==b.files.length||b.files.some(f=>!expected.has(f.key)))throw new AccessError(400,'Archivos inesperados o duplicados.');
 if([...expected].some(id=>!b.files.some(f=>f.key===id)))throw new AccessError(400,'Faltan adjuntos.');
 return b;
}
/** Only targets an empty, separately provisioned database. Never overwrites production content. */
export async function restoreBackup(db:D1Database,b:Backup,bucket?:R2Bucket){
 validateBackup(b);const current=await db.prepare('SELECT count(*) n FROM Workspace').first<{n:number}>();if(current?.n)throw new AccessError(409,'La restauración requiere una base vacía en un entorno aislado.');
 const writes:D1PreparedStatement[]=[];
 for(const name of backupTables){let rows=b.tables[name];if(name==='Task'){const ordered:Row[]=[],left=[...rows],known=new Set<string>();while(left.length){const i=left.findIndex(r=>!r.parentId||known.has(String(r.parentId)));if(i<0)throw new AccessError(400,'Jerarquía de tareas inválida.');const r=left.splice(i,1)[0];ordered.push(r);known.add(String(r.id));}rows=ordered;}
 if(name==='Comment'){const ordered:Row[]=[],left=[...rows],known=new Set<string>();while(left.length){const i=left.findIndex(r=>!r.parentId||known.has(String(r.parentId)));if(i<0)throw new AccessError(400,'Comentarios inválidos.');const r=left.splice(i,1)[0];ordered.push(r);known.add(String(r.id));}rows=ordered;}
 const allowed=new Set((await db.prepare(`PRAGMA table_info("${name}")`).all<{name:string}>()).results.map(c=>c.name));
 if(name==='StageTransition')writes.push(db.prepare('DELETE FROM StageTransition'));
 for(const original of rows){const row={...original};if(name==='AccountAccess')row.enabled=0;if(name==='AutomationRule'||name==='ReportSchedule')row.enabled=0;if(name==='Reminder'){row.cancelled=1;row.deliveredAt=null;}if(name==='Attachment')row.url='/api/files/'+row.id;
 const keys=Object.keys(row);if(keys.some(k=>!allowed.has(k)))throw new AccessError(400,'Columna inválida en '+name);
 writes.push(db.prepare(`INSERT INTO "${name}"(${keys.map(k=>'"'+k+'"').join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).bind(...keys.map(k=>row[k])));}
 if(name==='Task'){writes.push(db.prepare('DELETE FROM StageTransition'));writes.push(db.prepare('DELETE FROM CustomFieldValue'));}
 }
 // Stage rows are captured above. Avoid duplicate transition rows produced by Task insert triggers.
 if(bucket&&(await bucket.list({limit:1})).objects.length)throw new AccessError(409,'La restauración requiere un bucket vacío y aislado.');
 if(b.files.length&&!bucket)throw new AccessError(503,'Falta almacenamiento de adjuntos.');
 for(const f of b.files)await bucket!.put(f.key,Buffer.from(f.data,'base64'),{httpMetadata:{contentType:f.mime}});
 // Triggers create stage/default rows; clear them after Task insertion before restoring captured values.
 await db.batch([db.prepare('PRAGMA defer_foreign_keys=ON'),...writes]);
 const integrity=await db.prepare('PRAGMA foreign_key_check').all();if(integrity.results.length)throw new AccessError(409,'Referencias inconsistentes en el entorno restaurado.');
 return {ok:true,counts:Object.fromEntries(backupTables.map(t=>[t,b.tables[t].length])),accountsEnabled:false,automationsEnabled:false};
}

/** Streams file content in bounded chunks, including existing workspaces larger than the Worker heap. */
export async function streamBackup(db:D1Database,bucket:R2Bucket|undefined,staticFiles:((path:string)=>Promise<Response>)|undefined,completed:()=>Promise<void>){
 const results=await db.batch(backupTables.map(t=>db.prepare(t==='User'?'SELECT id,email,name,color,avatarUrl,createdAt FROM User':`SELECT * FROM "${t}"`)));
 const tables:Record<string,Row[]>={},checksums:Record<string,string>={};for(let i=0;i<backupTables.length;i++){tables[backupTables[i]]=results[i].results as Row[];checksums[backupTables[i]]=hash(JSON.stringify(results[i].results));}
 const createdAt=new Date().toISOString(),encoder=new TextEncoder();
 async function* chunks(){
 yield encoder.encode(JSON.stringify({format:'sav3-workspace',schema:1,createdAt,tables,checksums}).slice(0,-1)+',"files":[');
 let first=true;
 for(const attachment of fileRecords(tables)){let body:ReadableStream<Uint8Array>|null=null;const url=String(attachment.url),key=String(attachment.id);let mime=String(attachment.mime);
 if(url.startsWith('/api/files/')){const object=await bucket?.get(key);body=object?.body??null;mime=object?.httpMetadata?.contentType??mime;}
 else if(url.startsWith('/restored-files/')&&staticFiles){const r=await staticFiles(url);if(r.ok)body=r.body;}
 if(!body)throw new AccessError(409,'Falta el adjunto '+attachment.name);
 yield encoder.encode((first?'':',')+JSON.stringify({key,mime}).slice(0,-1)+',"data":"');first=false;
 const checksum=createHash('sha256'),reader=body.getReader();let carry=Buffer.alloc(0);
 try{while(true){const part=await reader.read();if(part.done)break;checksum.update(part.value);const merged=Buffer.concat([carry,Buffer.from(part.value)]),size=merged.length-merged.length%3;if(size)yield encoder.encode(merged.subarray(0,size).toString('base64'));carry=Buffer.from(merged.subarray(size));}if(carry.length)yield encoder.encode(carry.toString('base64'));}finally{reader.releaseLock();}
 yield encoder.encode('","checksum":"'+checksum.digest('hex')+'"}');
 }
 yield encoder.encode(']}');await completed();
 }
 const iterator=chunks();return new ReadableStream<Uint8Array>({async pull(controller){try{const item=await iterator.next();if(item.done)controller.close();else controller.enqueue(item.value)}catch(e){controller.error(e)}},async cancel(){await iterator.return(undefined);}});
}
