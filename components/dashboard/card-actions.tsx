"use client";
import * as Menu from '@radix-ui/react-dropdown-menu';
import { ArrowDown,ArrowUp,Copy,Ellipsis,Filter,GripVertical,Maximize2,RefreshCw,Settings2,Trash2 } from 'lucide-react';
import { filterCount } from '@/lib/dashboard-presentation';
import type { DashboardCard } from '@/lib/dashboard-model';

const item='flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs outline-none focus:bg-cu-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-40';
export function CardActions({card,editing,canEdit,busy,canDuplicate,first,last,updatedAt,onRefresh,onExpand,onConfigure,onFilters,onDuplicate,onRemove,onMove}:{
 card:DashboardCard;editing:boolean;canEdit:boolean;busy:boolean;canDuplicate:boolean;first:boolean;last:boolean;updatedAt:string;
 onRefresh:()=>void;onExpand:()=>void;onConfigure:()=>void;onFilters:()=>void;onDuplicate:()=>void;onRemove:()=>void;onMove:(direction:number)=>void;
}){
 const count=filterCount(card.filter);
 return <div className="dashboard-card-actions flex shrink-0 items-center gap-0.5">
  {editing&&<span className="dashboard-drag inline-flex h-7 w-6 cursor-grab items-center justify-center rounded" title="Arrastrar tarjeta" aria-hidden="true"><GripVertical size={15}/></span>}
  <button type="button" className="dashboard-icon-button gap-1" aria-label={`Filtros de ${card.title}${count?`: ${count} activos`:''}`} title={count?`${count} filtros activos`:'Filtros de la tarjeta'} onClick={onFilters}><Filter size={14}/>{count>0&&<span className="text-[10px]">{count}</span>}</button>
  <Menu.Root><Menu.Trigger asChild><button type="button" className="dashboard-icon-button" aria-label={'Opciones de '+card.title} title="Opciones de tarjeta"><Ellipsis size={17}/></button></Menu.Trigger>
  <Menu.Portal><Menu.Content side="bottom" align="end" sideOffset={4} collisionPadding={8} className="z-[90] w-56 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto rounded-lg border border-cu-border bg-cu-panel p-1 text-cu-text shadow-lg">
   <Menu.Item className={item} disabled={busy||editing} onSelect={onRefresh}><RefreshCw size={14}/><span>Actualizar<span className="mt-0.5 block text-[10px] text-cu-text-secondary">{editing?'Disponible al terminar de editar':`Última carga: ${new Date(updatedAt).toLocaleTimeString('es-AR')}`}</span></span></Menu.Item>
   <Menu.Item className={item} onSelect={onExpand}><Maximize2 size={14}/>Ampliar tarjeta</Menu.Item>
   {canEdit&&<><Menu.Item className={item} disabled={busy} onSelect={onConfigure}><Settings2 size={14}/>Ajustes</Menu.Item>
    <Menu.Separator className="my-1 h-px bg-cu-border"/>
    <Menu.Item className={item} disabled={busy||!canDuplicate} onSelect={onDuplicate}><Copy size={14}/>Duplicar{!canDuplicate&&<span className="text-[10px]">(máximo 40)</span>}</Menu.Item>
    {editing&&<><Menu.Item className={item} disabled={first||busy} onSelect={()=>onMove(-1)}><ArrowUp size={14}/>Mover antes</Menu.Item><Menu.Item className={item} disabled={last||busy} onSelect={()=>onMove(1)}><ArrowDown size={14}/>Mover después</Menu.Item></>}
    <Menu.Item className={`${item} text-cu-urgent`} disabled={busy} onSelect={onRemove}><Trash2 size={14}/>Eliminar tarjeta</Menu.Item>
   </>}
  </Menu.Content></Menu.Portal></Menu.Root>
 </div>;
}
