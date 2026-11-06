import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {activeServiceActor} from './automation-service';
export function publicWebhookUrl(raw:string){
 const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||!u.hostname.includes('.')||/^[\d.]+$/.test(u.hostname)||/[\[\]:]/.test(u.hostname)||/(^|\.)(localhost|local|internal|test|example|invalid)$/.test(u.hostname))throw new AccessError(400,'Usá un dominio público HTTPS sin credenciales.');return u;
}
export function webhookSignature(secret:string,timestamp:string,payload:string){return createHmac('sha256',secret).update(timestamp+'.'+payload).digest('hex');}
async function checkPublicDns(host:string){
 for(const type of ['A','AAAA']){const r=await fetch('https://cloudflare-dns.com/dns-query?'+new URLSearchParams({name:host,type}),{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error('No pudimos verificar el destino.');const d=await r.json() as {Answer?:{type:number;data:string}[]};for(const a of d.Answer??[]){if(a.type===1){const [x,y]=a.data.split('.').map(Number);if(x===0||x===10||x===127||x===169&&y===254||x===172&&y>=16&&y<=31||x===192&&y===168||x===100&&y>=64&&y<=127||x>=224)throw new Error('El destino resuelve a una red privada.');}if(a.type===28&&(/^(::|fc|fd|fe8|fe9|fea|feb)/i.test(a.data)||a.data.includes('.')))throw new Error('Dirección IPv6 no permitida.');}}
}
export async function deliverWebhooks(db:D1Database,now=Date.now()){
 const due=(await db.prepare("SELECT id FROM WebhookDelivery WHERE attempts<5 AND ((status='pending' AND nextAt<=?) OR(status='sending' AND lockedUntil<?)) ORDER BY nextAt LIMIT 30").bind(now,now).all<{id:string}>()).results;let sent=0,failed=0;
 for(const d of due){const delivery=await db.prepare("UPDATE WebhookDelivery SET status='sending',attempts=attempts+1,lockedUntil=? WHERE id=? AND attempts<5 AND ((status='pending' AND nextAt<=?) OR(status='sending' AND lockedUntil<?)) RETURNING endpointId,payload,attempts").bind(now+60000,d.id,now,now).first<{endpointId:string;payload:string;attempts:number}>();if(!delivery)continue;
 const endpoint=await db.prepare('SELECT * FROM WebhookEndpoint WHERE id=? AND enabled=1').bind(delivery.endpointId).first<{createdBy:string;listId:string;url:string;secret:string}>();const a=endpoint?await activeServiceActor(db,endpoint.createdBy):null;const payload=JSON.parse(delivery.payload) as {taskId:string|null};
 if(!endpoint||!a?.access.can('LIST',endpoint.listId,'EDIT')||payload.taskId&&!a.access.can('TASK',payload.taskId)){await db.prepare("UPDATE WebhookDelivery SET status='cancelled',detail='Permiso revocado o destino deshabilitado.' WHERE id=?").bind(d.id).run();continue;}
 try{const url=publicWebhookUrl(endpoint.url);await checkPublicDns(url.hostname);const ts=String(Math.floor(now/1000)),r=await fetch(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','X-SAV3-Event-ID':d.id,'X-SAV3-Timestamp':ts,'X-SAV3-Signature':'sha256='+webhookSignature(endpoint.secret,ts,delivery.payload)},body:delivery.payload,signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error('HTTP '+r.status);await db.prepare("UPDATE WebhookDelivery SET status='delivered',detail=NULL WHERE id=?").bind(d.id).run();sent++;}
 catch(e){failed++;await db.prepare('UPDATE WebhookDelivery SET status=?,nextAt=?,detail=? WHERE id=?').bind(delivery.attempts>=5?'failed':'pending',now+Math.min(86400000,60000*2**delivery.attempts),e instanceof Error?e.message.slice(0,200):'Fallo de entrega',d.id).run();}
 }return {sent,failed};
}
export async function webhookRoute(req:Request,db:D1Database,a:Actor|null):Promise<Response|null>{
 const u=new URL(req.url);if(!['/api/integrations/webhooks','/api/integrations/webhook-deliveries'].includes(u.pathname))return null;
 try{if(!a)throw new AccessError(401,'Iniciá sesión.');if(!a.access.admin||a.kind==='token')throw new AccessError(403,'Solo administradores desde el sitio.');
 if(req.method==='GET')return Response.json({items:(await db.prepare(u.pathname.endsWith('webhook-deliveries')?'SELECT id,endpointId,attempts,status,nextAt,detail FROM WebhookDelivery ORDER BY nextAt DESC LIMIT 100':'SELECT id,listId,url,enabled,createdAt FROM WebhookEndpoint ORDER BY createdAt DESC').all()).results});
 if(req.headers.get('Origin')!==u.origin&&!(a.kind==='native'&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
 if(req.method==='DELETE'){const p=z.object({id:z.string()}).parse(await req.json());await db.prepare('UPDATE WebhookEndpoint SET enabled=0 WHERE id=?').bind(p.id).run();return Response.json({ok:true});}
 if(req.method!=='POST')throw new AccessError(405,'Método no permitido.');const p=z.object({listId:z.string(),url:z.string().max(2048)}).parse(await req.json());a.access.assert('LIST',p.listId,'EDIT');const url=publicWebhookUrl(p.url),id=randomUUID(),secret=randomBytes(32).toString('hex');await checkPublicDns(url.hostname);
 await db.batch([db.prepare('INSERT INTO WebhookEndpoint(id,createdBy,listId,url,secret,createdAt) VALUES(?,?,?,?,?,?)').bind(id,a.user.id,p.listId,url.href,secret,Date.now()),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'webhook.create',?,?)").bind(randomUUID(),a.user.id,id,Date.now())]);return Response.json({id,secret});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:e instanceof Error?e.message:'Destino inválido.'},{status:e instanceof AccessError?e.status:400});}
}
