import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { Access, type Actor, type Resource, withActor } from '@/lib/access-context';
import { teamRoute, loadActor, digest } from '@/lib/team-service';
import { authorizeResourceRequest } from '@/lib/request-access';
const require = createRequire(import.meta.url);
const { Miniflare } = require(require.resolve('miniflare', { paths: [require.resolve('wrangler')] }));
let mf: InstanceType<typeof Miniflare>, db: D1Database;
const origin = 'https://site.test';
const resources: Resource[] = [{ id: 's', type: 'SPACE' }, { id: 'l', type: 'LIST', parentId: 's', parentType: 'SPACE' }, { id: 't', type: 'TASK', parentId: 'l', parentType: 'LIST', listId: 'l' }, { id: 'hidden', type: 'TASK', parentId: 'l', parentType: 'LIST', listId: 'l' }, { id: 'd', type: 'DASHBOARD' }];
const owner: Actor = { user: { id: 'owner', email: 'owner@example.com', name: 'Owner', color: '#000000', avatarUrl: null }, role: 'OWNER', workspaceId: '90132980889', kind: 'native', access: new Access('OWNER', true, resources, []) };
async function call(path: string, body: unknown, a: Actor | null = owner, method = 'POST', cookie?: string) { const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: origin, 'CF-Connecting-IP': '127.0.0.1' }; if (cookie)
    headers.Cookie = cookie; const req = new Request(origin + path, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body) }); return (await teamRoute(req, db, a))!; }
