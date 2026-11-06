import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { readFileSync,readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Access,type Actor } from '@/lib/access-context';
import { resourceGraph } from '@/lib/team-service';
import { dashboardRoute,readDashboard,dashboardDataset } from '@/lib/dashboard-service';
import { prepareOportunidadesDashboard } from '@/lib/oportunidades-dashboard';
import { emptyDashboard,cardSchema,calculateCard } from '@/lib/dashboard-model';
const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
let mf:InstanceType<typeof Miniflare>,db:D1Database;
const origin='https://site.test';
async function actor(id='owner'):Promise<Actor>{const role=id==='owner'?'OWNER':id==='guest'?'GUEST':'MEMBER',grants=(await db.prepare('SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=?').bind(id).all()).results as import('@/lib/access-context').Grant[],policies=(await db.prepare('SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1').all()).results as {resourceType:string;resourceId:string}[];return {user:{id,email:id+'@test.com',name:id,color:'#000000',avatarUrl:null},workspaceId:'90132980889',role,kind:'local',access:new Access(role,id==='owner',await resourceGraph(db),grants,policies.map(p=>p.resourceType+':'+p.resourceId))};}
async function call(path:string,method='GET',body?:unknown,id='owner',requestOrigin=origin){const a=await actor(id);return (await dashboardRoute(new Request(origin+path,{method,headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)}),db,a))!;}
beforeAll(async()=>{mf=new Miniflare({modules:true,script:"export default {fetch(){return new Response('ok')}}",compatibilityDate:'2026-05-15',d1Databases:{DB:'dashboard-tests'}});db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();await db.batch([
 db.prepare("INSERT INTO Workspace(id,name) VALUES ('90132980889','Test')"),db.prepare("INSERT INTO User(id,email,name) VALUES ('owner','owner@test.com','Owner'),('member','member@test.com','Member'),('viewer','viewer@test.com','Viewer'),('guest','guest@test.com','Guest')"),
 db.prepare("INSERT INTO WorkspaceMember(id,workspaceId,userId,role) VALUES ('wm1','90132980889','owner','OWNER'),('wm2','90132980889','member','MEMBER'),('wm3','90132980889','viewer','MEMBER'),('wm4','90132980889','guest','GUEST')"),db.prepare("INSERT INTO AccountAccess(userId,enabled,scopeAll) VALUES ('owner',1,1),('member',1,0),('viewer',1,0),('guest',1,0)"),db.prepare("INSERT INTO Space(id,workspaceId,name) VALUES ('s','90132980889','S')"),db.prepare("INSERT INTO List(id,spaceId,name) VALUES ('l','s','L'),('private','s','Hidden list')"),db.prepare("INSERT INTO Status(id,listId,name,type) VALUES ('open','l','Open','NOT_STARTED'),('done','l','Done','CLOSED'),('hidden-status','private','Secret','NOT_STARTED')"),db.prepare("INSERT INTO Task(id,listId,statusId,name,updatedAt,createdAt,timeEstimate) VALUES ('a','l','open','Allowed',CURRENT_TIMESTAMP,1793520000000,10),('b','l','done','Restricted task',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,20),('secret','private','hidden-status','Secret',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,50)"),db.prepare("INSERT INTO ResourceGrant(userId,resourceType,resourceId,level) VALUES ('member','LIST','l','EDIT'),('member','TASK','b','NONE'),('viewer','TASK','a','VIEW')")]);},30000);
