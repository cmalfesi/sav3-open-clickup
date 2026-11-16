"use client";
import {useEffect,useState,useSyncExternalStore} from "react";
import {useIsMutating} from "@tanstack/react-query";
import {Check,LoaderCircle,TriangleAlert,X} from "lucide-react";
import {writeSnapshot,serverWriteSnapshot,subscribeWrites,dismissWriteError} from "@/lib/write-status";

/** Above every task/settings dialog; no modal overlay or invented percentage. */
export function WriteFeedback(){
  const state=useSyncExternalStore(subscribeWrites,writeSnapshot,serverWriteSnapshot);
  const mutations=useIsMutating();
  const busy=state.pending>0||mutations>0;
  const [hiddenRevision,setHiddenRevision]=useState(0),[slowSince,setSlowSince]=useState(0);
  const saved=!busy&&!state.error&&state.revision>hiddenRevision;
  const slow=busy&&state.startedAt>0&&slowSince===state.startedAt;
  useEffect(()=>{
    if(!busy)return;
    const timer=setTimeout(()=>setSlowSince(state.startedAt),8000);
    return ()=>clearTimeout(timer);
  },[busy,state.startedAt]);
  useEffect(()=>{
    if(busy||!state.revision)return;
    const timer=setTimeout(()=>setHiddenRevision(state.revision),2500);
    return ()=>clearTimeout(timer);
  },[busy,state.revision]);
  if(!busy&&!saved&&!state.error)return null;
  return <div className="fixed bottom-4 left-4 z-[110] flex max-w-[min(440px,calc(100vw-2rem))] items-start gap-2 rounded-lg border border-cu-border bg-cu-panel px-3 py-2 text-[13px] text-cu-text shadow-lg">
    <span aria-hidden="true" className="mt-0.5 shrink-0">{busy?<LoaderCircle className="h-4 w-4 animate-spin text-cu-purple motion-reduce:animate-none"/>:state.error?<TriangleAlert className="h-4 w-4 text-cu-urgent"/>:<Check className="h-4 w-4 text-cu-purple"/>}</span>
    <span role={state.error&&!busy?'alert':'status'} aria-live={state.error&&!busy?'assertive':'polite'}>
      {busy?(slow?'El guardado sigue en curso. No hace falta volver a enviarlo.':'Guardando cambios…'):state.error?'No se pudo confirmar un cambio: '+state.error:'Cambios guardados'}
    </span>
    {!busy&&state.error&&<button type="button" aria-label="Cerrar aviso de guardado" onClick={dismissWriteError} className="rounded p-0.5 hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple"><X className="h-4 w-4"/></button>}
  </div>;
}
