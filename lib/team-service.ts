import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { Access, AccessError, type Actor, type Grant, type Resource, type Role } from "./access-context";
import { hashPassword, verifyPassword } from "./password";
const WORKSPACE = "90132980889";
const SESSION_SECONDS = 12 * 60 * 60;
export const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("hex");
export const cookieName = (req: Request) => new URL(req.url).protocol === "https:" ? "__Host-sav3_session" : "sav3_session";
function cookieToken(req: Request) { return req.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith(cookieName(req) + "="))?.split("=")[1]; }
export const sessionCookie = (req: Request, value: string, age = SESSION_SECONDS) => `${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol === "https:" ? "; Secure" : ""}`;
const userColumns = "u.id,u.email,u.name,u.color,u.avatarUrl";
type User = Actor["user"];
async function rows<T>(db: D1Database, sql: string, ...args: (string | number)[]) { return (await db.prepare(sql).bind(...args).all<T>()).results; }
function graphStatements(db: D1Database) {
    return [
        db.prepare('SELECT id,name FROM Space'),
        db.prepare('SELECT id,name,spaceId FROM List'),
        db.prepare('SELECT id,name,listId,parentId FROM Task'),
        db.prepare('SELECT id,name FROM Dashboard'),
    ];
}
function graphFromResults(results: D1Result[]): Resource[] {
    const spaces = results[0].results as {id:string;name:string}[];
    const lists = results[1].results as {id:string;name:string;spaceId:string}[];
    const tasks = results[2].results as {id:string;name:string;listId:string;parentId:string|null}[];
    const dashboards = results[3].results as {id:string;name:string}[];
    return [...spaces.map(r=>({...r,type:"SPACE" as const})),
        ...lists.map(r=>({...r,type:"LIST" as const,parentId:r.spaceId,parentType:"SPACE" as const})),
        ...tasks.map(r=>({...r,type:"TASK" as const,parentId:r.parentId??r.listId,parentType:r.parentId?"TASK" as const:"LIST" as const})),
        ...dashboards.map(r=>({...r,type:"DASHBOARD" as const}))];
}
export async function resourceGraph(db: D1Database): Promise<Resource[]> {
    return graphFromResults(await db.batch(graphStatements(db)));
}
export async function loadActor(db: D1Database, req: Request): Promise<Actor | null> {
    let user: User | null = null, role: Role = "GUEST", scopeAll = false, kind: Actor["kind"] = "native", sessionId: string | undefined;
    let tokenScope: Actor["tokenScope"];
    const authorization = req.headers.get("Authorization");
    if(authorization) {
        const path=new URL(req.url).pathname;
        if(!(path==='/mcp'||path==='/api/integrations/mcp'||/^\/api\/(tasks|comments|lists|search)(\/|$)/.test(path)))return null;
        const bearer = /^Bearer (sav3_[a-f0-9]{64})$/.exec(authorization)?.[1];
        if(!bearer)return null;
        const linked=await db.prepare(`SELECT ${userColumns},m.role,a.scopeAll,t.scope FROM IntegrationToken t JOIN User u ON u.id=t.userId JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? WHERE t.tokenHash=? AND t.revoked=0 AND t.expiresAt>?`).bind(WORKSPACE,digest(bearer),Date.now()).first<User & {role:Role;scopeAll:number;scope:"read"|"write"}>();
        if(!linked)return null;
        user=linked;role=linked.role;scopeAll=!!linked.scopeAll;kind="token";tokenScope=linked.scope;
    }
    const raw = !user ? cookieToken(req) : undefined;
    if (raw && /^[a-f0-9]{64}$/.test(raw)) {
        sessionId = digest(raw);
        const local = await db.prepare(`SELECT ${userColumns},m.role,a.scopeAll FROM Session s JOIN User u ON u.id=s.userId JOIN AccountAccess a ON a.userId=u.id JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? WHERE s.id=? AND s.expiresAt>? AND a.enabled=1`).bind(WORKSPACE, sessionId, new Date().toISOString()).first<User & {
            role: Role;
            scopeAll: number;
        }>();
        if (local) {
            user = local;
            role = local.role;
            scopeAll = !!local.scopeAll;
            kind = "local";
        }
    }
    if (!user) {
        const id = req.headers.get("oai-authenticated-user-id"), email = req.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
        if (!id || !email)
            return null;
        const state = await db.prepare('SELECT ownerKey,complete FROM RestoreState WHERE id=?').bind('backup-2026-10-30').first<{
            ownerKey: string;
            complete: number;
        }>();
        if (!state?.complete)return null;
        if(state.ownerKey!==id) {
            const linked=await db.prepare(`SELECT ${userColumns},m.role,a.scopeAll FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? WHERE lower(u.email)=? AND u.passwordHash IS NOT NULL`).bind(WORKSPACE,email).first<User & {role:Role;scopeAll:number}>();
            if(!linked || linked.role==="OWNER")return null;
            user=linked;role=linked.role;scopeAll=!!linked.scopeAll;
        }
        if(!user) {
        // The existing Site owner is the only native identity that can bootstrap.
        user = await db.prepare(`SELECT ${userColumns},a.enabled,a.scopeAll FROM User u JOIN WorkspaceMember m ON m.userId=u.id LEFT JOIN AccountAccess a ON a.userId=u.id WHERE m.workspaceId=? AND m.role='OWNER' AND lower(u.email)=?`).bind(WORKSPACE, email).first<User & {enabled:number|null;scopeAll:number|null}>();
        if (!user) {
            const userId = "site_" + id;
            await db.batch([
                db.prepare('INSERT OR IGNORE INTO User (id,email,name,color) VALUES (?,?,?,?)').bind(userId, email, email, "#7b68ee"),
                db.prepare("INSERT INTO WorkspaceMember (id,workspaceId,userId,role) VALUES (?,?,(SELECT id FROM User WHERE lower(email)=?),'OWNER') ON CONFLICT(workspaceId,userId) DO UPDATE SET role='OWNER'").bind(randomUUID(), WORKSPACE, email)
            ]);
            user = await db.prepare(`SELECT ${userColumns} FROM User u WHERE lower(email)=?`).bind(email).first<User>();
        }
        role = "OWNER";
        scopeAll = true;
        sessionId = undefined;
        if ((user as User & {enabled?:number;scopeAll?:number}).enabled !== 1 || (user as User & {scopeAll?:number}).scopeAll !== 1) await db.prepare('INSERT INTO AccountAccess (userId,enabled,scopeAll) VALUES (?,1,1) ON CONFLICT(userId) DO UPDATE SET enabled=1,scopeAll=1').bind(user!.id).run();
        }
    }
    // Fresh authorization snapshot in one round trip; never cache grants across requests.
    const accessRows = await db.batch([...graphStatements(db),
        db.prepare('SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=?').bind(user!.id),
        db.prepare('SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1'),
    ]);
    const resources = graphFromResults(accessRows);
    const grants = accessRows[4].results as Grant[];
    const policies = accessRows[5].results as {resourceType:string;resourceId:string}[];
    const safeUser = { id: user!.id, email: user!.email, name: user!.name, color: user!.color, avatarUrl: user!.avatarUrl };
    const clientId = req.headers.get("x-sav3-client") ?? "";
    return { tokenScope, clientId: /^[a-f0-9-]{36}$/i.test(clientId) ? clientId : undefined, user: safeUser, role, workspaceId: WORKSPACE, kind, sessionId, access: new Access(role, scopeAll, resources, grants, policies.map(p => `${p.resourceType}:${p.resourceId}`)) };
}
async function audit(db: D1Database, a: Actor, action: string, target: string) { await db.prepare('INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt) VALUES (?,?,?,?,?)').bind(randomUUID(), a.user.id, action, target, Date.now()).run(); }
async function throttle(db: D1Database, key: string, limit = 12) {
    const now = Date.now();
    const row = await db.prepare('INSERT INTO AuthThrottle (key,count,resetAt) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resetAt<? THEN 1 ELSE count+1 END,resetAt=CASE WHEN resetAt<? THEN ? ELSE resetAt END RETURNING count').bind(digest(key), now + 900000, now, now, now + 900000).first<{
        count: number;
    }>();
    if ((row?.count ?? 100) > limit)
        throw new AccessError(429, "Demasiados intentos. Volvé a probar en 15 minutos.");
}
const passwordSchema = z.string().min(12, "La contraseña debe tener al menos 12 caracteres.").max(128);
const grantSchema = z.object({ resourceType: z.enum(["SPACE", "LIST", "TASK", "DASHBOARD"]), resourceId: z.string().min(1), level: z.enum(["NONE", "VIEW", "COMMENT", "EDIT"]) });
const accessSchema = z.object({ role: z.enum(["ADMIN", "MEMBER", "GUEST"]), scopeAll: z.boolean(), grants: z.array(grantSchema).max(200) });
function validate<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success)
    throw new AccessError(400, result.error.issues.map(i => i.message).join(" ")); return result.data; }
