"use client";
import { useEffect, useState } from 'react';
import { accountRequest, PasswordForm } from '@/components/account-forms';
import { ConnectionsSettings } from "@/components/connections-settings";
import type { Grant, Resource, Role } from '@/lib/access-context';
type Member = {
    id: string;
    name: string;
    email: string;
    role: Role | null;
    enabled: number;
    scopeAll: number;
};
type Invitation = {
    id: string;
    email: string;
    role: Role;
    expiresAt: number;
    revoked: number;
    accepted: number;
};
type Team = {
    now: number;
    role: Role;
    currentUserId: string;
    users: Member[];
    resources: Resource[];
    grants: (Grant & {
        userId: string;
    })[];
    policies: {
        resourceType: string;
        resourceId: string;
        restricted: number;
    }[];
    invitations: Invitation[];
};
const input = 'min-h-11 rounded-md border border-cu-border bg-cu-panel px-3 text-sm text-cu-text focus:outline-2 focus:outline-cu-purple';
const button = 'min-h-11 rounded-md bg-cu-purple px-4 text-sm font-medium text-white disabled:opacity-50';
const roleNames: Record<string, string> = { OWNER: 'Propietario', ADMIN: 'Administrador', MEMBER: 'Miembro', GUEST: 'Invitado' };
export default function Settings() {
    const [tab, setTab] = useState('users'), [team, setTeam] = useState<Team | null>(null), [admin, setAdmin] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [email, setEmail] = useState(''), [role, setRole] = useState('MEMBER'), [scopeAll, setScopeAll] = useState(false), [grants, setGrants] = useState<Grant[]>([]), [editing, setEditing] = useState<Member | null>(null), [delivery, setDelivery] = useState<{
        url: string;
        email: string;
    } | null>(null), [filter, setFilter] = useState('');
    async function refresh() { const me = await fetch('/api/team/me').then(r => r.json()) as {
        admin: boolean;
    }; setAdmin(me.admin); if (me.admin) {
        const r = await fetch('/api/team');
        const d = await r.json() as Team & {
            error?: string;
        };
        if (!r.ok)
            throw new Error(d.error);
        setTeam(d);
    }
    else
        setTab('account'); }
    useEffect(() => { refresh().catch(e => setError(e.message)); }, []);
    function reset() { setEditing(null); setEmail(''); setRole('MEMBER'); setScopeAll(false); setGrants([]); setMessage(''); }
    function edit(u: Member) { setEditing(u); setEmail(u.email); setRole(u.role === 'ADMIN' ? 'ADMIN' : u.role === 'GUEST' ? 'GUEST' : 'MEMBER'); setScopeAll(!!u.scopeAll); setGrants(team!.grants.filter(g => g.userId === u.id).map(({ resourceType, resourceId, level }) => ({ resourceType, resourceId, level }))); setDelivery(null); setTab('users'); window.scrollTo(0, 0); }
    async function operation(fn: () => Promise<void>) { setBusy(true); setError(''); setMessage(''); try {
        await fn();
        await refresh();
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <main className="flex-1 overflow-y-auto p-5 md:p-8"><div className="mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase tracking-wide text-cu-purple">SAV3 · Administración</p><h1 className="mt-2 text-2xl font-semibold">Configuración</h1><p className="mt-2 text-sm text-cu-text-secondary">Gestioná el ingreso y el acceso a tu equipo.</p><nav aria-label="Secciones de configuración" className="my-6 flex flex-wrap gap-2 border-b border-cu-border pb-3">{(admin ? [['users', 'Usuarios'], ['permissions', 'Privacidad de recursos'], ['account', 'Mi cuenta'], ['connections', 'Conexiones LLM']] : [['account', 'Mi cuenta'], ['connections', 'Conexiones LLM']]).map(([id, label]) => <button key={id} onClick={() => { setTab(id); setError(''); }} className={`${input} ${tab === id ? 'font-semibold text-cu-purple bg-cu-hover' : ''}`}>{label}</button>)}</nav>{error && <p role="alert" className="mb-4 rounded border border-red-300 p-3 text-sm text-red-600">{error}</p>}{message && <p role="status" className="mb-4 rounded bg-cu-hover p-3 text-sm">{message}</p>}
    {tab === 'connections' && <ConnectionsSettings />}
    {tab === 'account' && <><h2 className="mb-4 text-lg font-semibold">Tu contraseña</h2><PasswordForm /></>}
        {tab === 'users' && team && <><section className="rounded-xl border border-cu-border bg-cu-panel p-5"><h2 className="text-lg font-semibold">{editing ? 'Editar acceso' : 'Invitar a una persona'}</h2><p className="mt-2 text-sm leading-6 text-cu-text-secondary">Propietario y administrador gestionan el espacio completo. Miembro puede editar según sus permisos. Invitado solo puede ver. Asignar una tarea a alguien no le concede acceso automáticamente.</p><form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); operation(async () => { if (editing) {
            await accountRequest('/api/team/users', { userId: editing.id, enabled: !!editing.enabled, role, scopeAll, grants }, 'PATCH');
            setMessage('Permisos guardados. Se cerraron las sesiones anteriores.');
        }
        else {
            const d = await accountRequest<{
                url: string;
                email: string;
            }>('/api/team/invitations', { email, role, scopeAll, grants });
            setDelivery(d);
            setMessage('Invitación creada. Compartí el enlace para que la persona elija su contraseña.');
        } setEditing(null); setEmail(''); setRole('MEMBER'); setScopeAll(false); setGrants([]); }); }}><div className="grid gap-4 md:grid-cols-2"><label className="flex flex-col gap-1 text-sm">Email<input required type="email" disabled={!!editing} className={input} value={email} onChange={e => setEmail(e.target.value)}/></label><label className="flex flex-col gap-1 text-sm">Rol<select className={input} value={role} onChange={e => setRole(e.target.value)}>{team.role === 'OWNER' && <option value="ADMIN">Administrador</option>}<option value="MEMBER">Miembro</option><option value="GUEST">Invitado (solo lectura)</option></select></label></div><label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={scopeAll} onChange={e => setScopeAll(e.target.checked)} className="mt-1"/><span>Acceso general a recursos no privados<span className="mt-1 block text-xs text-cu-text-secondary">Si está desactivado, solo accede a los recursos compartidos abajo. Los administradores siempre tienen acceso completo.</span></span></label><GrantEditor resources={team.resources} grants={grants} onChange={setGrants}/><div className="flex gap-2"><button disabled={busy} className={button}>{busy ? 'Guardando…' : editing ? 'Guardar permisos' : 'Crear invitación'}</button>{editing && <button type="button" className={input} onClick={reset}>Cancelar edición</button>}</div></form></section>
        {delivery && <section className="my-5 rounded-xl border border-cu-purple bg-cu-hover p-5"><h2 className="font-semibold">Invitación creada · todavía no enviada</h2><p className="mt-2 break-all text-sm">Para {delivery.email}. Vence en 7 días y se utiliza una sola vez.</p><label className="mt-3 block text-sm">Enlace de activación<input aria-label="Enlace de activación" readOnly value={delivery.url} className={`${input} mt-1 w-full`} onFocus={e => e.target.select()}/></label><div className="mt-3 flex flex-wrap gap-3"><button className={button} onClick={() => navigator.clipboard.writeText(delivery.url).then(() => setMessage('Enlace copiado.')).catch(() => setMessage('Seleccioná y copiá el enlace de arriba.'))}>Copiar enlace</button><a className={`${input} inline-flex items-center`} href={`mailto:${encodeURIComponent(delivery.email)}?subject=${encodeURIComponent('Tu invitación a SAV3 Open ClickUp')}&body=${encodeURIComponent('Te invito al equipo SAV3. Abrí este enlace y elegí tu contraseña (vence en 7 días):\n\n' + delivery.url)}`}>Enviar desde mi correo</a><button className={input} onClick={() => setDelivery(null)}>Ocultar enlace</button></div><p className="mt-3 text-xs leading-5 text-cu-text-secondary">El sitio no envía emails automáticamente. El enlace es privado: compartilo solo con la persona indicada. Se muestra únicamente al crearlo.</p></section>}
        <section className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Usuarios y referencias del backup</h2><input aria-label="Buscar usuario" placeholder="Buscar por nombre o email" className={input} value={filter} onChange={e => setFilter(e.target.value)}/></div><div className="mt-3 overflow-x-auto rounded-lg border border-cu-border"><table className="w-full text-left text-sm"><thead className="bg-cu-hover"><tr><th className="p-3">Persona</th><th className="p-3">Rol</th><th className="p-3">Acceso</th><th className="p-3">Acciones</th></tr></thead><tbody>{team.users.filter(u => (u.name + ' ' + u.email).toLowerCase().includes(filter.toLowerCase())).map(u => <tr key={u.id} className="border-t border-cu-border"><td className="p-3"><span className="block font-medium">{u.name}</span><span className="break-all text-xs text-cu-text-secondary">{u.email}</span></td><td className="p-3">{u.role ? roleNames[u.role] : 'Referencia'}</td><td className="p-3">{u.enabled ? 'Activo' : team.invitations.some(i => i.email === u.email && !i.accepted && !i.revoked && i.expiresAt > team.now) ? 'Invitación pendiente' : 'Sin acceso'}</td><td className="p-3">{u.role === 'OWNER' || u.id === team.currentUserId ? <span className="text-xs text-cu-text-secondary">Cuenta protegida</span> : u.role === 'ADMIN' && team.role !== 'OWNER' ? null : u.enabled ? <div className="flex gap-2"><button className={input} onClick={() => edit(u)}>Permisos</button><button disabled={busy} className={input} onClick={() => operation(async () => { await accountRequest('/api/team/users', { userId: u.id, enabled: false, role: u.role, scopeAll: !!u.scopeAll, grants: team.grants.filter(g => g.userId === u.id) }, 'PATCH'); setMessage('Acceso revocado.'); })}>Revocar</button></div> : <button className={input} onClick={() => { reset(); setEmail(u.email); setDelivery(null); }}>Invitar</button>}</td></tr>)}</tbody></table></div></section>
        <section className="mt-7"><h2 className="text-lg font-semibold">Invitaciones</h2><div className="mt-3 space-y-2">{team.invitations.length === 0 ? <p className="text-sm text-cu-text-secondary">Todavía no creaste invitaciones.</p> : team.invitations.map(i => <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-cu-border p-3 text-sm"><span className="min-w-0 flex-1 break-all">{i.email} · {roleNames[i.role]}</span><span>{i.accepted ? 'Activada' : i.revoked ? 'Revocada' : i.expiresAt < team.now ? 'Vencida' : 'Pendiente · envío manual'}</span>{!i.accepted && !i.revoked && <button className={input} disabled={busy} onClick={() => operation(async () => { await accountRequest('/api/team/invitations/revoke', { id: i.id }); })}>Revocar invitación</button>}</div>)}</div></section></>}
    {tab === 'permissions' && team && <Privacy team={team} busy={busy} apply={(body) => operation(async () => { await accountRequest('/api/team/policy', body); setMessage('Privacidad guardada.'); })}/>}
    </div></main>;
}
function GrantEditor({ resources, grants, onChange }: {
    resources: Resource[];
    grants: Grant[];
    onChange: (g: Grant[]) => void;
}) { const [type, setType] = useState<Grant['resourceType']>('SPACE'), [search, setSearch] = useState(''), [resourceId, setId] = useState(''), [level, setLevel] = useState<Grant['level']>('VIEW'); const filtered = resources.filter(r => r.type === type && (r.name + ' ' + r.id).toLowerCase().includes(search.toLowerCase())); return <fieldset className="rounded-lg border border-cu-border p-4"><legend className="px-2 text-sm font-semibold">Permisos directos</legend><p className="mb-3 text-xs leading-5 text-cu-text-secondary">Se heredan de espacio a lista y tarea. Un permiso directo reemplaza el heredado. «Sin acceso» excluye ese recurso. Un dashboard nunca da acceso a tareas ocultas.</p><div className="grid gap-2 sm:grid-cols-2"><select aria-label="Tipo de recurso" value={type} className={input} onChange={e => { setType(e.target.value as Grant['resourceType']); setId(''); }}><option value="SPACE">Espacio</option><option value="LIST">Lista</option><option value="TASK">Tarea</option><option value="DASHBOARD">Dashboard</option></select><input aria-label="Buscar recurso" placeholder="Buscar recurso" className={input} value={search} onChange={e => setSearch(e.target.value)}/><select aria-label="Recurso" value={resourceId} className={`${input} min-w-0`} onChange={e => setId(e.target.value)}><option value="">Elegí un recurso</option>{filtered.map(r => <option key={r.id} value={r.id}>{r.name} · {r.id}</option>)}</select><select aria-label="Nivel de permiso" value={level} className={input} onChange={e => setLevel(e.target.value as Grant['level'])}><option value="VIEW">Ver</option><option value="COMMENT">Comentar</option><option value="EDIT">Editar</option><option value="NONE">Sin acceso</option></select></div><button type="button" disabled={!resourceId} className={`${input} mt-3 disabled:opacity-40`} onClick={() => { onChange([...grants.filter(g => !(g.resourceId === resourceId && g.resourceType === type)), { resourceType: type, resourceId, level }]); setId(''); }}>Agregar permiso</button><ul className="mt-3 space-y-2">{grants.map(g => <li key={g.resourceType + g.resourceId} className="flex items-center gap-2 rounded bg-cu-hover p-2 text-sm"><span className="min-w-0 flex-1 break-words">{resources.find(r => r.type === g.resourceType && r.id === g.resourceId)?.name ?? g.resourceId} · {g.resourceType} · {({ VIEW: 'Ver', COMMENT: 'Comentar', EDIT: 'Editar', NONE: 'Sin acceso' })[g.level]}</span><button type="button" className={input} onClick={() => onChange(grants.filter(x => x !== g))}>Quitar</button></li>)}</ul></fieldset>; }
function Privacy({ team, busy, apply }: {
    team: Team;
    busy: boolean;
    apply: (body: unknown) => void;
}) { const [id, setId] = useState(''); const resource = team.resources.find(r => r.type + ':' + r.id === id); const restricted = !!team.policies.find(p => p.resourceType === resource?.type && p.resourceId === resource?.id && p.restricted); return <section className="max-w-2xl space-y-4"><h2 className="text-lg font-semibold">Recursos privados</h2><p className="text-sm leading-6 text-cu-text-secondary">Un recurso privado deja de heredar permisos del nivel superior. Solo acceden las personas con permiso directo en ese recurso o sus hijos, además de administradores y propietario.</p><label className="block text-sm">Recurso<select className={`${input} mt-2 w-full`} value={id} onChange={e => setId(e.target.value)}><option value="">Elegí un recurso</option>{team.resources.map(r => <option key={r.type + r.id} value={r.type + ':' + r.id}>{r.type} · {r.name}</option>)}</select></label>{resource && <><p className="text-sm">Estado actual: <strong>{restricted ? 'Privado' : 'Hereda permisos'}</strong></p><button disabled={busy} className={button} onClick={() => apply({ resourceType: resource.type, resourceId: resource.id, restricted: !restricted })}>{restricted ? 'Volver a heredar permisos' : 'Hacer privado'}</button></>}</section>; }
