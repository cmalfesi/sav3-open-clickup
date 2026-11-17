import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {digest,loadActor,newSession} from '@/lib/team-service';
import {presenceRoute} from '@/lib/presence-service';
import {renewSessionForActivity,SESSION_IDLE_MS,SESSION_IDLE_SECONDS} from '@/lib/session-policy';

const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
let mf:InstanceType<typeof Miniflare>,db:D1Database;
const start=Date.parse('2026-11-17T12:00:00.000Z'),hour=3600000,day=24*hour,origin='https://site.test';
let now=start,cookie:string,sid:string;
const input={clientId:'550e8400-e29b-41d4-a716-446655440000',visible:true,idleMs:0,resources:[]};
function request(path='/api/presence',body:unknown=input,siteOrigin=origin,session=cookie){return new Request(origin+path,{method:body===undefined?'GET':'POST',headers:{Cookie:session,Origin:siteOrigin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const deadline=async()=>Date.parse((await db.prepare('SELECT expiresAt FROM Session WHERE id=?').bind(sid).first<{expiresAt:string}>())!.expiresAt);
async function actor(){const a=await loadActor(db,request());expect(a).not.toBeNull();return a!;}
async function signal(body:unknown=input,siteOrigin=origin){const req=request('/api/presence',body,siteOrigin);return (await presenceRoute(req,db,await loadActor(db,req)))!;}

beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default{fetch(){return new Response('ok')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'session-idle'}});db=await mf.getD1Database('DB');
 for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 await db.batch([
  db.prepare("INSERT INTO Workspace(id,name) VALUES('90132980889','Test')"),
  db.prepare("INSERT INTO User(id,email,name) VALUES('member','m@example.test','Member')"),
  db.prepare("INSERT INTO WorkspaceMember(id,workspaceId,userId,role) VALUES('wm','90132980889','member','MEMBER')"),
  db.prepare("INSERT INTO AccountAccess(userId,enabled,scopeAll) VALUES('member',1,1)"),
 ]);
},30000);
beforeEach(async()=>{
 now=start;vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
 await db.batch([db.prepare('DELETE FROM Session'),db.prepare('DELETE FROM UserPresence'),db.prepare("UPDATE AccountAccess SET enabled=1 WHERE userId='member'")]);
 const response=await newSession(db,new Request(origin+'/api/auth/login'),'member');
 cookie=response.headers.get('Set-Cookie')!.split(';')[0];sid=digest(cookie.split('=')[1]);
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
afterAll(async()=>{await mf?.dispose();});

describe('five days since last browser activity',()=>{
 it('creates a persistent five-day cookie and server deadline with secure flags',async()=>{
  const response=await newSession(db,new Request(origin+'/api/auth/login'),'member');const header=response.headers.get('Set-Cookie')!;
  expect(SESSION_IDLE_SECONDS).toBe(432000);expect(header).toContain('Max-Age=432000');expect(header).toContain('HttpOnly');expect(header).toContain('SameSite=Lax');expect(header).toContain('Secure');expect(header).toContain('Path=/');
  expect(await deadline()).toBe(start+5*day);
 });
 it('renews both storage and cookie from recent input, including a still-valid legacy 12-hour session',async()=>{
  await db.prepare('UPDATE Session SET expiresAt=? WHERE id=?').bind(new Date(start+12*hour).toISOString(),sid).run();now+=4*hour;vi.setSystemTime(now);
  const response=await signal({...input,idleMs:5000});expect(response.status).toBe(200);expect(response.headers.get('Set-Cookie')).toContain(cookie+';');expect(response.headers.get('Set-Cookie')).toContain('Max-Age=432000');
  expect(await deadline()).toBe(now-5000+SESSION_IDLE_MS);
  expect(await db.prepare('SELECT count(*) n FROM Session').first()).toEqual({n:1});
 });
 it('does not move the deadline on heartbeats without new input or on hidden/idle tabs',async()=>{
  now+=hour;vi.setSystemTime(now);await signal();const saved=await deadline();
  now+=60000;vi.setSystemTime(now);expect((await signal({...input,idleMs:60000})).headers.has('Set-Cookie')).toBe(false);expect(await deadline()).toBe(saved);
  now+=60000;vi.setSystemTime(now);expect((await signal({...input,visible:false,idleMs:0})).headers.has('Set-Cookie')).toBe(false);expect(await deadline()).toBe(saved);
  now+=600000;vi.setSystemTime(now);expect((await signal({...input,idleMs:600001})).headers.has('Set-Cookie')).toBe(false);expect(await deadline()).toBe(saved);
 });
 it('allows use beyond the initial five days when there was later activity, then expires exactly after five inactive days',async()=>{
  now=start+4*day;vi.setSystemTime(now);await signal();expect(await deadline()).toBe(start+9*day);
  now=start+6*day;vi.setSystemTime(now);expect(await loadActor(db,request())).not.toBeNull();
  now=start+9*day;vi.setSystemTime(now);expect(await loadActor(db,request())).toBeNull();expect((await signal()).status).toBe(401);
  expect(await deadline()).toBe(start+9*day);
 });
 it('does not renew from ordinary/background reads or renew another browser session',async()=>{
  await newSession(db,new Request(origin+'/api/auth/login'),'member');now+=day;vi.setSystemTime(now);
  for(const path of ['/home','/api/changes','/api/notifications','/api/lists/l'])expect(await loadActor(db,new Request(origin+path,{headers:{Cookie:cookie}}))).not.toBeNull();
  expect(await deadline()).toBe(start+5*day);await signal();expect(await deadline()).toBe(now+5*day);
  const others=await db.prepare('SELECT expiresAt FROM Session WHERE id<>?').bind(sid).all<{expiresAt:string}>();expect(others.results).toEqual([{expiresAt:new Date(start+5*day).toISOString()}]);
 });
 it('cannot resurrect an expired/deleted session or renew a disabled account even with a stale actor',async()=>{
  const a=await actor();now+=hour;vi.setSystemTime(now);
  await db.prepare('UPDATE Session SET expiresAt=? WHERE id=?').bind(new Date(now).toISOString(),sid).run();
  expect(await renewSessionForActivity(db,request(),a,input)).toBeNull();expect(await deadline()).toBe(now);
  await db.prepare('UPDATE Session SET expiresAt=? WHERE id=?').bind(new Date(now+hour).toISOString(),sid).run();
  await db.prepare("UPDATE AccountAccess SET enabled=0 WHERE userId='member'").run();expect(await renewSessionForActivity(db,request(),a,input)).toBeNull();
  await db.prepare("UPDATE AccountAccess SET enabled=1 WHERE userId='member'").run();await db.prepare('DELETE FROM Session WHERE id=?').bind(sid).run();
  expect(await renewSessionForActivity(db,request(),a,input)).toBeNull();expect(await db.prepare('SELECT count(*) n FROM Session').first()).toEqual({n:0});
 });
 it('never shortens the deadline when an older signal arrives after a newer one',async()=>{
  const a=await actor();now+=hour;vi.setSystemTime(now);
  await renewSessionForActivity(db,request(),a,{...input,idleMs:0});const saved=await deadline();
  expect(await renewSessionForActivity(db,request(),a,{...input,idleMs:30000})).toBeNull();expect(await deadline()).toBe(saved);
 });
 it('requires same-origin authenticated local activity and rejects invalid signals without extending expiry',async()=>{
  const a=await actor(),saved=await deadline();now+=hour;vi.setSystemTime(now);
  expect((await signal(input,'https://foreign.test')).status).toBe(403);
  expect((await signal({...input,idleMs:-1})).status).toBe(400);
  for(const kind of ['native','token'] as const)expect(await renewSessionForActivity(db,request(),{...a,kind},input)).toBeNull();
  const forged=request('/api/presence',input,origin,'__Host-sav3_session='+'ab'.repeat(32));
  expect(await renewSessionForActivity(db,forged,a,input)).toBeNull();
  expect(await renewSessionForActivity(db,new Request(origin+'/api/presence',{headers:{Cookie:cookie}}),a,input)).toBeNull();
  expect(await deadline()).toBe(saved);
 });
});
