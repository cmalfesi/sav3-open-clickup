"use client";
import React, { useEffect, useState } from "react";

type RestoreStatus = {cursor:number;total:number;complete:boolean;error?:string};
export function RestoreGate({children,initialReady=false}:{children:React.ReactNode;initialReady?:boolean}) {
  const [ready,setReady]=useState(initialReady),[progress,setProgress]=useState(0),[error,setError]=useState('');
  useEffect(()=>{
    if(initialReady)return;
    let canceled=false;
    async function run(){
      try{
        let res=await fetch('/api/restore');let s=await res.json() as RestoreStatus;
        if(!res.ok)throw new Error(s.error||'No pudimos abrir la copia.');
        while(!s.complete&&!canceled){
          setProgress(Math.floor(100*s.cursor/s.total));
          res=await fetch('/api/restore',{method:'POST'});s=await res.json() as RestoreStatus;
          if(!res.ok)throw new Error(s.error||'No pudimos completar la importación.');
        }
        if(!canceled)setReady(true);
      }catch(e){if(!canceled)setError(e instanceof Error?e.message:'Error al abrir la copia.');}
    }
    run();return()=>{canceled=true};
  },[initialReady]);
  if(ready)return <>{children}</>;
  return <main className="flex h-screen items-center justify-center bg-cu-bg p-8"><section className="w-full max-w-lg rounded-xl border border-cu-border bg-cu-panel p-8"><span className="text-sm font-semibold text-cu-purple">SAV3 · Open ClickUp</span><h1 className="mt-4 text-2xl font-semibold">{error?'No pudimos abrir el espacio':'Preparando tu espacio de trabajo'}</h1><p className="mt-3 text-sm text-cu-text-secondary">{error||'Estamos completando la importación inicial del respaldo de ClickUp. Los cambios que hagas después se guardarán en este espacio.'}</p>{!error&&<><div className="mt-6 h-2 overflow-hidden rounded bg-cu-hover"><div className="h-2 bg-cu-purple transition-all" style={{width:progress+'%'}}/></div><p className="mt-2 text-sm">{progress}%</p></>}{error&&<a className="mt-5 inline-block text-cu-purple" href="/signin-with-chatgpt?return_to=%2F" target="_top">Ingresar con ChatGPT</a>}</section></main>;
}
