import {createHash} from 'node:crypto';
import {AccessError,type Actor} from './access-context';
export async function runIdempotent<T>(db:D1Database,a:Actor,key:string|undefined,fingerprint:string,fn:()=>Promise<T>):Promise<{value:T;replayed:boolean}>{
 if(!key)return {value:await fn(),replayed:false};if(!/^[\w:.-]{1,200}$/.test(key))throw new AccessError(400,'Idempotency-Key inválida.');
 const policies=await db.batch([
 db.prepare('SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=? ORDER BY resourceType,resourceId').bind(a.user.id),
 db.prepare('SELECT resourceType,resourceId,restricted FROM ResourcePolicy ORDER BY resourceType,resourceId'),
 db.prepare("SELECT id,json_extract(CASE WHEN json_valid(config) THEN config ELSE '{}' END,'$.adminOnly') adminOnly,json_extract(CASE WHEN json_valid(config) THEN config ELSE '{}' END,'$.readerIds') readers,json_extract(CASE WHEN json_valid(config) THEN config ELSE '{}' END,'$.editorIds') editors FROM CustomField ORDER BY id")]);
 const authorization=JSON.stringify({role:a.role,scope:a.tokenScope,scopeAll:a.access.scopeAll,policies:policies.map(r=>r.results)});
 const hash=(s:string)=>createHash('sha256').update(s).digest('hex'),id=hash(a.user.id+':'+key),requestHash=hash(fingerprint+authorization);
 const reserved=await db.prepare('INSERT OR IGNORE INTO IdempotentRequest(key,userId,requestHash,expiresAt) VALUES(?,?,?,?)').bind(id,a.user.id,requestHash,Date.now()+7*86400000).run();
 if(!reserved.meta.changes){const previous=await db.prepare('SELECT requestHash,response,status,expiresAt FROM IdempotentRequest WHERE key=?').bind(id).first<{requestHash:string;response:string|null;status:number|null;expiresAt:number}>();if(previous?.requestHash!==requestHash)throw new AccessError(409,'La clave ya se utilizó con otra solicitud.');if(!previous.response||previous.expiresAt<Date.now())throw new AccessError(409,'Resultado pendiente o fuera de retención. Consultá el recurso antes de usar otra clave.');const value=JSON.parse(previous.response) as T;let result:Record<string,unknown>|null=null;try{const record=value as {body?:string};result=(record.body?JSON.parse(record.body):value) as Record<string,unknown>;}catch{/* Non-JSON errors do not contain resource content. */}
 const resultId=typeof result?.taskId==='string'?result.taskId:typeof result?.id==='string'?result.id:null;
 if(resultId){const task=await db.prepare('SELECT id FROM Task WHERE id=?').bind(resultId).first();if(task&&!a.access.can('TASK',resultId))throw new AccessError(403,'El recurso ya no está disponible con tus permisos.');}
 return {value,replayed:true};}
 // Keep uncertain results reserved rather than repeat a potentially accepted write after a crash.
 const value=await fn();await db.prepare('UPDATE IdempotentRequest SET response=?,status=200 WHERE key=?').bind(JSON.stringify(value),id).run();return {value,replayed:false};
}
export async function idempotentResponse(req:Request,db:D1Database,a:Actor,fn:()=>Promise<Response>){
 const key=req.headers.get('Idempotency-Key');if(!key||['GET','HEAD','OPTIONS'].includes(req.method))return fn();
 const result=await runIdempotent(db,a,key,req.method+' '+new URL(req.url).pathname+' '+await req.clone().text(),async()=>{const r=await fn();return {status:r.status,body:await r.text(),headers:[...r.headers]};});
 const response=new Response(result.value.body,{status:result.value.status,headers:result.value.headers});if(result.replayed)response.headers.set('X-Idempotent-Replay','true');return response;
}