afterAll(async()=>{await mf?.dispose();});
describe('dashboard editor persistence and permissions',()=>{
 it('creates an empty private dashboard and an optional view without granting tasks',async()=>{const r=await call('/api/dashboards','POST',{name:'My panel',sources:['l'],listId:'l'},'member');expect(r.status).toBe(200);const created=await r.json() as {id:string;viewId:string};const d=await readDashboard(db,await actor('member'),created.id);expect(d.config.cards).toEqual([]);expect(d.canEdit).toBe(true);expect((await call('/api/dashboards/'+created.id,'PUT',{name:'Renamed view',config:d.config,revision:d.revision},'member')).status).toBe(200);expect((await db.prepare('SELECT name FROM View WHERE id=?').bind(created.viewId).first<{name:string}>())!.name).toBe('Renamed view');expect(await db.prepare('SELECT type FROM View WHERE id=?').bind(created.viewId).first()).toEqual({type:'DASHBOARD'});expect((await call('/api/dashboards/'+created.id,'GET',undefined,'viewer')).status).toBe(403);});
 it('blocks guest creation, unshared sources and unauthorized cross-origin writes',async()=>{expect((await call('/api/dashboards','POST',{name:'No',sources:[]},'guest')).status).toBe(403);expect((await call('/api/dashboards','POST',{name:'No',sources:['private']},'member')).status).toBe(403);expect((await call('/api/dashboards','POST',{name:'No'},'member','https://evil.test')).status).toBe(403);});
 it('saves layout, filters and metrics with an attributed revision; stale and concurrent saves do not overwrite',async()=>{
  const r=await call('/api/dashboards','POST',{name:'Revision panel',sources:['l']});const {id}=await r.json() as {id:string};const config=emptyDashboard(['l']);config.cards=[cardSchema.parse({id:'c1',title:'Count',type:'kpi',background:'#102030',fontSize:28,layout:{x:0,y:0,w:3,h:1}})];
  const save=(revision:number,title:string)=>call('/api/dashboards/'+id,'PUT',{name:title,config,revision});expect((await save(1,'Saved')).status).toBe(200);expect((await save(1,'Stale')).status).toBe(409);const concurrent=await Promise.all([save(2,'A'),save(2,'B')]);expect(concurrent.map(r=>r.status).sort()).toEqual([200,409]);
  const d=await readDashboard(db,await actor(),id);expect(d.revision).toBe(3);expect(d.config.cards[0].layout.w).toBe(3);expect(d.config.cards[0].layout.h).toBe(1);expect(d.config.cards[0].fontSize).toBe(28);expect(d.config.cards[0].background).toBe('#102030');const h=await db.prepare('SELECT actorId FROM DashboardHistory WHERE dashboardId=? AND revision=3').bind(id).first();expect(h).toEqual({actorId:'owner'});
 });
 it('sharing a dashboard exposes only tasks the viewer can read, including aggregates, activity and date normalization',async()=>{
  const r=await call('/api/dashboards','POST',{name:'Shared',sources:['l']});const {id}=await r.json() as {id:string};expect((await call('/api/dashboards/'+id+'/share','POST',{userId:'viewer',level:'VIEW'})).status).toBe(200);
  const d=await readDashboard(db,await actor('viewer'),id);expect(d.canEdit).toBe(false);const dataset=await dashboardDataset(db,await actor('viewer'),d.config);expect(dataset.tasks.map(t=>t.id)).toEqual(['a']);expect(dataset.tasks[0].createdAt).toMatch(/^2026-/);expect(calculateCard(d.config,cardSchema.parse({id:'c',title:'Total',type:'kpi'}),dataset).value).toBe(1);
  expect((await call('/api/dashboards/'+id,'PUT',{name:'Hack',config:d.config,revision:1},'viewer')).status).toBe(403);expect((await call('/api/dashboards/'+id+'/share','POST',{userId:'member',level:'EDIT'},'viewer')).status).toBe(403);
 });
 it('sorts activity by the actual date across imported text and new numeric timestamps',async()=>{
  await db.batch([db.prepare("INSERT INTO Activity(id,taskId,userId,type,data,createdAt) VALUES ('old-activity','a','owner','created','{}',?)").bind('2026-01-01T00:00:00Z'),db.prepare("INSERT INTO Activity(id,taskId,userId,type,data,createdAt) VALUES ('new-activity','a','owner','renamed','{}',?)").bind(Date.parse('2026-11-02T12:00:00Z'))]);
  const d=await dashboardDataset(db,await actor(),emptyDashboard(['l']));expect(d.activities.slice(0,2).map(a=>a.id)).toEqual(['new-activity','old-activity']);
 });
 it('can archive and restore while preserving cards, and preserves legacy summary configurations',async()=>{const r=await call('/api/dashboards','POST',{name:'Archive',sources:['l']});const {id}=await r.json() as {id:string};let d=await readDashboard(db,await actor(),id);expect((await call('/api/dashboards/'+id,'PUT',{name:d.name,config:d.config,revision:d.revision,archived:true})).status).toBe(200);d=await readDashboard(db,await actor(),id);expect(d.archived).toBe(true);expect((await call('/api/dashboards/'+id,'PUT',{name:d.name,config:d.config,revision:d.revision,archived:false})).status).toBe(200);await db.prepare("INSERT INTO Dashboard(id,name,sources,createdBy,createdAt) VALUES ('legacy','Legacy','[\"l\"]','owner',0)").run();const legacy=await readDashboard(db,await actor(),'legacy');expect(legacy.config.sources).toEqual(['l']);expect(legacy.revision).toBe(0);expect((await call('/api/dashboards/legacy','PUT',{name:'Legacy',config:legacy.config,revision:0})).status).toBe(200);});
});

