"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace, type Bootstrap } from "@/components/workspace-context";
import { WorkspaceBrand } from "@/components/workspace-brand";
import { brandingPath, logoTypes, maxLogoBytes, maxWorkspaceName, workspaceLogoVersion } from "@/lib/workspace-branding";

const secondary = "min-h-10 rounded-md border border-cu-border px-3 text-sm hover:bg-cu-hover disabled:opacity-50";

export function WorkspaceBrandingSettings() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(workspace.name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const currentLogo = workspaceLogoVersion(workspace.avatarUrl) ? workspace.avatarUrl : null;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(next: File | null) {
    setSaved(false);
    setError("");
    if (next && (!logoTypes.includes(next.type) || next.size > maxLogoBytes)) {
      setError("Elegí un PNG, JPEG o WebP de hasta 1 MB.");
      if (input.current) input.current.value = "";
      setFile(null);
      setPreview(null);
      return;
    }
    setPreview(next ? URL.createObjectURL(next) : null);
    setFile(next);
    if (next) setRemoveLogo(false);
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const form = new FormData();
      form.set("name", name);
      if (file) form.set("logo", file);
      if (removeLogo) form.set("removeLogo", "true");
      const response = await fetch(brandingPath, { method: "POST", body: form });
      const data = await response.json() as { name: string; avatarUrl: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "No pudimos guardar la marca.");
      qc.setQueryData<Bootstrap>(["bootstrap"], previous => previous && ({
        ...previous, workspace: { ...previous.workspace, name: data.name, avatarUrl: data.avatarUrl },
      }));
      setName(data.name);
      setFile(null);
      setPreview(null);
      setRemoveLogo(false);
      if (input.current) input.current.value = "";
      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No pudimos guardar la marca.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-xl rounded-xl border border-cu-border bg-cu-panel p-5">
      <h2 className="text-lg font-semibold">Marca del espacio</h2>
      <p className="mt-2 text-sm text-cu-text-secondary">El nombre y el logo aparecen arriba de la barra lateral para todo el equipo.</p>
      <form className="mt-5 space-y-5" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="flex flex-col gap-2 text-sm">
          Nombre del espacio
          <input required maxLength={maxWorkspaceName} value={name} disabled={busy}
            onChange={event => { setName(event.target.value); setSaved(false); }}
            className="min-h-11 rounded-md border border-cu-border bg-cu-panel px-3 focus:outline-2 focus:outline-cu-purple" />
        </label>
        <div className="space-y-2">
          <label htmlFor="workspace-logo" className="block text-sm">Logo de la empresa</label>
          <input ref={input} id="workspace-logo" type="file" accept={logoTypes.join(",")} disabled={busy}
            aria-describedby="workspace-logo-help"
            onChange={event => choose(event.target.files?.[0] ?? null)}
            className="block w-full rounded-md text-sm file:mr-3 file:rounded-md file:border file:border-cu-border file:bg-cu-panel file:px-3 file:py-2 file:text-cu-text" />
          <p id="workspace-logo-help" className="text-xs text-cu-text-secondary">PNG, JPEG o WebP de hasta 1 MB.</p>
          {(currentLogo || file) && !removeLogo && (
            <button type="button" disabled={busy} className={secondary}
              onClick={() => { choose(null); setRemoveLogo(!!currentLogo); if (input.current) input.current.value = ""; }}>Quitar logo</button>
          )}
          {removeLogo && <button type="button" disabled={busy} className={secondary} onClick={() => setRemoveLogo(false)}>Conservar logo</button>}
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-cu-border bg-cu-sidebar p-3" aria-label="Vista previa">
          <WorkspaceBrand name={name.trim() || workspace.name} color={workspace.color} logo={removeLogo ? null : preview || currentLogo} />
        </div>
        {error && <p role="alert" className="text-sm text-cu-urgent">{error}</p>}
        {saved && <p role="status" className="text-sm text-cu-purple">Marca guardada.</p>}
        <button type="submit" disabled={busy || !name.trim() || (name.trim() === workspace.name && !file && !removeLogo)}
          className="min-h-11 rounded-md bg-cu-purple px-4 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Guardar marca"}
        </button>
      </form>
    </section>
  );
}
