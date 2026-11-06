import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {activeServiceActor} from './automation-service';
import {readDashboard,dashboardDataset} from './dashboard-service';
import {calculateCard} from './dashboard-model';
import {mailReady,sendTransactionalMail,type MailEnvironment} from './mail-service';
export async function runReports(db:D1Database,env:MailEnvironment,now=Date.now()){
 if(!mailReady(env))return {sent:0,blocked:'mail_not_configured'};
 const rows=(await db.prepare('SELECT * FROM ReportSchedule WHERE enabled=1 LIMIT 100').all<{id:string;userId:string;dashboardId:string;frequency:string;hour:number;timezone:string}>()).results;let sent=0;
 for(const s of rows){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(now),get=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 if(Number(get('hour'))<s.hour||s.frequency==='weekly'&&get('weekday')!=='Mon')continue;const slot=[get('year'),get('month'),get('day')].join('-');const prior=await db.prepare('SELECT status,attempts FROM ReportDelivery WHERE scheduleId=? AND slot=?').bind(s.id,slot).first<{status:string;attempts:number}>();if(prior?.status==='sent'||(prior?.attempts??0)>=3)continue;
 const a=await activeServiceActor(db,s.userId);if(!a?.access.can('DASHBOARD',s.dashboardId))continue;
 const dashboard=await readDashboard(db,a,s.dashboardId),data=await dashboardDataset(db,a,dashboard.config);
 const text=dashboard.name+'\nCorte UTC: '+data.refreshedAt+'\n\n'+dashboard.config.cards.map(c=>{const result=calculateCard(dashboard.config,c,data);return c.title+': '+(result.value??'Sin datos')+' ('+result.count+' tareas)'+(result.rows.length?'\n'+result.rows.map(r=>'  '+r.name+': '+(r.value??'Sin datos')).join('\n'):'');}).join('\n\n');
 const delivery=await sendTransactionalMail(env,a.user.email,'Reporte · '+dashboard.name,text,'report:'+s.id+':'+slot);
 await db.prepare('INSERT INTO ReportDelivery(id,scheduleId,slot,status,attempts,updatedAt) VALUES(?,?,?,?,1,?) ON CONFLICT(scheduleId,slot) DO UPDATE SET status=excluded.status,attempts=ReportDelivery.attempts+1,updatedAt=excluded.updatedAt').bind(randomUUID(),s.id,slot,delivery.sent?'sent':'failed',now).run();if(delivery.sent)sent++;
 }return {sent};
}
export async function reportScheduleRoute(req:Request,db:D1Database,a:Actor|null,env:MailEnvironment):Promise<Response|null>{
 const u=new URL(req.url);if(u.pathname!=='/api/report-schedules')return null;
 try{if(!a)throw new AccessError(401,'Iniciá sesión.');if(req.method==='GET')return Response.json({emailReady:mailReady(env),items:(await db.prepare('SELECT s.*,d.name FROM ReportSchedule s JOIN Dashboard d ON d.id=s.dashboardId WHERE s.userId=?').bind(a.user.id).all()).results.filter(s=>a.access.can('DASHBOARD',String(s.dashboardId)))});
 if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');if(req.headers.get('Origin')!==u.origin&&!(a.kind==='native'&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
 if(req.method==='DELETE'){const p=z.object({id:z.string()}).parse(await req.json());await db.prepare('DELETE FROM ReportSchedule WHERE id=? AND userId=?').bind(p.id,a.user.id).run();return Response.json({ok:true});}
 if(req.method!=='POST')throw new AccessError(405,'Método no permitido.');const p=z.object({dashboardId:z.string(),frequency:z.enum(['daily','weekly']),hour:z.number().int().min(0).max(23),timezone:z.string().max(100)}).parse(await req.json());a.access.assert('DASHBOARD',p.dashboardId);try{new Intl.DateTimeFormat('en',{timeZone:p.timezone}).format();}catch{throw new AccessError(400,'Zona horaria inválida.');}
 const id=randomUUID();await db.prepare('INSERT INTO ReportSchedule(id,userId,dashboardId,frequency,hour,timezone) VALUES(?,?,?,?,?,?)').bind(id,a.user.id,p.dashboardId,p.frequency,p.hour,p.timezone).run();return Response.json({id,emailReady:mailReady(env)});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:'Solicitud inválida.'},{status:e instanceof AccessError?e.status:400});}
}
