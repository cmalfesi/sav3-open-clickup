"use client";

import { useRef, useState } from "react";
import { AlertDialog } from "radix-ui";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Ellipsis, Trash2 } from "lucide-react";

export function DeleteViewMenu({ name, dashboard, onDelete, onDuplicate, onRename, onSave }: {
  name: string;
  dashboard: boolean;
  onDelete?: () => Promise<void>;
  onDuplicate?:()=>void;onRename?:()=>void;onSave?:()=>void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openingConfirmation = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await onDelete?.();
      setConfirming(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button ref={trigger} type="button" aria-label={`Opciones de vista: ${name}`}
            className="flex min-h-9 min-w-9 items-center justify-center rounded text-cu-text-secondary hover:bg-cu-hover">
            <Ellipsis size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="end" sideOffset={4}
            onCloseAutoFocus={event => {
              if (openingConfirmation.current) event.preventDefault();
              openingConfirmation.current = false;
            }}
            className="z-50 rounded-lg border border-cu-border bg-cu-panel p-1 shadow-lg">
            {onDuplicate&&<DropdownMenu.Item onSelect={()=>{openingConfirmation.current=true;onDuplicate();}} className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-cu-hover">Duplicar vista</DropdownMenu.Item>}
            {onRename&&<DropdownMenu.Item onSelect={()=>{openingConfirmation.current=true;onRename();}} className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-cu-hover">Renombrar vista</DropdownMenu.Item>}
            {onSave&&<DropdownMenu.Item onSelect={onSave} className="cursor-pointer rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-cu-hover">Guardar configuración como referencia compartida</DropdownMenu.Item>}
            {onDelete&&<DropdownMenu.Item onSelect={() => {
              openingConfirmation.current = true;
              setError("");
              setConfirming(true);
            }} className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm text-cu-urgent outline-none data-[highlighted]:bg-cu-hover">
              <Trash2 size={15} /> Eliminar vista
            </DropdownMenu.Item>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <AlertDialog.Root open={confirming} onOpenChange={open => { if (!busy) setConfirming(open); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/35" />
          <AlertDialog.Content
            onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}
            onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
            className="fixed inset-x-3 top-[15vh] z-[81] mx-auto max-h-[75vh] max-w-md overflow-y-auto rounded-xl border border-cu-border bg-cu-panel p-5 text-cu-text shadow-xl">
            <AlertDialog.Title className="break-words text-lg font-semibold">¿Eliminar la vista «{name}»?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-cu-text-secondary">
              {dashboard ? "Se quita la pestaña de esta lista. El dashboard queda disponible en Dashboards." : "Se elimina la pestaña para todos los usuarios de esta lista."} Las tareas se conservan.
            </AlertDialog.Description>
            {error && <p role="alert" className="mt-3 text-sm text-cu-urgent">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <AlertDialog.Cancel disabled={busy} className="min-h-10 rounded border border-cu-border px-3 text-sm hover:bg-cu-hover">Cancelar</AlertDialog.Cancel>
              <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-10 rounded border border-cu-border px-3 text-sm text-cu-urgent hover:bg-cu-hover">
                {busy ? "Eliminando…" : "Eliminar vista"}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
