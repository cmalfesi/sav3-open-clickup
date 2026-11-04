"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export function ViewTaskSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => { if (open) input.current?.focus(); }, [open]);
  function close() {
    onChange("");
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div className="flex min-w-0 items-center gap-1" onKeyDown={event => {
      if (event.key !== "Escape" || !open) return;
      event.stopPropagation();
      close();
    }}>
      <button type="button" ref={trigger} aria-label="Buscar en esta vista" title="Buscar en esta vista"
        aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => open ? close() : setOpen(true)}
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple">
        <Search size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="flex min-w-0 items-center rounded-md border border-cu-border bg-cu-panel focus-within:border-cu-purple">
          <input ref={input} type="search" aria-label="Título de la tarea en esta vista" placeholder="Buscar por título"
            maxLength={200} value={value} onChange={event => onChange(event.target.value)}
            className="h-9 w-32 min-w-0 px-2 text-sm text-cu-text outline-none sm:w-44" />
          <button type="button" aria-label="Cerrar búsqueda" onClick={close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
