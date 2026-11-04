"use client";

import { useState } from "react";
import { AlertDialog } from "radix-ui";
import { apiSend } from "@/lib/api";
import { control } from "./filters";

const danger = `${control} text-cu-urgent`;

export function DeleteDashboard({ id, name, onDeleted }: {
  id: string;
  name: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await apiSend(`/api/dashboards/${encodeURIComponent(id)}`, "DELETE");
      onDeleted();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root onOpenChange={() => setError("")}>
      <AlertDialog.Trigger className={danger} aria-label={`Eliminar ${name}`}>Eliminar</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/35" />
        <AlertDialog.Content
          className="fixed inset-x-3 top-[15vh] z-[81] mx-auto max-h-[75vh] max-w-md overflow-y-auto rounded-xl border border-cu-border bg-cu-panel p-5 text-cu-text shadow-xl"
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        >
          <AlertDialog.Title className="break-words text-lg font-semibold">¿Eliminar {name}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-cu-text-secondary">
            Se borrarán permanentemente el dashboard, sus tarjetas y sus vistas. Las tareas y listas se conservarán.
          </AlertDialog.Description>
          {error && <p role="alert" className="mt-3 text-sm text-cu-urgent">{error}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialog.Cancel className={control} disabled={busy}>Cancelar</AlertDialog.Cancel>
            <button type="button" className={danger} disabled={busy} onClick={() => void remove()}>
              {busy ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
