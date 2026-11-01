"use client";
import { useEffect, useRef, useState } from 'react';
export async function accountRequest<T = {
    ok: boolean;
}>(path: string, body: unknown, method = 'POST'): Promise<T> { const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await r.json() as T & {
    error?: string;
}; if (!r.ok)
    throw new Error(data.error || 'No pudimos completar la operación.'); return data; }
const field = 'mt-1 min-h-11 w-full rounded-md border border-cu-border bg-cu-panel px-3 text-cu-text focus:outline-2 focus:outline-cu-purple';
export function LoginForm() { const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); return <form onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try {
    await accountRequest('/api/auth/login', { email, password });
    window.location.assign('/home');
}
catch (e) {
    setError((e as Error).message);
    setBusy(false);
} }} className="mt-6 space-y-4"><label className="block text-sm">Email<input className={field} required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}/></label><label className="block text-sm">Contraseña<input className={field} required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></label>{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="min-h-11 w-full rounded-md bg-cu-purple px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Ingresando…' : 'Ingresar'}</button><p className="text-xs leading-5 text-cu-text-secondary">¿Es tu primer ingreso? Abrí el enlace de invitación que te compartió el administrador. Si olvidaste tu contraseña, pedile que renueve tu acceso.</p></form>; }
export function ActivationForm() { const [secret, setSecret] = useState(''), [email, setEmail] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), started = useRef(false); useEffect(() => { if (started.current)
    return; started.current = true; const t = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''; history.replaceState(null, '', '/activate'); setSecret(t); if (!t) {
    setError('Abrí el enlace completo de invitación.');
    return;
} accountRequest<{
    email: string;
}>('/api/auth/invitation', { token: t }).then(d => setEmail(d.email)).catch(e => setError(e.message)); }, []); return <>{email ? <form className="mt-6 space-y-4" onSubmit={async (e) => { e.preventDefault(); setError(''); if (password !== confirm) {
    setError('Las contraseñas no coinciden.');
    return;
} setBusy(true); try {
    await accountRequest('/api/auth/activate', { token: secret, name, password });
    window.location.assign('/home');
}
catch (e) {
    setError((e as Error).message);
    setBusy(false);
} }}><p className="break-all rounded-md bg-cu-hover p-3 text-sm">Invitación para <strong>{email}</strong></p><label className="block text-sm">Tu nombre<input required maxLength={80} autoComplete="name" className={field} value={name} onChange={e => setName(e.target.value)}/></label><label className="block text-sm">Elegí tu contraseña<input required minLength={12} maxLength={128} autoComplete="new-password" type="password" className={field} value={password} onChange={e => setPassword(e.target.value)}/><span className="text-xs text-cu-text-secondary">Al menos 12 caracteres.</span></label><label className="block text-sm">Repetí tu contraseña<input required type="password" autoComplete="new-password" className={field} value={confirm} onChange={e => setConfirm(e.target.value)}/></label><button disabled={busy} className="min-h-11 w-full rounded-md bg-cu-purple px-4 text-white disabled:opacity-50">{busy ? 'Activando…' : 'Activar mi cuenta'}</button></form> : !error && <p className="mt-5 text-sm">Validando invitación…</p>}{error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}</>; }
export function PasswordForm() { const [password, setPassword] = useState(''), [currentPassword, setCurrent] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false); return <form className="max-w-md space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setMessage(''); try {
    await accountRequest('/api/account/password', { password, currentPassword });
    setPassword('');
    setCurrent('');
    setMessage('Contraseña guardada. Las otras sesiones se cerraron.');
}
catch (e) {
    setMessage((e as Error).message);
}
finally {
    setBusy(false);
} }}><p className="text-sm text-cu-text-secondary">Para el primer cambio del propietario podés dejar vacía la contraseña actual. Si ya tenés una contraseña, ingresala.</p><label className="block text-sm">Contraseña actual<input type="password" autoComplete="current-password" className={field} value={currentPassword} onChange={e => setCurrent(e.target.value)}/></label><label className="block text-sm">Nueva contraseña<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" className={field} value={password} onChange={e => setPassword(e.target.value)}/></label><button disabled={busy} className="min-h-11 rounded bg-cu-purple px-5 text-white disabled:opacity-50">Guardar contraseña</button>{message && <p role="status" className="text-sm">{message}</p>}</form>; }
