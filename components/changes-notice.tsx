"use client";
import { useEffect, useRef, useState } from 'react';
import { usePathname,useSearchParams } from 'next/navigation';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { hasDrafts } from '@/lib/drafts';
import { mutationSource } from '@/lib/api';
export function ChangesNotice(){
 const path=usePathname(),params=useSearchParams(),viewKey=params.get('panel')??params.get('view')??'',qc=useQueryClient(),writes=useIsMutating();
 const [pending,setPending]=useState(false),[visible,setVisible]=useState(false),[paused,setPaused]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const cursor=useRef<number|null>(null);
 useEffect(()=>{cursor.current=null;setPending(false);setVisible(false);setError('');let cancelled=false,inFlight=false;
  async function check(){if(document.hidden||inFlight)return;inFlight=true;try{
   const url=new URL('/api/changes',window.location.origin);url.searchParams.set('client',mutationSource());if(cursor.current!==null)url.searchParams.set('cursor',String(cursor.current));
   const panel=document.querySelector('[data-dashboard-id]')?.getAttribute('data-dashboard-id');const match=/^\/l\/([^/]+)/.exec(path);if(panel)url.searchParams.set('dashboard_id',panel);else if(match)url.searchParams.set('list_id',decodeURIComponent(match[1]));else if(path==='/dashboards')url.searchParams.set('view','dashboards');
   const response=await fetch(url);if(!response.ok)return;const data=await response.json() as {cursor:number;changed:boolean};if(cancelled)return;cursor.current=data.cursor;if(data.changed){setPending(true);setVisible(true);}
  }catch{/* Retry on the next tick without replacing the current view. */}finally{inFlight=false;}}
  void check();const timer=setInterval(check,5000);document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);
  return()=>{cancelled=true;clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('focus',check);};
 },[path,viewKey]);
 useEffect(()=>{const clear=()=>{setPending(false);setVisible(false);};window.addEventListener('sav3:dashboard-refreshed',clear);return()=>window.removeEventListener('sav3:dashboard-refreshed',clear);},[]);
 useEffect(()=>{if(!visible||paused)return;const timer=setTimeout(()=>setVisible(false),5000);return()=>clearTimeout(timer);},[visible,paused]);
 async function refresh(){
  const editing=document.activeElement as HTMLElement|null;
  if(hasDrafts()||writes>0||editing?.matches('input,textarea,[contenteditable="true"]')){setError('Terminá de editar o guardar antes de actualizar.');setVisible(true);return;}
  setBusy(true);setError('');try{
   await Promise.all([qc.invalidateQueries({queryKey:['list']}),qc.invalidateQueries({queryKey:['task']}),qc.invalidateQueries({queryKey:['my-tasks']}),qc.invalidateQueries({queryKey:['notifications']}),qc.invalidateQueries({queryKey:['dashboard-hub']})]);
   window.dispatchEvent(new Event('sav3:refresh-view'));setPending(false);setVisible(false);
  }catch{setError('No pudimos actualizar. Volvé a intentar.');}finally{setBusy(false);}
 }
 if(!pending)return null;
 return <aside aria-label="Cambios de otros usuarios" className="fixed bottom-4 right-4 z-[70] max-w-[calc(100vw-2rem)]" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setPaused(false);}}>
  {visible?<div className="w-80 rounded-xl border border-cu-border bg-cu-panel p-4 text-sm text-cu-text shadow-lg"><p role="status" aria-live="polite" className="font-semibold">Hay cambios disponibles</p><p className="mt-1 text-cu-text-secondary">Otra persona actualizó tareas de esta vista.</p>{error&&<p role="alert" className="mt-2">{error}</p>}<div className="mt-3 flex items-center gap-3"><button disabled={busy||writes>0} onClick={refresh} className="min-h-11 rounded bg-cu-purple px-4 text-white disabled:opacity-50">{busy?'Actualizando…':'Actualizar'}</button><button onClick={()=>setVisible(false)} className="min-h-11 px-2 text-cu-text-secondary">Cerrar</button></div></div>:<button onClick={()=>setVisible(true)} className="min-h-11 rounded-full border border-cu-border bg-cu-panel px-4 text-sm font-medium text-cu-purple shadow">Cambios pendientes</button>}
 </aside>;
}
