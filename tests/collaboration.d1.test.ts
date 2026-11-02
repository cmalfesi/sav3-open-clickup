import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { withActor,type Actor } from '@/lib/access-context';
const holder=vi.hoisted(()=>({db:null as D1Database|null,client:null as PrismaClient|null}));
vi.mock('@/lib/generated/prisma/internal/query_compiler_fast_bg.wasm?module',async()=>({default:new WebAssembly.Module((await import('node:fs')).readFileSync('lib/generated/prisma/internal/query_compiler_fast_bg.wasm'))}));
vi.mock('@/lib/db',()=>({getD1:()=>holder.db!,prisma:new Proxy({},{get:(_,key)=>Reflect.get(holder.client!,key)})}));
vi.mock('@/app/api/restore/route',()=>({POST:async()=>Response.json({complete:true})}));
import { callTool, POST as mcp } from '@/app/mcp/route';
import { loadActor } from '@/lib/team-service';
import { integrationRoute } from '@/lib/integration-access';
import { authorizeResourceRequest } from '@/lib/request-access';
import { changesResponse,recordChanges,changeTargets } from '@/lib/collaboration';
import { createNotifications } from '@/lib/notifications';
import { updateTask } from '@/lib/tasks';
import { POST as webComment } from '@/app/api/tasks/[taskId]/comments/route';
import { GET as inbox } from '@/app/api/notifications/route';
const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
let mf:InstanceType<typeof Miniflare>,owner:Actor,member:Actor,other:Actor;
const origin='https://site.test';
const req=(path:string,method='GET',body?:unknown)=>new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
beforeAll(async()=>{
 mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'collaboration'}});
 holder.db=await mf.getD1Database('DB');const db=holder.db!;
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 holder.client=new PrismaClient({adapter:new PrismaD1(db)});const p=holder.client;
 await p.workspace.create({data:{id:'90132980889',name:'Test'}});
 for(const id of ['owner','member','other']){await p.user.create({data:{id,email:id+'@test.com',name:id,passwordHash:'activated'}});await p.workspaceMember.create({data:{workspaceId:'90132980889',userId:id,role:id==='owner'?'OWNER':'MEMBER'}});await db.prepare('INSERT INTO AccountAccess (userId,enabled,scopeAll) VALUES (?,1,?)').bind(id,id==='owner'?1:0).run();}
 await db.prepare("INSERT INTO RestoreState (id,ownerKey,complete) VALUES ('backup-2026-10-30','native-owner',1)").run();
 await p.space.create({data:{id:'s',name:'S',workspaceId:'90132980889'}});
 for(const id of ['l','hidden-list']){await p.list.create({data:{id,spaceId:'s',name:id}});await p.status.create({data:{id:'st-'+id,listId:id,name:'Open',type:'NOT_STARTED'}});}
 for(const [id,listId] of [['t','l'],['hidden','l'],['elsewhere','hidden-list']])await p.task.create({data:{id,listId,name:id,statusId:'st-'+listId}});
 await db.batch([db.prepare("INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) VALUES ('member','LIST','l','EDIT')"),db.prepare("INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) VALUES ('member','TASK','hidden','NONE')"),db.prepare("INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) VALUES ('other','TASK','t','COMMENT')")]);
 async function native(id:string){return (await loadActor(db,new Request(origin+'/mcp',{headers:{'oai-authenticated-user-id':id==='owner'?'native-owner':'native-'+id,'oai-authenticated-user-email':id+'@test.com'}})))!;}
 owner=await native('owner');member=await native('member');other=await native('other');
},30000);
afterAll(async()=>{await holder.client?.$disconnect();await mf?.dispose();});
describe('personal LLM connections and ACL',()=>{
 it('recognizes activated team identities without promoting them',()=>{expect(member.role).toBe('MEMBER');expect(member.user.id).toBe('member');expect(member.access.can('TASK','hidden')).toBe(false);});
 it('filters search and counts before returning MCP data',async()=>{const result=await withActor(member,()=>callTool('search_tasks',{})) as {id:string}[];expect(result.map(t=>t.id)).toEqual(['t']);const tree=await withActor(member,()=>callTool('get_workspace',{})) as {tasks:number};expect(tree.tasks).toBe(1);await expect(withActor(member,()=>callTool('get_task',{task_id:'hidden'}))).rejects.toMatchObject({status:403});});
 it('denies a guessed task, list or administrator tool',async()=>{await expect(withActor(member,()=>callTool('update_task',{task_id:'hidden',name:'Bad'}))).rejects.toMatchObject({status:403});await expect(withActor(member,()=>callTool('create_task',{list_id:'hidden-list',name:'Bad'}))).rejects.toMatchObject({status:403});await expect(withActor(member,()=>callTool('prepare_workspace',{}))).rejects.toMatchObject({status:403});});
 it('issues only hashed credentials, enforces read scope and revokes immediately',async()=>{
  const db=holder.db!,response=await integrationRoute(req('/api/integrations/tokens','POST',{name:'Test LLM',scope:'read',days:7}),db,member),data=await response!.json() as {id:string;token:string};expect(response!.status).toBe(200);
  const row=await db.prepare('SELECT tokenHash FROM IntegrationToken WHERE id=?').bind(data.id).first<{tokenHash:string}>();expect(row!.tokenHash).not.toContain(data.token);
  const request=new Request(origin+'/api/integrations/mcp',{method:'POST',headers:{Authorization:'Bearer '+data.token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'update_task',arguments:{task_id:'t',name:'Bad'}}})});
  const a=(await loadActor(db,request))!;expect(a.user.id).toBe('member');await expect(authorizeResourceRequest(request,db,a)).resolves.toBeUndefined();
  const result=await withActor(a,()=>mcp(request));expect((await result.json() as {result:{isError:boolean}}).result.isError).toBe(true);
  await expect(authorizeResourceRequest(new Request(origin+'/api/tasks/t',{method:'PATCH'}),db,a)).rejects.toMatchObject({status:403});
  await integrationRoute(req('/api/integrations/tokens','DELETE',{id:data.id}),db,member);expect(await loadActor(db,request)).toBeNull();
 });
 it('refuses expired credentials and disabled members',async()=>{const db=holder.db!,r=await integrationRoute(req('/api/integrations/tokens','POST',{name:'Expire',scope:'write',days:1}),db,member),d=await r!.json() as {id:string;token:string};const request=new Request(origin+'/api/tasks/t',{headers:{Authorization:'Bearer '+d.token}});expect(await loadActor(db,request)).not.toBeNull();await db.prepare('UPDATE IntegrationToken SET expiresAt=0 WHERE id=?').bind(d.id).run();expect(await loadActor(db,request)).toBeNull();await db.prepare("UPDATE AccountAccess SET enabled=0 WHERE userId='other'").run();expect(await loadActor(db,new Request(origin+'/mcp',{headers:{'oai-authenticated-user-id':'native-other','oai-authenticated-user-email':'other@test.com'}}))).toBeNull();await db.prepare("UPDATE AccountAccess SET enabled=1 WHERE userId='other'").run();});
});
describe('activity and notifications across web and MCP',()=>{
 it('attributes description edits and keeps before/after without duplicate mentions',async()=>{const p=holder.client!;await withActor({...owner,channel:'mcp'},()=>callTool('update_task',{task_id:'t',description:'Changed by LLM',mention_user_ids:['member']}));const activity=await p.activity.findFirst({where:{taskId:'t',type:'description_changed'}});expect(activity!.userId).toBe('owner');expect(activity!.data).toMatchObject({source:'mcp',before:null});expect((activity!.data as {after:string}).after).toContain('Changed by LLM');expect(await p.notification.count({where:{userId:'member',type:'mention'}})).toBe(1);await withActor(owner,()=>callTool('update_task',{task_id:'t',description:'Another edit',mention_user_ids:['member']}));expect(await p.notification.count({where:{userId:'member',type:'mention'}})).toBe(1);const detail=await withActor(member,()=>callTool('get_task',{task_id:'t'})) as {activities:unknown[]};expect(detail.activities.length).toBeGreaterThan(0);});
 it('refuses a stale description while keeping the newer content',async()=>{const existing=await holder.client!.task.findUniqueOrThrow({where:{id:'t'}});await expect(withActor(owner,()=>updateTask('t',{description:'stale overwrite',expectedDescription:'older version'},'owner'))).rejects.toMatchObject({status:409});expect((await holder.client!.task.findUniqueOrThrow({where:{id:'t'}})).description).toBe(existing.description);});
 it('creates MCP comment and reply notifications using the same service as the web',async()=>{const p=holder.client!;const c=await withActor({...owner,channel:'mcp'},()=>callTool('add_comment',{task_id:'t',body:'Please review',mention_user_ids:['member']})) as {id:string};expect(await p.notification.count({where:{userId:'member',type:'mention'}})).toBe(2);const response=await withActor(member,()=>webComment(req('/api/tasks/t/comments','POST',{body:'<p>Reply</p>',parentId:c.id}),{params:Promise.resolve({taskId:'t'})}));expect(response.status).toBe(201);expect(await p.notification.count({where:{userId:'owner',type:'comment'}})).toBe(1);});
 it('respects recipient access, preferences, self exclusion and duplicates',async()=>{const p=holder.client!,db=holder.db!;const before=await p.notification.count();await withActor(owner,()=>createNotifications({recipientIds:['owner','member','member'],actorId:'owner',taskId:'hidden',type:'mention',body:'Secret'}));expect(await p.notification.count()).toBe(before);await integrationRoute(req('/api/notification-preferences','PUT',{mentions:false,assigned:true,comments:true}),db,member);await withActor(owner,()=>createNotifications({recipientIds:['member','member'],actorId:'owner',taskId:'t',type:'mention',body:'Muted'}));expect(await p.notification.count()).toBe(before);await integrationRoute(req('/api/notification-preferences','PUT',{mentions:true,assigned:true,comments:true}),db,member);await withActor(owner,()=>updateTask('t',{assigneeIds:['member']},'owner'));expect(await p.notification.count({where:{userId:'member',type:'assigned'}})).toBe(1);const result=await withActor(other,()=>inbox(req('/api/notifications'),undefined));expect((await result.json() as {notifications:unknown[]}).notifications).toHaveLength(0);});
});
describe('durable changes across requests',()=>{
 it('detects only relevant allowed changes and skips the same tab',async()=>{const db=holder.db!,start=await (await changesResponse(req('/api/changes?list_id=l'),db,member)).json() as {cursor:number};const source={...owner,clientId:'writer-tab'};
  await recordChanges(db,source,[{taskId:'hidden',listId:'l'}],Response.json({ok:true}));let r=await (await changesResponse(req('/api/changes?list_id=l&cursor='+start.cursor),db,member)).json() as {changed:boolean};expect(r.changed).toBe(false);
  const request=req('/api/tasks/t','PATCH',{name:'Change'});expect(await changeTargets(request,db,owner)).toEqual([{taskId:'t',listId:'l'}]);await recordChanges(db,source,[{taskId:'t',listId:'l'}],Response.json({ok:true}));
  r=await (await changesResponse(req('/api/changes?list_id=l&cursor='+start.cursor),db,member)).json() as {changed:boolean};expect(r.changed).toBe(true);
  r=await (await changesResponse(req('/api/changes?list_id=l&client=writer-tab&cursor='+start.cursor),db,member)).json() as {changed:boolean};expect(r.changed).toBe(false);
  expect((await changesResponse(req('/api/changes?list_id=hidden-list'),db,member)).status).toBe(403);
 });
 it('does not record denied or failed MCP writes',async()=>{const db=holder.db!,before=await db.prepare('SELECT count(*) n FROM ChangeEvent').first<{n:number}>();await recordChanges(db,owner,[{taskId:'t',listId:'l'}],Response.json({result:{isError:true}}));expect(await db.prepare('SELECT count(*) n FROM ChangeEvent').first()).toEqual(before);});
});
