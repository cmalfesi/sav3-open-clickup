"use client";

import {ArrowUpLeft} from "lucide-react";
import type {TaskDetail} from "@/lib/queries";

/** The server supplies a parent only when the current user can read it. */
export function ParentTaskLink({parentId,parent,onOpenTask}:{
  parentId:string|null;
  parent:TaskDetail['parent'];
  onOpenTask?:(id:string,listId?:string)=>void;
}){
  if(!parentId)return null;
  if(!parent)return <div className="shrink-0 border-b border-cu-border px-4 py-2 text-xs text-cu-text-tertiary">Tarea padre no disponible</div>;
  return <nav aria-label="Jerarquía de la tarea" className="shrink-0 border-b border-cu-border px-4 py-1.5">
    <a href={`/l/${encodeURIComponent(parent.listId)}?task=${encodeURIComponent(parent.id)}`}
      aria-label={`Volver a la tarea padre: ${parent.name}`} title={parent.name}
      onClick={event=>{
        if(!onOpenTask||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
        event.preventDefault();onOpenTask(parent.id,parent.listId);
      }}
      className="flex min-h-11 min-w-0 md:min-h-8 items-center gap-2 rounded px-1 text-[13px] text-cu-text-secondary hover:bg-cu-hover hover:text-cu-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cu-purple">
      <ArrowUpLeft aria-hidden="true" className="h-4 w-4 shrink-0"/>
      <span className="shrink-0 text-cu-text-tertiary">Tarea padre:</span>
      <span className="min-w-0 truncate font-medium">{parent.name}</span>
    </a>
  </nav>;
}
