import {randomBytes,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessError} from './access-context';
import {digest,throttle} from './team-service';
import {hashPassword} from './password';
import {mailReady,sendTransactionalMail,type MailEnvironment} from './mail-service';
export async function accountRecoveryRoute(req:Request,db:D1Database,env:MailEnvironment):Promise<Response|null>{
 const u=new URL(req.url);if(!['/api/auth/recovery','/api/auth/reset-password'].includes(u.pathname))return null;
 try{if(req.method!=='POST')throw new AccessError(405,'Solo POST.');if(req.headers.get('Origin')!==u.origin)throw new AccessError(403,'Origen no permitido.');
 await throttle(db,'recovery-ip:'+(req.headers.get('CF-Connecting-IP')??'unknown'),20);
 if(u.pathname==='/api/auth/recovery'){
 const p=z.object({email:z.string().trim().email().max(254)}).parse(await req.json());await throttle(db,'recovery:'+p.email.toLowerCase(),5);
 if(!mailReady(env))throw new AccessError(503,'La recuperación por email todavía no está configurada. Pedile un nuevo acceso al administrador.');
 const account=await db.prepare('SELECT u.id FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 WHERE lower(u.email)=?').bind(p.email.toLowerCase()).first<{id:string}>();
 if(account){const token=randomBytes(32).toString('hex'),tokenHash=digest(token);await db.prepare('INSERT INTO PasswordRecovery(tokenHash,userId,expiresAt) VALUES(?,?,?)').bind(tokenHash,account.id,Date.now()+30*60000).run();const result=await sendTransactionalMail(env,p.email,'Recuperar acceso al espacio de trabajo','Abrí este enlace para elegir una nueva contraseña. Vence en 30 minutos y se utiliza una vez:\n\n'+u.origin+'/reset-password#token='+token,'recovery:'+tokenHash);if(!result.sent)await db.prepare('DELETE FROM PasswordRecovery WHERE tokenHash=?').bind(tokenHash).run();}
 return Response.json({ok:true,message:'Si hay una cuenta habilitada con ese email, recibirás un enlace de recuperación.'});
 }
 const p=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password:z.string().min(12).max(128)}).parse(await req.json()),key=digest(p.token),now=Date.now();
 const user=await db.prepare('SELECT r.userId FROM PasswordRecovery r JOIN AccountAccess a ON a.userId=r.userId AND a.enabled=1 WHERE r.tokenHash=? AND r.usedAt IS NULL AND r.expiresAt>?').bind(key,now).first<{userId:string}>();if(!user)throw new AccessError(410,'El enlace venció o ya se utilizó. Solicitá uno nuevo.');
 const nonce=randomUUID(),guard='EXISTS(SELECT 1 FROM PasswordRecovery WHERE tokenHash=? AND consumedBy=?)';
 const results=await db.batch([db.prepare('UPDATE PasswordRecovery SET usedAt=?,consumedBy=? WHERE tokenHash=? AND usedAt IS NULL AND expiresAt>?').bind(now,nonce,key,now),db.prepare('UPDATE User SET passwordHash=? WHERE id=? AND '+guard).bind(hashPassword(p.password),user.userId,key,nonce),db.prepare('DELETE FROM Session WHERE userId=? AND '+guard).bind(user.userId,key,nonce),db.prepare('UPDATE IntegrationToken SET revoked=1 WHERE userId=? AND '+guard).bind(user.userId,key,nonce),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) SELECT ?,?,'password.recover',?,? WHERE "+guard).bind(randomUUID(),user.userId,user.userId,now,key,nonce)]);if(!results[0].meta.changes)throw new AccessError(410,'El enlace ya no está disponible.');
 return Response.json({ok:true});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:'Revisá los datos ingresados.'},{status:e instanceof AccessError?e.status:400});}
}
