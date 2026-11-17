"use client";

import {useRef,useState,type ReactNode,type HTMLAttributes,type RefObject} from 'react';
import {columnLayout,columnWidth,type TaskColumn} from '@/lib/column-widths';
import {useColumnWidths} from './personal-view';

export function useTaskColumnLayout(columns:TaskColumn[]){
 const {widths,setWidth}=useColumnWidths();
 // Only the transient drag lives locally. One preference write on release.
 const [draft,setDraft]=useState<{id:string;width:number}|null>(null);
 const effective=draft?{...widths,[draft.id]:draft.width}:widths;
 const layout=columnLayout(columns,effective);
 return {...layout,widths:effective,preview:(id:string,width:number)=>setDraft({id,width}),
  cancel:()=>setDraft(null),commit:(id:string,width:number)=>{setWidth(id,width);setDraft(null);}};
}

type Layout=ReturnType<typeof useTaskColumnLayout>;
type Drag={pointerId:number;x:number;width:number};
export function columnResizeHandlers(column:TaskColumn,width:number,layout:Pick<Layout,'preview'|'commit'|'cancel'>,drag:RefObject<Drag|null>):HTMLAttributes<HTMLDivElement>{
 const reset=()=>layout.commit(column.id,column.width);
 return {
   onClick:e=>e.stopPropagation(),onDoubleClick:e=>{e.stopPropagation();reset();},
   onPointerDown:e=>{
    if(e.button!==0||drag.current)return;e.preventDefault();e.stopPropagation();
    e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);
    drag.current={pointerId:e.pointerId,x:e.clientX,width};
   },
   onPointerMove:e=>{const start=drag.current;if(!start||e.pointerId!==start.pointerId)return;
    layout.preview(column.id,columnWidth(column,start.width+e.clientX-start.x));
   },
   onPointerUp:e=>{const start=drag.current;if(!start||e.pointerId!==start.pointerId)return;
    drag.current=null;layout.commit(column.id,columnWidth(column,start.width+e.clientX-start.x));
    e.currentTarget.releasePointerCapture(e.pointerId);
   },
   onPointerCancel:()=>{drag.current=null;layout.cancel();},
   onLostPointerCapture:()=>{if(drag.current){drag.current=null;layout.cancel();}},
   onKeyDown:e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();drag.current=null;layout.cancel();return;}
    if(drag.current)return;
    if(e.key==='Home'){e.preventDefault();e.stopPropagation();reset();}
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();e.stopPropagation();
     layout.commit(column.id,columnWidth(column,width+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?50:10)));
    }
   },
 };
}
export function ResizableColumnHeader({column,layout,children,className=''}:{column:TaskColumn;layout:Layout;children?:ReactNode;className?:string}){
 const drag=useRef<Drag|null>(null);
 const width=columnWidth(column,layout.widths[column.id]);
 // The factory only creates event callbacks; no ref is read during rendering.
 // eslint-disable-next-line react-hooks/refs
 const handlers=columnResizeHandlers(column,width,layout,drag);
 return <div className={`group/column relative flex h-full min-w-0 items-center ${className}`}>
  <div className="min-w-0 flex-1 truncate pr-3">{children??column.label}</div>
  <div role="separator" tabIndex={0} aria-orientation="vertical"
   aria-label={`Ajustar ancho de ${column.label}`} aria-valuemin={column.min} aria-valuemax={column.max} aria-valuenow={width} aria-valuetext={`${width} píxeles`}
   title="Arrastrá para ajustar. Flechas: 10 px; Shift: 50 px. Inicio o doble clic: restablecer. Escape: cancelar."
   className="absolute -right-3 top-0 z-20 flex h-full w-6 touch-none cursor-col-resize items-center justify-center outline-none focus-visible:bg-cu-purple-light focus-visible:ring-2 focus-visible:ring-cu-purple"
   {...handlers}>
   <span aria-hidden="true" className="h-4 w-px bg-cu-border group-hover/column:bg-cu-purple group-focus-within/column:bg-cu-purple"/>
  </div>
 </div>;
}
