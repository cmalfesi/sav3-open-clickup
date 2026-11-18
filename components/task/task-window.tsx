"use client";
import {Expand,Shrink} from 'lucide-react';
export function taskWindowClass(expanded:boolean){
 const base='fixed z-50 flex flex-col overflow-hidden bg-cu-panel shadow-2xl outline-none ';
 return base+(expanded?'inset-0 h-[100dvh] w-full rounded-none':'left-1/2 top-1/2 h-[88dvh] w-[min(1080px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl');
}
export function TaskExpandButton({expanded,onToggle}:{expanded:boolean;onToggle:()=>void}){
 const label=expanded?'Restaurar tamaño de la tarea':'Ampliar tarea';
 return <button type="button" aria-label={label} title={label} aria-pressed={expanded} onClick={onToggle}
  className="rounded p-1.5 text-cu-text-tertiary hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple">
  {expanded?<Shrink className="h-4 w-4"/>:<Expand className="h-4 w-4"/>}
 </button>;
}
