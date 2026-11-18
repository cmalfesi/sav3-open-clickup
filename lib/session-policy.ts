import {createHash} from 'node:crypto';
import type {Actor} from './access-context';

/** Rolling inactivity window for the application's own browser sessions. */
export const SESSION_IDLE_SECONDS=5*24*60*60;
export const SESSION_IDLE_MS=SESSION_IDLE_SECONDS*1000;
const RECENT_ACTIVITY_MS=120000;

export const cookieName=(req:Request)=>new URL(req.url).protocol==='https:'?'__Host-sav3_session':'sav3_session';
export function cookieToken(req:Request){
 return req.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName(req)+'='))?.split('=')[1];
}
export const sessionCookie=(req:Request,value:string,age=SESSION_IDLE_SECONDS)=>`${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;

/**
 * Only a visible tab with recent input may extend a still-valid local session.
 * The deadline is anchored to the last input, not to the heartbeat's arrival.
 * Never create a session here: logout, expiry and account revocation must win.
 */
export async function renewSessionForActivity(db:D1Database,req:Request,a:Actor,input:{visible:boolean;idleMs:number},now=Date.now()):Promise<string|null>{
 if(req.method!=='POST'||req.headers.get('Origin')!==new URL(req.url).origin)return null;
 if(a.kind!=='local'||!a.sessionId||!input.visible||!Number.isInteger(input.idleMs)||input.idleMs<0||input.idleMs>RECENT_ACTIVITY_MS)return null;
 const raw=cookieToken(req);
 if(!raw||!/^[a-f0-9]{64}$/.test(raw)||createHash('sha256').update(raw).digest('hex')!==a.sessionId)return null;
 const deadline=new Date(now-input.idleMs+SESSION_IDLE_MS).toISOString();
 const renewed=await db.prepare(`UPDATE Session SET expiresAt=max(expiresAt,?)
  WHERE id=? AND userId=? AND expiresAt>?
  AND EXISTS(SELECT 1 FROM AccountAccess WHERE userId=Session.userId AND enabled=1)
  AND EXISTS(SELECT 1 FROM WorkspaceMember WHERE userId=Session.userId AND workspaceId=?)
  RETURNING expiresAt`).bind(deadline,a.sessionId,a.user.id,new Date(now).toISOString(),a.workspaceId).first<{expiresAt:string}>();
 // Reissue on an eligible retry too: a previous response may have been lost
 // after its database update. max() keeps the original activity deadline.
 // Persist the browser cookie as well as the server deadline. Server expiry is
 // authoritative; the cookie can outlive it by the reported short idle interval.
 return renewed?sessionCookie(req,raw):null;
}
