"use client";
import { useEffect, useState } from 'react';
import { accountRequest } from '@/components/account-forms';
import { useWorkspace } from '@/components/workspace-context';
type Dashboard = {
    id: string;
    name: string;
    total: number;
    done: number;
};
export default function Dashboards() { const { workspace } = useWorkspace(); const [data, setData] = useState<{
    admin: boolean;
    dashboards: Dashboard[];
} | null>(null), [name, setName] = useState(''), [source, setSource] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); const lists = workspace.spaces.flatMap(s => [...s.lists, ...s.folders.flatMap(f => f.lists)]); async function load() { const r = await fetch('/api/dashboards'); const d = await r.json() as {
    admin: boolean;
    dashboards: Dashboard[];
    error?: string;
}; if (!r.ok)
    throw new Error(d.error); setData(d); } useEffect(() => { load().catch(e => setError(e.message)); }, []); return <main className="flex-1 overflow-y-auto p-6 md:p-8"><div className="mx-auto max-w-5xl"><p className="text-xs font-semibold uppercase text-cu-purple">SAV3 · Seguimiento</p><h1 className="mt-2 text-2xl font-semibold">Dashboards</h1><p className="mt-2 text-sm text-cu-text-secondary">Resúmenes de tareas según tu acceso. Compartir el dashboard no comparte las tareas que lo alimentan.</p>{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}{data?.admin && <form className="mt-6 flex flex-wrap gap-3 rounded-xl border border-cu-border p-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    await accountRequest('/api/dashboards', { name, sources: source ? [source] : [] });
    setName('');
    await load();
}
catch (e) {
    setError((e as Error).message);
}
finally {
    setBusy(false);
} }}><input aria-label="Nombre del dashboard" required maxLength={100} placeholder="Nombre del dashboard" className="min-h-11 rounded border border-cu-border bg-cu-panel px-3 text-sm" value={name} onChange={e => setName(e.target.value)}/><select aria-label="Fuente del dashboard" className="min-h-11 max-w-full rounded border border-cu-border bg-cu-panel px-3 text-sm" value={source} onChange={e => setSource(e.target.value)}><option value="">Todas las listas visibles</option>{lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><button disabled={busy} className="min-h-11 rounded bg-cu-purple px-4 text-sm text-white disabled:opacity-50">Crear dashboard</button></form>}<div className="mt-7 grid gap-5 md:grid-cols-2">{data?.dashboards.map(d => <article id={d.id} key={d.id} className="rounded-xl border border-cu-border bg-cu-panel p-6"><h2 className="text-lg font-semibold">{d.name}</h2><dl className="mt-5 grid grid-cols-3 gap-3">{[['Visibles', d.total], ['Completadas', d.done], ['Pendientes', d.total - d.done]].map(([label, value]) => <div key={label}><dt className="text-xs text-cu-text-secondary">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl><p className="mt-5 text-xs text-cu-text-secondary">Incluye tareas y subtareas no archivadas. Completadas: estados Done y Closed.</p></article>)}</div>{data?.dashboards.length === 0 && <p className="mt-8 rounded-xl border border-dashed border-cu-border p-8 text-center text-sm text-cu-text-secondary">No hay dashboards compartidos con tu cuenta.{data.admin ? ' Creá uno y administrá sus permisos desde Configuración.' : ''}</p>}</div></main>; }
