"use client";
import {useState} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {toast} from 'sonner';
import {taskLink,taskPath,copyTaskText} from '@/lib/task-links';

export function useTaskLinks(listId:string,taskId:string){
 const [manual,setManual]=useState<{label:string;value:string}|null>(null);
 async function copy(kind:'link'|'id'){
  const value=kind==='link'?taskLink(window.location.origin,listId,taskId):taskId;
  const copied=await copyTaskText(value,navigator.clipboard);
  if(copied)toast.success(kind==='link'?'Vínculo copiado':'ID copiado');
  else setManual({label:kind==='link'?'Copiar vínculo':'Copiar ID',value});
 }
 return {href:taskPath(listId,taskId),copyLink:()=>void copy('link'),copyId:()=>void copy('id'),manual,closeManual:()=>setManual(null)};
}
export function TaskCopyDialog({value,onClose}:{value:{label:string;value:string}|null;onClose:()=>void}){
 return <Dialog.Root open={!!value} onOpenChange={open=>{if(!open)onClose();}}><Dialog.Portal>
  <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40"/>
  <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[min(480px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-cu-border bg-cu-panel p-5 shadow-2xl">
   <Dialog.Title className="font-semibold">{value?.label}</Dialog.Title>
   <Dialog.Description className="mt-2 text-sm text-cu-text-secondary">El navegador no permitió copiar automáticamente. Copiá el texto seleccionado con Ctrl+C o ⌘C, o mantené presionado en el teléfono.</Dialog.Description>
   <input aria-label={value?.label} readOnly value={value?.value??''} onFocus={e=>e.currentTarget.select()} className="mt-4 min-h-11 w-full rounded border border-cu-border bg-cu-bg px-3 text-sm focus-visible:outline-2 focus-visible:outline-cu-purple"/>
   <Dialog.Close className="mt-4 min-h-10 rounded border border-cu-border px-4 text-sm hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple">Cerrar</Dialog.Close>
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>;
}