async function invite(email: string, grants: unknown[] = [], role = 'MEMBER') { const r = await call('/api/team/invitations', { email, role, scopeAll: false, grants }); expect(r.status).toBe(200); const d = await r.json() as {
    url: string;
    id: string;
}; return { ...d, token: new URLSearchParams(new URL(d.url).hash.slice(1)).get('token')! }; }
beforeAll(async () => {
    mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}", compatibilityDate: '2026-05-15', d1Databases: { DB: 'team-test' } });
    db = await mf.getD1Database('DB');
    for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort())
        for (const sql of readFileSync('drizzle/' + file, 'utf8').split('--> statement-breakpoint'))
            if (sql.trim())
                await db.prepare(sql).run();
    await db.batch([
        db.prepare("INSERT INTO Workspace (id,name) VALUES ('90132980889','Test')"), db.prepare("INSERT INTO User (id,email,name) VALUES ('owner','owner@example.com','Owner')"), db.prepare("INSERT INTO WorkspaceMember (id,workspaceId,userId,role) VALUES ('wm','90132980889','owner','OWNER')"), db.prepare("INSERT INTO RestoreState (id,ownerKey,complete) VALUES ('backup-2026-10-30','nativeowner',1)"), db.prepare("INSERT INTO Space (id,workspaceId,name) VALUES ('s','90132980889','S')"), db.prepare("INSERT INTO List (id,spaceId,name) VALUES ('l','s','L')"), db.prepare("INSERT INTO Status (id,listId,name,type) VALUES ('st','l','Open','NOT_STARTED')"), db.prepare("INSERT INTO Task (id,listId,statusId,name,updatedAt) VALUES ('t','l','st','Allowed',CURRENT_TIMESTAMP)"), db.prepare("INSERT INTO Task (id,listId,statusId,name,updatedAt) VALUES ('hidden','l','st','Hidden',CURRENT_TIMESTAMP)"), db.prepare("INSERT INTO Attachment (id,taskId,name,url,size,mime) VALUES ('a','hidden','secret','/restored-files/secret.bin',1,'text/plain')"), db.prepare("INSERT INTO Dashboard (id,name,sources,createdBy,createdAt) VALUES ('d','D','[]','owner',0)")
    ]);
}, 30000);
afterAll(async () => { await mf?.dispose(); });
describe('invited accounts on D1', () => {
    it('creates an assignable member without credentials, session, invitation or enabled access',async()=>{
      const body={name:'  Ana Pérez  ',email:'Planning@Example.com',role:'MEMBER',scopeAll:false,grants:[]};
      const response=await call('/api/team/users',body);expect(response.status).toBe(201);
      const {id}=await response.json() as {id:string};
      expect(await db.prepare('SELECT name,email,passwordHash FROM User WHERE id=?').bind(id).first()).toEqual({name:'Ana Pérez',email:'planning@example.com',passwordHash:null});
      expect(await db.prepare('SELECT role FROM WorkspaceMember WHERE userId=?').bind(id).first()).toEqual({role:'MEMBER'});
      expect(await db.prepare('SELECT enabled,scopeAll FROM AccountAccess WHERE userId=?').bind(id).first()).toEqual({enabled:0,scopeAll:0});
      for(const table of ['Session','Invitation','IntegrationToken'])expect(await db.prepare(`SELECT count(*) n FROM ${table} WHERE userId=?`).bind(id).first()).toEqual({n:0});
      const directory=await (await call('/api/team',{},owner,'GET')).json() as {users:{id:string;enabled:number}[]};expect(directory.users.find(u=>u.id===id)?.enabled).toBe(0);
      expect((await call('/api/auth/login',{email:body.email,password:'Some-password-123'},null)).status).toBe(401);
      expect(await loadActor(db,new Request(origin+'/home',{headers:{'oai-authenticated-user-id':'planner','oai-authenticated-user-email':'planning@example.com'}}))).toBeNull();
      expect((await call('/api/team/users',body)).status).toBe(409);
      expect((await call('/api/team/users',{userId:id,enabled:true},owner,'PATCH')).status).toBe(400);
      expect((await call('/api/team/users',{userId:id,name:'Ana Pérez Gómez',role:'GUEST'},owner,'PATCH')).status).toBe(200);
      expect(await db.prepare('SELECT role FROM WorkspaceMember WHERE userId=?').bind(id).first()).toEqual({role:'GUEST'});
      expect(await db.prepare('SELECT enabled FROM AccountAccess WHERE userId=?').bind(id).first()).toEqual({enabled:0});
    });
    it('stages pending invitees immediately and preserves their identity on activation',async()=>{
      const r=await call('/api/team/invitations',{name:'Juan López',email:'pending-directory@example.com',role:'MEMBER',scopeAll:false,grants:[{resourceType:'TASK',resourceId:'t',level:'EDIT'}]});expect(r.status).toBe(200);
      const inv=await r.json() as {url:string};const pending=await db.prepare("SELECT id FROM User WHERE email='pending-directory@example.com'").first<{id:string}>();
      expect(await db.prepare('SELECT role FROM WorkspaceMember WHERE userId=?').bind(pending!.id).first()).toEqual({role:'MEMBER'});
      expect(await db.prepare('SELECT enabled FROM AccountAccess WHERE userId=?').bind(pending!.id).first()).toEqual({enabled:0});
      await db.prepare('INSERT INTO TaskAssignee(taskId,userId) VALUES(?,?)').bind('t',pending!.id).run();
      expect((await call('/api/team/users',{userId:pending!.id,name:'Juan López Correa'},owner,'PATCH')).status).toBe(200);
      const token=new URLSearchParams(new URL(inv.url).hash.slice(1)).get('token');
      expect((await call('/api/auth/activate',{token,name:'Juan López Correa',password:'Pending-password-123'},null)).status).toBe(200);
      expect(await db.prepare('SELECT userId FROM TaskAssignee WHERE taskId=? AND userId=?').bind('t',pending!.id).first()).toEqual({userId:pending!.id});
      expect(await db.prepare('SELECT enabled FROM AccountAccess WHERE userId=?').bind(pending!.id).first()).toEqual({enabled:1});
    });
    it('renames an active user without altering permissions, sessions or pending invitations',async()=>{
      const inv=await invite('profile-edit@example.com',[{resourceType:'TASK',resourceId:'t',level:'EDIT'}]);
      const activation=await call('/api/auth/activate',{token:inv.token,name:'Before name',password:'Profile-password-123'},null);
      const cookie=activation.headers.get('Set-Cookie')!.split(';')[0],request=()=>new Request(origin+'/home',{headers:{Cookie:cookie}}),before=(await loadActor(db,request()))!;
      const grantsBefore=(await db.prepare('SELECT * FROM ResourceGrant WHERE userId=?').bind(before.user.id).all()).results;
      expect((await call('/api/team/users',{userId:before.user.id,name:'After name'},owner,'PATCH')).status).toBe(200);
      const after=(await loadActor(db,request()))!;expect(after.user.name).toBe('After name');expect(after.role).toBe(before.role);expect(after.permissionRevision).not.toBe(before.permissionRevision);
      expect((await db.prepare('SELECT * FROM ResourceGrant WHERE userId=?').bind(before.user.id).all()).results).toEqual(grantsBefore);
      expect((await call('/api/team/users',{userId:before.user.id,name:'  '},owner,'PATCH')).status).toBe(400);
      expect((await call('/api/team/users',{userId:before.user.id,name:'x'.repeat(81)},owner,'PATCH')).status).toBe(400);
    });
    it('keeps pending invitations on profile/no-op edits, but revokes stale permissions on role changes',async()=>{
      const inv=await invite('pending-edit@example.com',[{resourceType:'TASK',resourceId:'t',level:'VIEW'}]);
      const {userId}= (await db.prepare('SELECT userId FROM Invitation WHERE id=?').bind(inv.id).first<{userId:string}>())!;
      const patch={userId,name:'Pending name',role:'MEMBER',scopeAll:false,grants:[{resourceType:'TASK',resourceId:'t',level:'VIEW'}]};
      expect((await call('/api/team/users',patch,owner,'PATCH')).status).toBe(200);
      expect(await db.prepare('SELECT revoked FROM Invitation WHERE id=?').bind(inv.id).first()).toEqual({revoked:0});
      expect((await call('/api/team/users',{userId,role:'GUEST'},owner,'PATCH')).status).toBe(200);
      expect(await db.prepare('SELECT revoked FROM Invitation WHERE id=?').bind(inv.id).first()).toEqual({revoked:1});
      expect((await call('/api/auth/activate',{token:inv.token,name:'Pending',password:'Pending-edit-password-123'},null)).status).toBe(410);
    });
    it('edits imported references in place and adds membership without activating their account',async()=>{
      await db.prepare("INSERT INTO User(id,email,name) VALUES('reference-person','reference@example.com','Old reference')").run();
      await db.prepare("INSERT INTO TaskAssignee(taskId,userId) VALUES('t','reference-person')").run();
      expect((await call('/api/team/users',{userId:'reference-person',name:'María García',role:'MEMBER',scopeAll:false,grants:[]},owner,'PATCH')).status).toBe(200);
      expect(await db.prepare("SELECT name FROM User WHERE id='reference-person'").first()).toEqual({name:'María García'});
      expect(await db.prepare("SELECT role FROM WorkspaceMember WHERE userId='reference-person'").first()).toEqual({role:'MEMBER'});
      expect(await db.prepare("SELECT enabled FROM AccountAccess WHERE userId='reference-person'").first()).toEqual({enabled:0});
      expect(await db.prepare("SELECT userId FROM TaskAssignee WHERE taskId='t' AND userId='reference-person'").first()).toEqual({userId:'reference-person'});
    });
    it('backfills unaccepted legacy invitees without enabling login or replacing existing members',async()=>{
      await db.batch([
        db.prepare("INSERT INTO User(id,email,name) VALUES('legacy-invite','legacy-invite@example.com','Legacy'),('expired-invite','expired-invite@example.com','Expired')"),
        db.prepare("INSERT INTO Invitation(id,tokenHash,userId,email,role,scopeAll,grants,expiresAt,createdAt,createdBy) VALUES('legacy-valid','legacy-valid','legacy-invite','legacy-invite@example.com','MEMBER',0,?, ?,0,'owner'),('legacy-expired','legacy-expired','expired-invite','expired-invite@example.com','MEMBER',0,'[]',1,0,'owner')").bind(JSON.stringify([{resourceType:'TASK',resourceId:'t',level:'VIEW'}]),Date.now()+60000),
      ]);
      for(let n=0;n<2;n++)for(const sql of readFileSync('drizzle/0013_inactive_team_directory.sql','utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
      expect(await db.prepare("SELECT role FROM WorkspaceMember WHERE userId='legacy-invite'").first()).toEqual({role:'MEMBER'});
      expect(await db.prepare("SELECT enabled FROM AccountAccess WHERE userId='legacy-invite'").first()).toEqual({enabled:0});
      expect(await db.prepare("SELECT level FROM ResourceGrant WHERE userId='legacy-invite' AND resourceId='t'").first()).toEqual({level:'VIEW'});
      expect(await db.prepare("SELECT role FROM WorkspaceMember WHERE userId='expired-invite'").first()).toBeNull();
      expect(await db.prepare("SELECT role FROM WorkspaceMember WHERE userId='owner'").first()).toEqual({role:'OWNER'});
      await db.batch([db.prepare("UPDATE Invitation SET revoked=1 WHERE id='legacy-valid'"),db.prepare("DELETE FROM ResourceGrant WHERE userId='legacy-invite'")]);
      for(const sql of readFileSync('drizzle/0013_inactive_team_directory.sql','utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
      expect(await db.prepare("SELECT level FROM ResourceGrant WHERE userId='legacy-invite'").first()).toBeNull();
    });
    it('protects user administration from anonymous, guest, member, cross-origin and admin escalation',async()=>{
      const body={name:'Protected target',email:'protected-target@example.com',role:'ADMIN',scopeAll:true,grants:[]};
      expect((await call('/api/team/users',body,null)).status).toBe(401);
      for(const role of ['GUEST','MEMBER','ADMIN'] as const){const a={...owner,role,access:new Access(role,true,resources,[])};expect((await call('/api/team/users',body,a)).status).toBe(403);}
      const foreign=new Request(origin+'/api/team/users',{method:'POST',headers:{Origin:'https://other.test'},body:JSON.stringify(body)});expect((await teamRoute(foreign,db,owner))!.status).toBe(403);
      expect((await call('/api/team/users',{userId:'owner',name:'Owner profile'},owner,'PATCH')).status).toBe(200);
      const admin={...owner,user:{...owner.user,id:'different-admin'},role:'ADMIN' as const,access:new Access('ADMIN',true,resources,[])};
      expect((await call('/api/team/users',{userId:'owner',name:'Forbidden'},admin,'PATCH')).status).toBe(403);
      expect((await call('/api/team/users',{...body,role:'OWNER'})).status).toBe(400);
    });
    it('preserves the recorded native owner and refuses other native identities',async()=>{
      const request=(id:string)=>new Request(origin+'/home',{headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':'owner@example.com'}});
      const native=await loadActor(db,request('nativeowner'));expect(native?.role).toBe('OWNER');expect(native?.kind).toBe('native');expect(await loadActor(db,request('someone-else'))).toBeNull();
    });
    it('binds one-time invitation to email, stores only hashes and creates a usable session', async () => {
        const inv = await invite('member@example.com', [{ resourceType: 'TASK', resourceId: 't', level: 'EDIT' }, { resourceType: 'DASHBOARD', resourceId: 'd', level: 'VIEW' }]);
        const record = await db.prepare('SELECT tokenHash FROM Invitation WHERE id=?').bind(inv.id).first<{
            tokenHash: string;
        }>();
        expect(record!.tokenHash).toBe(digest(inv.token));
        expect(record!.tokenHash).not.toBe(inv.token);
        const accept = await call('/api/auth/activate', { token: inv.token, password: 'A long test password 123!', name: 'Member', email: 'ignored@example.com', role: 'OWNER' }, null);
        expect(accept.status).toBe(200);
        const cookie = accept.headers.get('Set-Cookie')!.split(';')[0];
        expect(accept.headers.get('Set-Cookie')).toContain('HttpOnly');
        expect(accept.headers.get('Set-Cookie')).toContain('Secure');
        expect(accept.headers.get('Set-Cookie')).toContain('Max-Age=432000');
        const member = await loadActor(db, new Request(origin + '/home', { headers: { Cookie: cookie } }));
        expect(member!.role).toBe('MEMBER');
        expect(member!.user.email).toBe('member@example.com');
        expect(member!.access.can('TASK', 't', 'EDIT')).toBe(true);
        expect(member!.access.can('TASK', 'hidden')).toBe(false);
        expect(member!.access.visibleList('l')).toBe(true);
        const hash = await db.prepare('SELECT passwordHash FROM User WHERE id=?').bind(member!.user.id).first<{
            passwordHash: string;
        }>();
        expect(hash!.passwordHash).not.toContain('A long');
        expect((await call('/api/auth/activate', { token: inv.token, password: 'Overwrite password 123!', name: 'Bad' }, null)).status).toBe(410);
        const dash = await call('/api/dashboards', {}, member, 'GET');
        const d = await dash.json() as {
            dashboards: {
                total: number;
            }[];
        };
        expect(d.dashboards[0].total).toBe(1);
        await expect(authorizeResourceRequest(new Request(origin + '/api/tasks/hidden'), db, member!)).rejects.toMatchObject({ status: 403 });
        await expect(authorizeResourceRequest(new Request(origin + '/restored-files/secret.bin'), db, member!)).rejects.toMatchObject({ status: 403 });
        await expect(authorizeResourceRequest(new Request(origin + '/api/team'), db, member!)).rejects.toMatchObject({ status: 403 });
        expect((await call('/api/team/invitations', { email: 'bad@example.com', role: 'ADMIN', scopeAll: true, grants: [] }, member)).status).toBe(403);
        const login = await call('/api/auth/login', { email: 'member@example.com', password: 'A long test password 123!' }, null);
        expect(login.status).toBe(200);
        const wrong = await call('/api/auth/login', { email: 'member@example.com', password: 'Wrong password 123!' }, null);
        expect(wrong.status).toBe(401);
        const logout = await call('/api/auth/logout', {}, member);
        expect(logout.status).toBe(200);
        expect(await loadActor(db, new Request(origin + '/home', { headers: { Cookie: cookie } }))).toBeNull();
        const logged = await loadActor(db, new Request(origin + '/home', { headers: { Cookie: login.headers.get('Set-Cookie')!.split(';')[0] } }));
        const revoke = await call('/api/team/users', { userId: member!.user.id, enabled: false, role: 'MEMBER', scopeAll: false, grants: [] }, owner, 'PATCH');
        expect(revoke.status).toBe(200);
        expect(await loadActor(db, new Request(origin + '/home', { headers: { Cookie: login.headers.get('Set-Cookie')!.split(';')[0] } }))).toBeNull();
        expect(logged).not.toBeNull();
        expect((await call('/api/auth/login', { email: 'member@example.com', password: 'A long test password 123!' }, null)).status).toBe(401);
    });
    it('rejects revoked, expired, weak-password and cross-origin activations', async () => { const inv = await invite('revoked@example.com'); expect((await call('/api/auth/activate', { token: inv.token, password: 'short', name: 'X' }, null)).status).toBe(400); await call('/api/team/invitations/revoke', { id: inv.id }); expect((await call('/api/auth/invitation', { token: inv.token }, null)).status).toBe(410); const expired = await invite('expired@example.com'); await db.prepare('UPDATE Invitation SET expiresAt=0 WHERE id=?').bind(expired.id).run(); expect((await call('/api/auth/invitation', { token: expired.token }, null)).status).toBe(410); const response = await teamRoute(new Request(origin + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: '{}' }), db, null); expect(response!.status).toBe(403); });
    it('permits only one concurrent redemption and does not overwrite the winner', async () => { const inv = await invite('race@example.com'); const responses = await Promise.all(['First password 123!', 'Second password 123!'].map(password => call('/api/auth/activate', { token: inv.token, password, name: 'Race' }, null))); expect(responses.map(r => r.status).sort()).toEqual([200, 410]); });
    it('throttles login guessing without revealing whether an account exists', async () => { const statuses = []; for (let i = 0; i < 13; i++)
        statuses.push((await call('/api/auth/login', { email: 'missing@example.com', password: 'wrong' }, null)).status); expect(statuses.slice(0, 12)).toEqual(Array(12).fill(401)); expect(statuses[12]).toBe(429); });
    it('lets only the owner generate a password, revokes credentials and preserves permissions',async()=>{
      const invitation=await invite('reset-target@example.com');
      const activated=await call('/api/auth/activate',{token:invitation.token,password:'Original-password-123',name:'Reset target'},null);
      const cookie=activated.headers.get('Set-Cookie')!.split(';')[0];
      const target=(await loadActor(db,new Request(origin+'/home',{headers:{Cookie:cookie}})))!;
      const before=await db.prepare('SELECT enabled,scopeAll FROM AccountAccess WHERE userId=?').bind(target.user.id).first();
      await db.prepare('INSERT INTO IntegrationToken(id,userId,name,tokenHash,scope,createdAt,expiresAt) VALUES(?,?,?,?,?,?,?)').bind('reset-api',target.user.id,'Test',digest('test-key'),'write',Date.now(),Date.now()+60000).run();
      await db.prepare('INSERT INTO PasswordRecovery(tokenHash,userId,expiresAt) VALUES(?,?,?)').bind(digest('reset-link'),target.user.id,Date.now()+60000).run();
      const body={userId:target.user.id};
      expect((await call('/api/team/users/reset-password',body,null)).status).toBe(401);
      expect((await call('/api/team/users/reset-password',body,target)).status).toBe(403);
      const admin={...owner,role:'ADMIN' as const,access:new Access('ADMIN',true,resources,[])};
      expect((await call('/api/team/users/reset-password',body,admin)).status).toBe(403);
      expect((await call('/api/team/users/reset-password',body,{...owner,kind:'token'})).status).toBe(403);
      const foreign=new Request(origin+'/api/team/users/reset-password',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(body)});
      expect((await teamRoute(foreign,db,owner))!.status).toBe(403);
      const reset=await call('/api/team/users/reset-password',body);expect(reset.status).toBe(200);
      const {password}=await reset.json() as {password:string};expect(password.length).toBe(24);expect(reset.headers.get('Cache-Control')).toContain('no-store');
      expect(await loadActor(db,new Request(origin+'/home',{headers:{Cookie:cookie}}))).toBeNull();
      expect((await call('/api/auth/login',{email:'reset-target@example.com',password:'Original-password-123'},null)).status).toBe(401);
      expect((await call('/api/auth/login',{email:'reset-target@example.com',password},null)).status).toBe(200);
      expect(await db.prepare('SELECT enabled,scopeAll FROM AccountAccess WHERE userId=?').bind(target.user.id).first()).toEqual(before);
      expect(await db.prepare("SELECT revoked FROM IntegrationToken WHERE id='reset-api'").first()).toEqual({revoked:1});
      expect((await db.prepare('SELECT usedAt FROM PasswordRecovery WHERE userId=?').bind(target.user.id).first<{usedAt:number}>())!.usedAt).toBeGreaterThan(0);
      const audit=await db.prepare("SELECT actorId,targetId FROM AccessAudit WHERE action='user.password.reset'").first();expect(audit).toEqual({actorId:'owner',targetId:target.user.id});expect(JSON.stringify(audit)).not.toContain(password);
    });
    it('applies grants and role changes to an existing session, but revokes it when the account is disabled',async()=>{
      const invitation=await invite('live-access@example.com',[{resourceType:'TASK',resourceId:'t',level:'EDIT'}]);
      const activated=await call('/api/auth/activate',{token:invitation.token,password:'Live-access-password-123',name:'Live member'},null);
      const cookie=activated.headers.get('Set-Cookie')!.split(';')[0];
      const request=()=>new Request(origin+'/home',{headers:{Cookie:cookie}});
      const initial=(await loadActor(db,request()))!;expect(initial.access.can('TASK','t','EDIT')).toBe(true);
      const body={userId:initial.user.id,enabled:true,role:'GUEST',scopeAll:false,grants:[{resourceType:'TASK',resourceId:'t',level:'VIEW'}]};
      expect((await call('/api/team/users',body,owner,'PATCH')).status).toBe(200);
      const limited=(await loadActor(db,request()))!;expect(limited).not.toBeNull();expect(limited.role).toBe('GUEST');expect(limited.access.can('TASK','t','EDIT')).toBe(false);expect(limited.access.can('TASK','t')).toBe(true);expect(limited.permissionRevision).not.toBe(initial.permissionRevision);
      expect((await call('/api/team/users',{...body,role:'MEMBER',grants:[{resourceType:'LIST',resourceId:'l',level:'EDIT'}]},owner,'PATCH')).status).toBe(200);
      const expanded=(await loadActor(db,request()))!;expect(expanded.access.can('TASK','hidden','EDIT')).toBe(true);
      expect((await call('/api/team/users',{...body,enabled:false},owner,'PATCH')).status).toBe(200);expect(await loadActor(db,request())).toBeNull();
    });
    it('protects owner and prevents administrators from promoting peers', async () => { expect((await call('/api/team/users', { userId: 'owner', enabled: false, role: 'MEMBER', scopeAll: false, grants: [] }, owner, 'PATCH')).status).toBe(403); const admin = { ...owner, role: 'ADMIN' as const, access: new Access('ADMIN', true, resources, []) }; expect((await call('/api/team/invitations', { email: 'escalate@example.com', role: 'ADMIN', scopeAll: true, grants: [] }, admin)).status).toBe(403); });
});
describe('inherited access boundaries', () => {
    it('inherits through space/list/task, handles private boundaries and explicit exclusions', () => { const access = new Access('MEMBER', false, resources, [{ resourceType: 'SPACE', resourceId: 's', level: 'EDIT' }, { resourceType: 'TASK', resourceId: 'hidden', level: 'NONE' }]); expect(access.can('TASK', 't', 'EDIT')).toBe(true); expect(access.can('TASK', 'hidden')).toBe(false); const privateAccess = new Access('MEMBER', true, resources, [{ resourceType: 'TASK', resourceId: 't', level: 'COMMENT' }], ['LIST:l']); expect(privateAccess.can('TASK', 't', 'COMMENT')).toBe(true); expect(privateAccess.can('TASK', 't', 'EDIT')).toBe(false); expect(privateAccess.can('TASK', 'hidden')).toBe(false); });
    it('caps guest permissions and rejects writes, cross-list moves and hidden cascade deletions', async () => { const guest = { ...owner, role: 'GUEST' as const, kind: 'local' as const, access: new Access('GUEST', false, resources, [{ resourceType: 'TASK', resourceId: 't', level: 'EDIT' }]) }; expect(guest.access.level('TASK', 't')).toBe('VIEW'); await expect(authorizeResourceRequest(new Request(origin + '/api/tasks/t/comments', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Comment' }) }), db, guest)).rejects.toMatchObject({ status: 403 }); const member = { ...owner, role: 'MEMBER' as const, access: new Access('MEMBER', false, resources, [{ resourceType: 'LIST', resourceId: 'l', level: 'EDIT' }, { resourceType: 'TASK', resourceId: 'hidden', level: 'NONE' }]) }; await expect(authorizeResourceRequest(new Request(origin + '/api/lists/l', { method: 'DELETE', headers: { Origin: origin } }), db, member)).rejects.toMatchObject({ status: 403 }); });
    it('never shares another request actor context', async () => { expect(() => withActor(owner, () => owner.access.assert('TASK', 'hidden'))).not.toThrow(); });
});
