'use client';
import {useEffect,useRef} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {mutationSource} from '@/lib/api';
import {hasDrafts} from '@/lib/drafts';

export function LiveAccessMonitor({revision}:{revision?:string}){
 const qc=useQueryClient(),router=useRouter(),path=usePathname(),params=useSearchParams();
 const baseline=useRef(revision),location=useRef({path,task:params.get('task')}),pending=useRef(false);
 useEffect(()=>{location.current={path,task:params.get('task')}},[path,params]);
 useEffect(()=>{
  let stopped=false,inFlight=false,lastInput=Date.now();const controller=new AbortController();
  if(!baseline.current&&revision)baseline.current=revision;
  const active=()=>{lastInput=Date.now()};
  async function poll(){
   if(inFlight||stopped)return;inFlight=true;
   try{
    const resources:{type:'LIST'|'TASK'|'DASHBOARD';id:string}[]=[];
    const current=location.current,match=/^\/l\/([^/]+)/.exec(current.path);
    if(match)resources.push({type:'LIST',id:decodeURIComponent(match[1])});
    if(current.task)resources.push({type:'TASK',id:current.task});
    const dashboard=document.querySelector('[data-dashboard-id]')?.getAttribute('data-dashboard-id');
    if(dashboard)resources.push({type:'DASHBOARD',id:dashboard});
    const r=await fetch('/api/presence',{method:'POST',signal:controller.signal,keepalive:document.hidden,headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:mutationSource(),visible:!document.hidden,idleMs:Math.min(86400000,Math.max(0,Date.now()-lastInput)),resources})});
    if(stopped)return;
    if(r.status===401){await qc.cancelQueries();qc.removeQueries();toast.info('Tu sesión terminó o se revocó el acceso. Iniciá sesión para continuar.');router.replace('/login');return;}
    if(!r.ok)return;
    const result=await r.json() as {revision?:string;denied:unknown[]};
    if(stopped)return;
    const changed=!!baseline.current&&!!result.revision&&baseline.current!==result.revision;
    baseline.current=result.revision;
    if(result.denied.length){await qc.cancelQueries();qc.removeQueries();toast.info('Tus permisos cambiaron. Ya no tenés acceso al recurso abierto.');router.replace('/home');router.refresh();return;}
    if(changed){
     await qc.cancelQueries();qc.removeQueries({type:'inactive'});
     await qc.invalidateQueries({queryKey:['bootstrap']});
     window.dispatchEvent(new Event('sav3-access-changed'));
     pending.current=true;
     toast.info(hasDrafts()?'Tus permisos cambiaron. El contenido se actualizará cuando termines tus borradores.':'Tus permisos se actualizaron. Tu sesión sigue abierta.');
    }
    if(pending.current&&!hasDrafts()&&!qc.isMutating()){pending.current=false;await qc.invalidateQueries();}
   }catch{/* Offline is not logout. The server still validates each write. */}
   finally{inFlight=false;}
  }
  const focus=()=>{active();void poll()};
  const visibility=()=>{void poll()};
  for(const event of ['pointerdown','keydown','touchstart','scroll'])window.addEventListener(event,active,{passive:true,capture:true});
  window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);
  void poll();const timer=setInterval(()=>void poll(),30000);
  return ()=>{stopped=true;controller.abort();clearInterval(timer);for(const event of ['pointerdown','keydown','touchstart','scroll'])window.removeEventListener(event,active,true);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',visibility)};
 },[qc,router,revision]);
 return null;
}