it('prepares the private Oportunidades view once and preserves user edits',async()=>{
 const listId='901328299490',legacy=listId+'__969266e8-243d-4d3c-bb74-88281ffa2d2a',deal=listId+'__452ed6a6-dffa-4838-afe0-44fc5db42bb7';
 const statuses=['backlog','contacted','discovery + interes inicia','oportunidad validada','business case','propuesta','negotiation','on hold','won','lost','descartado','complete'];
 await db.batch([
  db.prepare("INSERT INTO List(id,spaceId,name) VALUES (?,'s','Oportunidades')").bind(listId),
  ...statuses.map((name,i)=>db.prepare("INSERT INTO Status(id,listId,name,type) VALUES (?,?,?,'ACTIVE')").bind('opp-'+i,listId,name)),
  ...[legacy,deal].flatMap(id=>[
   db.prepare("INSERT INTO CustomField(id,listId,name,type) VALUES (?,?,?,'DROPDOWN')").bind(id,listId,id),
   db.prepare("INSERT INTO CustomFieldOption(id,customFieldId,label) VALUES (?,?,'Valor')").bind(id+'-value',id),
  ]),
  db.prepare("INSERT INTO Task(id,listId,statusId,name,updatedAt,priority) VALUES ('opp-task',?,'opp-0','Test',CURRENT_TIMESTAMP,'HIGH')").bind(listId),
 ]);
 const owner={...await actor(),kind:'native' as const};
 expect(await prepareOportunidadesDashboard(db,await actor())).toBeNull();
 expect(await prepareOportunidadesDashboard(db,{...await actor('member'),kind:'native'})).toBeNull();
 const [created,repeat]=await Promise.all([prepareOportunidadesDashboard(db,owner),prepareOportunidadesDashboard(db,owner)]);
 expect(created).toBeTruthy();expect(repeat).toEqual(created);
 const {id,viewId}=created!;
 const doc=await readDashboard(db,await actor(),id);
 expect(doc.config.cards).toHaveLength(12);
 expect(doc.config.sources).toEqual([listId]);
 expect(doc.config.autoRefresh).toBe(true);
 expect(await db.prepare('SELECT listId,type FROM View WHERE id=?').bind(viewId).first()).toEqual({listId,type:'DASHBOARD'});
 expect((await call('/api/dashboards/'+id,'GET',undefined,'member')).status).toBe(403);
 const data=await dashboardDataset(db,owner,doc.config);
 expect(doc.config.cards.slice(0,6).map(card=>calculateCard(doc.config,card,data).value)).toEqual([1,0,0,0,1,0]);
 expect((await call('/api/dashboards/'+id,'PUT',{name:'Corrección',config:doc.config,revision:1})).status).toBe(200);
 await prepareOportunidadesDashboard(db,owner);
 expect((await readDashboard(db,await actor(),id)).name).toBe('Corrección');
 expect((await readDashboard(db,await actor(),id)).revision).toBe(2);
 expect((await call('/api/dashboards/'+id,'DELETE')).status).toBe(200);
 expect(await prepareOportunidadesDashboard(db,owner)).toBeNull();
});

it('moves an archived dashboard to trash while preserving its views, metadata and source tasks', async () => {
 const created = await call('/api/dashboards','POST',{name:'Delete me',sources:['l'],listId:'l'},'member');
 expect(created.status).toBe(200);
 const {id,viewId}=await created.json() as {id:string;viewId:string};
 const route='/api/dashboards/'+id;
 expect((await call(route+'/share','POST',{userId:'viewer',level:'EDIT'},'member')).status).toBe(200);
 const hub = await call('/api/dashboards','GET',undefined,'viewer');
 expect((await hub.json() as {dashboards:{id:string;canEdit:boolean;canDelete:boolean}[]}).dashboards.find(d=>d.id===id))
  .toMatchObject({canEdit:true,canDelete:false});
 expect((await call(route,'DELETE',undefined,'viewer')).status).toBe(403);
 expect((await call(route,'DELETE',undefined,'member','https://other.test')).status).toBe(403);
 const document=await readDashboard(db,await actor('member'),id);
 expect((await call(route,'PUT',{name:document.name,config:document.config,revision:document.revision,archived:true},'member')).status).toBe(200);
 await db.batch([
  db.prepare("INSERT INTO UserViewPreference(userId,viewId,updatedAt) VALUES ('member',?,0)").bind(viewId),
  db.prepare("INSERT INTO UserListPreference(userId,listId,activeViewId,updatedAt) VALUES ('member','l',?,0)").bind(viewId),
 ]);
 expect((await call(route,'DELETE',undefined,'member')).status).toBe(200);
 for(const [table,key,value] of [
  ['Dashboard','id',id],['DashboardDocument','dashboardId',id],['DashboardHistory','dashboardId',id],
  ['ResourcePolicy','resourceId',id],['ResourceGrant','resourceId',id],['View','id',viewId],
  ['UserViewPreference','viewId',viewId],
 ]) expect(await db.prepare(`SELECT 1 FROM ${table} WHERE ${key}=?`).bind(value).first()).not.toBeNull();
 expect(await db.prepare("SELECT activeViewId FROM UserListPreference WHERE userId='member' AND listId='l'").first()).toEqual({activeViewId:viewId});
 expect(await db.prepare("SELECT actorId FROM AccessAudit WHERE action='dashboard.trash' AND targetId=?").bind(id).first()).toEqual({actorId:'member'});
 expect(await db.prepare("SELECT count(*) AS total FROM Task WHERE listId='l'").first()).toEqual({total:2});
});