function manage(a: Actor) { if (!a.access.admin)
    throw new AccessError(403, "Solo administradores y propietario pueden gestionar usuarios."); }
function validateAccess(a: Actor, data: z.infer<typeof accessSchema>) {
    if (data.role === "ADMIN" && a.role !== "OWNER")
        throw new AccessError(403, "Solo el propietario puede designar administradores.");
    const seen = new Set<string>();
    for (const g of data.grants) {
        const k = g.resourceType + ":" + g.resourceId;
        if (seen.has(k) || !a.access.resources(g.resourceType).some(r => r.id === g.resourceId))
            throw new AccessError(400, "Recurso inexistente o permiso duplicado.");
        seen.add(k);
    }
}
async function newSession(db: D1Database, req: Request, userId: string) {
    const raw = token();
    await db.prepare('INSERT INTO Session (id,userId,expiresAt) VALUES (?,?,?)').bind(digest(raw), userId, new Date(Date.now() + SESSION_SECONDS * 1000).toISOString()).run();
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(req, raw) } });
}
const publicEndpoints = new Set(["/api/auth/login", "/api/auth/invitation", "/api/auth/activate"]);
export const isPublicAuth = (path: string) => publicEndpoints.has(path);
export async function teamRoute(req: Request, db: D1Database, a: Actor | null): Promise<Response | null> {
    const path = new URL(req.url).pathname;
    if (!isPublicAuth(path) && !path.startsWith('/api/team') && path !== '/api/auth/logout' && path !== '/api/account/password' && path !== '/api/dashboards')
        return null;
    try {
        if (req.method !== "GET" && req.method !== "HEAD") {
            const origin = req.headers.get("Origin");
            if (origin !== new URL(req.url).origin && !(a?.kind === "native" && !origin && !isPublicAuth(path)))
                throw new AccessError(403, "Origen de la solicitud no permitido.");
            if (Number(req.headers.get('Content-Length') ?? 0) > 100000)
                throw new AccessError(413, "Solicitud demasiado grande.");
        }
        const body = req.method === "GET" ? {} : await req.json().catch(() => { throw new AccessError(400, "Solicitud inválida."); });
        if (isPublicAuth(path)) {
            if (req.method !== "POST")
                throw new AccessError(405, "Método no permitido.");
            const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown';
            await throttle(db, 'ip:' + ip, 60);
            if (path === '/api/auth/login') {
                const { email, password } = validate(z.object({ email: z.string().email().max(254), password: z.string().max(128) }), body);
                await throttle(db, 'email:' + email.trim().toLowerCase());
                const user = await db.prepare('SELECT u.id,u.passwordHash FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? WHERE lower(u.email)=?').bind(WORKSPACE, email.trim().toLowerCase()).first<{
                    id: string;
                    passwordHash: string | null;
                }>();
                // Equal work for unknown and disabled accounts.
                const fallback = "00000000000000000000000000000000:" + "00".repeat(64);
                const ok = verifyPassword(password, user?.passwordHash ?? fallback);
                if (!user || !ok)
                    throw new AccessError(401, "Email o contraseña incorrectos.");
                return newSession(db, req, user.id);
            }
            const data = validate(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: passwordSchema.optional(), name: z.string().trim().min(1).max(80).optional() }), body);
            const invite = await db.prepare('SELECT * FROM Invitation WHERE tokenHash=? AND revoked=0 AND accepted IS NULL AND expiresAt>?').bind(digest(data.token), Date.now()).first<{
                id: string;
                userId: string;
                email: string;
                role: Role;
                scopeAll: number;
                grants: string;
            }>();
            if (!invite)
                throw new AccessError(410, "La invitación venció, fue revocada o ya se utilizó. Pedile una nueva al administrador.");
            if (path === '/api/auth/invitation')
                return Response.json({ email: invite.email });
            if (!data.password || !data.name)
                throw new AccessError(400, "Completá tu nombre y elegí tu contraseña.");
            const hash = hashPassword(data.password), nonce = token(), sid = token();
            const condition = 'EXISTS(SELECT 1 FROM Invitation WHERE id=? AND accepted=?)';
            const writes = [
                db.prepare('UPDATE Invitation SET accepted=? WHERE id=? AND accepted IS NULL AND revoked=0 AND expiresAt>?').bind(nonce, invite.id, Date.now()),
                db.prepare(`UPDATE User SET passwordHash=?,name=? WHERE id=? AND ${condition}`).bind(hash, data.name, invite.userId, invite.id, nonce),
                db.prepare(`INSERT INTO WorkspaceMember (id,workspaceId,userId,role) SELECT ?,?,?,? WHERE ${condition} ON CONFLICT(workspaceId,userId) DO UPDATE SET role=excluded.role`).bind(randomUUID(), WORKSPACE, invite.userId, invite.role, invite.id, nonce),
                db.prepare(`INSERT INTO AccountAccess (userId,enabled,scopeAll) SELECT ?,1,? WHERE ${condition} ON CONFLICT(userId) DO UPDATE SET enabled=1,scopeAll=excluded.scopeAll`).bind(invite.userId, invite.scopeAll, invite.id, nonce),
                db.prepare(`DELETE FROM ResourceGrant WHERE userId=? AND ${condition}`).bind(invite.userId, invite.id, nonce),
                db.prepare(`DELETE FROM Session WHERE userId=? AND ${condition}`).bind(invite.userId, invite.id, nonce),
            ];
            for (const g of JSON.parse(invite.grants) as Grant[])
                writes.push(db.prepare(`INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) SELECT ?,?,?,? WHERE ${condition}`).bind(invite.userId, g.resourceType, g.resourceId, g.level, invite.id, nonce));
            writes.push(db.prepare(`INSERT INTO Session (id,userId,expiresAt) SELECT ?,?,? WHERE ${condition}`).bind(digest(sid), invite.userId, new Date(Date.now() + SESSION_SECONDS * 1000).toISOString(), invite.id, nonce));
            const result = await db.batch(writes);
            if (!result[0].meta.changes)
                throw new AccessError(410, "Esta invitación ya no está disponible.");
            return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(req, sid) } });
        }
        if (!a)
            throw new AccessError(401, "Iniciá sesión.");
        if (path === '/api/auth/logout') {
            if (req.method !== "POST")
                throw new AccessError(405, "Método no permitido.");
            if (a.sessionId)
                await db.prepare('DELETE FROM Session WHERE id=?').bind(a.sessionId).run();
            return Response.json({ ok: true, redirectTo: a.kind === 'native' ? '/signout-with-chatgpt?return_to=%2Flogin' : '/login' }, { headers: { 'Set-Cookie': sessionCookie(req, '', 0) } });
        }
        if (path === '/api/account/password') {
            if (req.method !== "POST")
                throw new AccessError(405, "Método no permitido.");
            const data = validate(z.object({ password: passwordSchema, currentPassword: z.string().max(128).optional() }), body);
            const current = await db.prepare('SELECT passwordHash FROM User WHERE id=?').bind(a.user.id).first<{
                passwordHash: string | null;
            }>();
            if (current?.passwordHash && !verifyPassword(data.currentPassword ?? '', current.passwordHash))
                throw new AccessError(400, "La contraseña actual no coincide.");
            await db.batch([db.prepare('UPDATE User SET passwordHash=? WHERE id=?').bind(hashPassword(data.password), a.user.id), db.prepare('DELETE FROM Session WHERE userId=?').bind(a.user.id)]);
            return newSession(db, req, a.user.id);
        }
        if (path === '/api/dashboards') {
            if (req.method === 'POST') {
                manage(a);
                const data = validate(z.object({ name: z.string().trim().min(1).max(100), sources: z.array(z.string()).max(100) }), body);
                for (const id of data.sources)
                    a.access.assert('LIST', id);
                const id = randomUUID();
                await db.prepare('INSERT INTO Dashboard (id,name,sources,createdBy,createdAt) VALUES (?,?,?,?,?)').bind(id, data.name, JSON.stringify(data.sources), a.user.id, Date.now()).run();
                await audit(db, a, 'dashboard.create', id);
                return Response.json({ id });
            }
            if (req.method !== 'GET')
                throw new AccessError(405, "Método no permitido.");
            const all = await rows<{
                id: string;
                name: string;
                sources: string;
            }>(db, 'SELECT id,name,sources FROM Dashboard');
            const tasks = await rows<{
                id: string;
                listId: string;
                type: string;
            }>(db, 'SELECT t.id,t.listId,s.type FROM Task t JOIN Status s ON s.id=t.statusId WHERE t.archived=0');
            return Response.json({ admin: a.access.admin, dashboards: all.filter(d => a.access.can('DASHBOARD', d.id)).map(d => { const sources = JSON.parse(d.sources) as string[]; const visible = tasks.filter(t => a.access.can('TASK', t.id) && (!sources.length || sources.includes(t.listId))); return { id: d.id, name: d.name, total: visible.length, done: visible.filter(t => t.type === 'DONE' || t.type === 'CLOSED').length }; }) });
        }
        if (path === '/api/team/me')
            return Response.json({ role: a.role, admin: a.access.admin, kind: a.kind });
        manage(a);
        if (path === '/api/team' && req.method === 'GET') {
            const [users, invitations, grants, policies] = await Promise.all([
                rows(db, `SELECT ${userColumns},m.role,coalesce(a.enabled,0) enabled,coalesce(a.scopeAll,0) scopeAll FROM User u LEFT JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? LEFT JOIN AccountAccess a ON a.userId=u.id ORDER BY u.name`, WORKSPACE),
                rows(db, 'SELECT id,email,role,expiresAt,revoked,accepted IS NOT NULL accepted FROM Invitation ORDER BY createdAt DESC'), rows(db, 'SELECT * FROM ResourceGrant'), rows(db, 'SELECT * FROM ResourcePolicy')
            ]);
            return Response.json({ role: a.role, currentUserId: a.user.id, users, invitations, grants, policies, resources: await resourceGraph(db), now: Date.now() });
        }
        if (path === '/api/team/invitations' && req.method === 'POST') {
            const data = validate(accessSchema.extend({ email: z.string().trim().email().max(254) }), body);
            validateAccess(a, data);
            const email = data.email.toLowerCase();
            const existing = await db.prepare('SELECT u.id,coalesce(a.enabled,0) enabled,m.role FROM User u LEFT JOIN AccountAccess a ON a.userId=u.id LEFT JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? WHERE lower(u.email)=?').bind(WORKSPACE, email).first<{
                id: string;
                enabled: number;
                role: string;
            }>();
            if (existing?.enabled || existing?.role === 'OWNER' || (existing?.role === 'ADMIN' && a.role !== 'OWNER'))
                throw new AccessError(409, "Esta cuenta ya tiene acceso. Modificala desde Usuarios. Para reactivar una cuenta, usá una nueva invitación.");
            const uid = existing?.id ?? randomUUID(), id = randomUUID(), raw = token(), expiresAt = Date.now() + 7 * 86400000;
            await db.batch([
                db.prepare('INSERT OR IGNORE INTO User (id,email,name) VALUES (?,?,?)').bind(uid, email, email),
                db.prepare('UPDATE Invitation SET revoked=1 WHERE userId=? AND accepted IS NULL').bind(uid),
                db.prepare('INSERT INTO Invitation (id,tokenHash,userId,email,role,scopeAll,grants,expiresAt,createdAt,createdBy) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, digest(raw), uid, email, data.role, data.scopeAll ? 1 : 0, JSON.stringify(data.grants), expiresAt, Date.now(), a.user.id)
            ]);
            await audit(db, a, 'invitation.create', id);
            return Response.json({ id, url: new URL('/activate', req.url).href + '#token=' + raw, email, expiresAt, sent: false });
        }
        if (path === '/api/team/invitations/revoke' && req.method === 'POST') {
            const { id } = validate(z.object({ id: z.string() }), body);
            if (a.role !== 'OWNER') {
                const invitation = await db.prepare('SELECT role FROM Invitation WHERE id=?').bind(id).first<{
                    role: string;
                }>();
                if (invitation?.role === 'ADMIN')
                    throw new AccessError(403, 'Solo el propietario puede revocar esta invitación.');
            }
            await db.prepare('UPDATE Invitation SET revoked=1 WHERE id=? AND accepted IS NULL').bind(id).run();
            await audit(db, a, 'invitation.revoke', id);
            return Response.json({ ok: true });
        }
        if (path === '/api/team/users' && req.method === 'PATCH') {
            const data = validate(accessSchema.extend({ userId: z.string(), enabled: z.boolean() }), body);
            validateAccess(a, data);
            const target = await db.prepare('SELECT role FROM WorkspaceMember WHERE userId=? AND workspaceId=?').bind(data.userId, WORKSPACE).first<{
                role: string;
            }>();
            if (!target)
                throw new AccessError(400, "Invitá a esta persona para darle acceso.");
            if (target.role === 'OWNER' || (target.role === 'ADMIN' && a.role !== 'OWNER') || data.userId === a.user.id)
                throw new AccessError(403, "No podés modificar esta cuenta.");
            const writes = [db.prepare('UPDATE WorkspaceMember SET role=? WHERE userId=? AND workspaceId=?').bind(data.role, data.userId, WORKSPACE), db.prepare('UPDATE AccountAccess SET enabled=?,scopeAll=? WHERE userId=?').bind(data.enabled ? 1 : 0, data.scopeAll ? 1 : 0, data.userId), db.prepare('DELETE FROM ResourceGrant WHERE userId=?').bind(data.userId), db.prepare('DELETE FROM Session WHERE userId=?').bind(data.userId), db.prepare('UPDATE Invitation SET revoked=1 WHERE userId=? AND accepted IS NULL').bind(data.userId)];
            for (const g of data.grants)
                writes.push(db.prepare('INSERT INTO ResourceGrant (userId,resourceType,resourceId,level) VALUES (?,?,?,?)').bind(data.userId, g.resourceType, g.resourceId, g.level));
            await db.batch(writes);
            await audit(db, a, 'user.access', data.userId);
            return Response.json({ ok: true });
        }
        if (path === '/api/team/policy' && req.method === 'POST') {
            const data = validate(z.object({ resourceType: grantSchema.shape.resourceType, resourceId: z.string(), restricted: z.boolean() }), body);
            a.access.assert(data.resourceType, data.resourceId);
            await db.prepare('INSERT INTO ResourcePolicy (resourceType,resourceId,restricted) VALUES (?,?,?) ON CONFLICT(resourceType,resourceId) DO UPDATE SET restricted=excluded.restricted').bind(data.resourceType, data.resourceId, data.restricted ? 1 : 0).run();
            await audit(db, a, 'resource.privacy', data.resourceType + ':' + data.resourceId);
            return Response.json({ ok: true });
        }
        throw new AccessError(404, "Ruta no disponible.");
    }
    catch (e) {
        if (e instanceof AccessError)
            return Response.json({ error: e.message }, { status: e.status });
        console.error('[team] request failed', e instanceof Error ? e.name : 'unknown');
        return Response.json({ error: 'No pudimos completar la operación.' }, { status: 500 });
    }
}
