"use client";

import {useId} from 'react';
import * as Popover from '@radix-ui/react-popover';
import {TagChip} from '@/components/ui/primitives';
import type {TaskWithRelations} from '@/lib/queries';

/** Fixed-height summary: two truncated chips and the exact remaining count. */
export function TaskTagSummary({tags}: {tags:TaskWithRelations['tags']}) {
  const titleId=useId();
  if(!tags.length)return null;
  const remaining=tags.length-2;
  return <Popover.Root>
    <Popover.Trigger asChild>
      <button type="button" aria-label={tags.length===1?'Ver la etiqueta de la tarea':`Ver las ${tags.length} etiquetas de la tarea`}
        onClick={e=>e.stopPropagation()}
        className="ml-auto flex h-6 w-[35%] max-w-[220px] shrink-0 items-center justify-end gap-1 rounded outline-none hover:bg-cu-hover focus-visible:ring-2 focus-visible:ring-cu-purple">
        {tags.slice(0,2).map(({tagId,tag})=><TagChip key={tagId} name={tag.name} color={tag.color} className="max-w-[88px] shrink"/>)}
        {remaining>0&&<span aria-hidden="true" title={tags.slice(2).map(t=>t.tag.name).join('\n')} className="inline-flex h-4 shrink-0 items-center rounded-full bg-cu-hover-strong px-1.5 text-[11px] leading-none text-cu-text-secondary">+{remaining}</span>}
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="end" sideOffset={6} aria-labelledby={titleId}
        onClick={e=>e.stopPropagation()}
        className="z-50 w-[280px] max-w-[calc(100vw-24px)] rounded-lg border border-cu-border bg-cu-panel p-3 text-cu-text shadow-lg outline-none">
        <h3 id={titleId} className="mb-2 text-sm font-semibold">Etiquetas de la tarea · {tags.length}</h3>
        <ul className="max-h-64 space-y-2 overflow-y-auto">
          {tags.map(({tagId,tag})=><li key={tagId} className="flex min-w-0 items-center gap-2 text-sm"><TagChip name={tag.name} color={tag.color} className="max-w-full h-auto min-h-4 whitespace-normal" fullName/></li>)}
        </ul>
        <p className="mt-3 border-t border-cu-border pt-2 text-xs text-cu-text-secondary">Podés modificar las etiquetas desde la tarea.</p>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
