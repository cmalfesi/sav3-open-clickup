'use client';
import {useCallback,useEffect,useState} from 'react';
type Row={id:string;name:string;email:string;state:'active'|'idle'|'offline'|'unknown'|'disabled';lastSeen:number|null;lastActive:number|null};
const labels={active:'Activo',idle:'Inactivo',offline:'Desconectado',unknown:'Sin señal',disabled:'Sin acceso'};
export function PresenceSettings(){
 const [rows,setRows]=useState<Row[]|null>(null),[error,setError]=useState(''),[updated,setUpdated]=useState<number|null>(null);
 const refresh=useCallback(async()=>{try{const r=await fetch('/api/team/presence');if(!r.ok)throw new Error(r.status===403?'Solo el superadmin puede ver esta sección.':'No pudimos actualizar la presencia.');const d=await r.json() as {users:Row[];now:number};setRows(d.users);setUpdated(d.now);setError('')}catch(e){setRows(null);setError((e as Error).message)}},[]);
 useEffect(()=>{const check=()=>{if(!document.hidden)void refresh()};check();const timer=setInterval(check,30000);window.addEventListener('focus',check);return()=>{clearInterval(timer);window.removeEventListener('focus',check)}},[refresh]);
 return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Usuarios conectados</h2><button type="button" onClick={()=>void refresh()} className="min-h-11 rounded border border-cu-border px-3 text-sm focus-visible:outline-2 focus-visible:outline-cu-purple">Actualizar</button></div>
 <p className="text-sm text-cu-text-secondary">Presencia aproximada de la web, actualizada cada 30 segundos. Activo: app visible e interacción en los últimos 2 minutos. Inactivo: app abierta sin interacción reciente o en segundo plano. Desconectado: sin señal durante 90 segundos o sesión cerrada. No incluye uso por API/MCP.</p>
 <p className="text-sm text-cu-text-secondary">Sin señal indica que no hay registros recientes: la persona aún no cargó esta versión o superó la retención de 7 días. Esto no mide productividad ni demuestra atención continua.</p>
 {updated&&<p className="text-xs text-cu-text-secondary">Última consulta: {new Date(updated).toLocaleTimeString()}</p>}
 {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
 {rows?<div className="overflow-x-auto rounded border border-cu-border"><table className="w-full text-left text-sm"><thead className="bg-cu-hover"><tr>{['Usuario','Estado','Última señal','Última actividad'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-cu-border"><td className="p-3"><span className="block font-medium">{r.name}</span><span className="text-xs text-cu-text-secondary">{r.email}</span></td><td className="p-3 font-medium">{labels[r.state]}</td><td className="whitespace-nowrap p-3">{r.lastSeen?new Date(r.lastSeen).toLocaleString():'Sin datos'}</td><td className="whitespace-nowrap p-3">{r.lastActive?new Date(r.lastActive).toLocaleString():'Sin datos'}</td></tr>)}</tbody></table></div>:!error&&<p role="status" className="text-sm">Consultando presencia…</p>}
 </section>;
}
