import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {AccessError,type Actor} from './access-context';
import {digest,newSession,throttle} from './team-service';
export type GoogleEnvironment={GOOGLE_CLIENT_ID?:string;GOOGLE_CLIENT_SECRET?:string;GOOGLE_WORKSPACE_DOMAIN?:string};
export const googleReady=(env:GoogleEnvironment)=>!!env.GOOGLE_CLIENT_ID&&!!env.GOOGLE_CLIENT_SECRET&&!!env.GOOGLE_WORKSPACE_DOMAIN;
const stateCookie=(req:Request,value:string,age=600)=>(new URL(req.url).protocol==='https:'?'__Host-sav3_google':'sav3_google')+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(new URL(req.url).protocol==='https:'?'; Secure':'');
export async function verifyGoogleToken(token:string,env:GoogleEnvironment,nonce:string){
 const parts=token.split('.');if(parts.length!==3)throw new AccessError(403,'Identidad de Google inválida.');
 const header=JSON.parse(Buffer.from(parts[0],'base64url').toString()),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString());
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw new AccessError(403,'Firma inválida.');
 const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new AccessError(503,'Google no está disponible.');
 const jwks=await response.json() as {keys:(JsonWebKey&{kid:string})[]},jwk=jwks.keys.find(k=>k.kid===header.kid);if(!jwk)throw new AccessError(403,'Firma desconocida.');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1]));
 const now=Date.now()/1000;
 if(!valid||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||claims.aud!==env.GOOGLE_CLIENT_ID||(claims.azp&&claims.azp!==env.GOOGLE_CLIENT_ID)||typeof claims.exp!=='number'||claims.exp<=now||typeof claims.iat!=='number'||claims.iat>now+60||claims.nonce!==nonce||claims.email_verified!==true||claims.hd!==env.GOOGLE_WORKSPACE_DOMAIN||typeof claims.sub!=='string'||typeof claims.email!=='string')throw new AccessError(403,'La identidad o el dominio de Google no son válidos para este espacio.');
 return {issuer:'https://accounts.google.com',subject:claims.sub as string,email:(claims.email as string).toLowerCase()};
}
export async function googleRoute(req:Request,db:D1Database,a:Actor|null,env:GoogleEnvironment):Promise<Response|null>{
 const u=new URL(req.url);if(!u.pathname.startsWith('/api/auth/google/'))return null;
 try{if(!googleReady(env))throw new AccessError(503,'El ingreso con Google todavía no está configurado.');if(req.method!=='GET')throw new AccessError(405,'Solo GET.');
 await throttle(db,'google:'+(req.headers.get('CF-Connecting-IP')??'unknown'),60);
 if(u.pathname==='/api/auth/google/start'){
 const linking=u.searchParams.get('link')==='1';if(linking&&(!a||a.kind==='token'))throw new AccessError(401,'Ingresá primero para vincular Google.');
 const state=randomBytes(32).toString('hex'),nonce=randomBytes(32).toString('hex'),verifier=randomBytes(32).toString('base64url');
 await db.prepare('INSERT INTO OAuthLoginState(stateHash,nonce,verifier,expiresAt,userId) VALUES(?,?,?,?,?)').bind(digest(state),nonce,verifier,Date.now()+600000,linking?a!.user.id:null).run();
 const params=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,redirect_uri:u.origin+'/api/auth/google/callback',response_type:'code',scope:'openid email',state,nonce,hd:env.GOOGLE_WORKSPACE_DOMAIN!,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',prompt:'select_account'});
 return new Response(null,{status:303,headers:{Location:'https://accounts.google.com/o/oauth2/v2/auth?'+params,'Set-Cookie':stateCookie(req,state)}});
 }
 if(u.pathname!=='/api/auth/google/callback')throw new AccessError(404,'Ruta inexistente.');
 const state=u.searchParams.get('state')??'',cookie=req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith((u.protocol==='https:'?'__Host-sav3_google':'sav3_google')+'='))?.split('=')[1];
 if(!/^[a-f0-9]{64}$/.test(state)||cookie!==state||!u.searchParams.get('code'))throw new AccessError(403,'El ingreso venció. Iniciá de nuevo.');
 const record=await db.prepare('DELETE FROM OAuthLoginState WHERE stateHash=? AND expiresAt>? RETURNING nonce,verifier,userId').bind(digest(state),Date.now()).first<{nonce:string;verifier:string;userId:string|null}>();if(!record)throw new AccessError(403,'El ingreso ya no está disponible.');
 const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,redirect_uri:u.origin+'/api/auth/google/callback',code:u.searchParams.get('code')!,grant_type:'authorization_code',code_verifier:record.verifier}),signal:AbortSignal.timeout(10000)});
 if(!tokenResponse.ok)throw new AccessError(403,'Google no pudo completar el ingreso.');const token=await tokenResponse.json() as {id_token?:string};if(!token.id_token)throw new AccessError(403,'Google no devolvió una identidad.');
 const identity=await verifyGoogleToken(token.id_token,env,record.nonce);
 if(record.userId){if(!a||a.user.id!==record.userId||a.user.email.toLowerCase()!==identity.email)throw new AccessError(403,'Vinculá la misma cuenta de Google que tu email del espacio.');const linked=await db.batch([db.prepare('INSERT INTO ExternalIdentity(issuer,subject,userId) VALUES(?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET userId=excluded.userId WHERE ExternalIdentity.userId=excluded.userId').bind(identity.issuer,identity.subject,a.user.id),db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'google.link',?,?)").bind(randomUUID(),a.user.id,a.user.id,Date.now())]);if(!linked[0].meta.changes)throw new AccessError(403,'Esta identidad ya está vinculada a otra cuenta.');return new Response(null,{status:303,headers:{Location:'/settings','Set-Cookie':stateCookie(req,'',0)}});}
 const member=await db.prepare('SELECT x.userId FROM ExternalIdentity x JOIN AccountAccess a ON a.userId=x.userId AND a.enabled=1 JOIN User u ON u.id=x.userId WHERE x.issuer=? AND x.subject=? AND lower(u.email)=?').bind(identity.issuer,identity.subject,identity.email).first<{userId:string}>();
 if(!member)throw new AccessError(403,'Primero ingresá con tu contraseña y vinculá Google desde Mi cuenta.');
 const session=await newSession(db,req,member.userId),headers=new Headers(session.headers);headers.set('Location','/home');headers.append('Set-Cookie',stateCookie(req,'',0));return new Response(null,{status:303,headers});
 }catch(e){return Response.json({error:e instanceof AccessError?e.message:'No pudimos validar el ingreso con Google.'},{status:e instanceof AccessError?e.status:400});}
}
