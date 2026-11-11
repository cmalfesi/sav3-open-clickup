import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Access,type Actor} from '@/lib/access-context';
import {presenceOverview,presenceRoute,recordPresence} from '@/lib/presence-service';
const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
let mf:InstanceType<typeof Miniflare>,db:D1Database;
const now=Date.now(),client='550e8400-e29b-41d4-a716-446655440000';
function actor(role:Actor['role']='MEMBER',id='member'):Actor{return {user:{id,email:id+'@test.com',name:id,color:'#000',avatarUrl:null},workspaceId:'w',role,kind:'local',permissionRevision:'current',sessionId:'session',access:new Access(role,false,[{type:'TASK',id:'t',listId:'l'}],[{resourceType:'TASK',resourceId:'t',level:'VIEW'}])}}
const input={clientId:client,visible:true,idleMs:0,resources:[]};
function req(path:string,body?:unknown,origin='https://site.test'){return new Request('https://site.test'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})}
beforeAll(async()=>{mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'presence'}});db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();await db.batch([
 db.prepare("INSERT INTO User(id,email,name) VALUES('member','m@test.com','Member'),('owner','o@test.com','Owner'),('untouched','u@test.com','Untouched')"),db.prepare("INSERT INTO Workspace(id,name) VALUES('w','Workspace')"),db.prepare("INSERT INTO WorkspaceMember(id,workspaceId,userId,role) VALUES('m','w','member','MEMBER'),('o','w','owner','OWNER'),('u','w','untouched','MEMBER')"),db.prepare("INSERT INTO AccountAccess(userId,enabled,scopeAll) VALUES('member',1,0),('owner',1,1),('untouched',1,0)"),db.prepare("INSERT INTO Session(id,userId,expiresAt) VALUES('session','member',?)").bind(new Date(now+3600000).toISOString())]);},30000);
afterAll(async()=>{await mf?.dispose()});
describe('web presence',()=>{
 it('restricts the overview to the owner and the heartbeat to authenticated same-origin web clients',async()=>{
  expect((await presenceRoute(req('/api/team/presence'),db,null))!.status).toBe(401);
  for(const role of ['ADMIN','MEMBER','GUEST'] as const)expect((await presenceRoute(req('/api/team/presence'),db,actor(role)))!.status).toBe(403);
  expect((await presenceRoute(req('/api/team/presence'),db,actor('OWNER','owner')))!.status).toBe(200);
  expect((await presenceRoute(req('/api/presence',input,'https://evil.test'),db,actor()))!.status).toBe(403);
  expect((await presenceRoute(req('/api/presence',input),db,{...actor(),kind:'token'}))!.status).toBe(403);
  expect((await presenceRoute(req('/api/presence',{...input,idleMs:-1}),db,actor()))!.status).toBe(400);
  expect((await presenceRoute(req('/api/presence',input),db,actor('GUEST')))!.status).toBe(200);
 });
 it('distinguishes activity, background/idle clients, stale signals and never-observed users',async()=>{
  await recordPresence(db,actor(),input,now);
  const state=async(at:number)=>((await presenceOverview(db,'w',at)).users.find(r=>r.id==='member')!);
  expect((await state(now)).state).toBe('active');
  expect((await presenceOverview(db,'w',now)).users.find(r=>r.id==='untouched')!.state).toBe('unknown');
  await recordPresence(db,actor(),{...input,visible:false,idleMs:10000},now+10000);
  expect((await state(now+10000)).state).toBe('idle');
  await recordPresence(db,actor(),{...input,idleMs:180000},now+200000);
  expect((await state(now+200000)).state).toBe('idle');
  expect((await state(now+300000)).state).toBe('offline');
 });
 it('aggregates multiple tabs without treating a background tab as active',async()=>{
  await recordPresence(db,actor(),{...input,visible:false,idleMs:1000},now+400000);
  await recordPresence(db,actor(),{...input,clientId:'550e8400-e29b-41d4-a716-446655440001'},now+400000);
  expect((await presenceOverview(db,'w',now+400000)).users.find(r=>r.id==='member')!.state).toBe('active');
 });
 it('reports current resource denials and revision without returning task content',async()=>{
  const result=await recordPresence(db,actor(),{...input,resources:[{type:'TASK',id:'hidden'},{type:'TASK',id:'t'},{type:'LIST',id:'l'}]},now+500000);
  expect(result).toEqual({revision:'current',denied:[{type:'TASK',id:'hidden'}]});
 });
 it('excludes closed sessions and disabled accounts immediately',async()=>{
  await db.prepare("DELETE FROM Session WHERE id='session'").run();
  expect((await presenceOverview(db,'w',now+500000)).users.find(r=>r.id==='member')!.state).toBe('offline');
  await db.prepare("UPDATE AccountAccess SET enabled=0 WHERE userId='member'").run();
  expect((await presenceOverview(db,'w',now+500000)).users.find(r=>r.id==='member')!.state).toBe('disabled');
 });
});
