"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Paperclip, Upload, X, FileText, Download, Expand } from "lucide-react";
import { apiSend } from "@/lib/api";
import type { TaskDetail } from "@/lib/queries";

import {Dialog, DialogContent, DialogTitle, DialogDescription} from "@/components/ui/dialog";

type Attachment = TaskDetail["attachments"][number];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Attachments({
  taskId,
  attachments,
  onChange,
}: {
  taskId: string;
  attachments: Attachment[];
  onChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/tasks/${taskId}/attachments`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as {error?:string};
          throw new Error(data.error ?? "Upload failed");
        }
      }
    },
    onSuccess: () => {
      setError(null);
      onChange();
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/api/attachments/${id}`, "DELETE"),
    onSuccess: onChange,
  });

  function handleFiles(files: FileList | File[]) {
    if (files.length) upload.mutate(files);
  }

  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-cu-text-secondary">
        <Paperclip className="h-4 w-4" /> Attachments
        {attachments.length > 0 && <span className="text-cu-text-tertiary">{attachments.length}</span>}
      </h3>

      {attachments.length > 0 && (
        <div className="mb-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {attachments.map((a) => (
            <AttachmentCard key={a.id} attachment={a} onDelete={() => remove.mutate(a.id)} />
          ))}
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-4 text-[13px] transition-colors ${
          dragOver
            ? "border-cu-purple bg-cu-purple-light/40 text-cu-purple"
            : "border-cu-border text-cu-text-tertiary hover:border-cu-purple/60 hover:text-cu-text-secondary"
        }`}
      >
        <Upload className="h-4 w-4" />
        {upload.isPending ? "Uploading…" : "Drop files or click to upload"}
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1.5 text-[12px] text-cu-urgent">{error}</p>}
    </section>
  );
}

function AttachmentCard({ attachment, onDelete }: { attachment: Attachment; onDelete: () => void }) {
  const [preview,setPreview]=useState(false),[failed,setFailed]=useState(false);
  const internal=attachment.url.startsWith('/api/files/')||attachment.url.startsWith('/restored-files/');
  const url=internal?'/api/files/'+encodeURIComponent(attachment.id):attachment.url;
  const downloadUrl=internal?url+'?download=1':url;
  const isImage=!failed&&(/^image\/(png|jpeg|gif|webp)$/i.test(attachment.mime)||/\.(png|jpe?g|gif|webp)$/i.test(attachment.name));
  return <>
    <div className="group relative flex items-center gap-2 rounded-lg border border-cu-border bg-cu-panel p-2">
      {isImage ? <button type="button" onClick={()=>setPreview(true)} aria-label={'Ampliar imagen: '+attachment.name} className="relative shrink-0 overflow-hidden rounded focus-visible:outline-2 focus-visible:outline-cu-purple">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={attachment.name} loading="lazy" onError={()=>setFailed(true)} className="h-16 w-20 object-cover"/>
        <Expand aria-hidden="true" className="absolute bottom-1 right-1 h-4 w-4 rounded bg-cu-panel text-cu-text"/>
      </button> : <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-cu-hover-strong"><FileText className="h-5 w-5 text-cu-text-tertiary"/></div>}
      <div className="min-w-0 flex-1">
        {isImage?<button type="button" onClick={()=>setPreview(true)} className="block w-full truncate text-left text-[12px] font-medium text-cu-text hover:text-cu-purple focus-visible:outline-2 focus-visible:outline-cu-purple" title={attachment.name}>{attachment.name}</button>:<a href={downloadUrl} download={attachment.name} className="block truncate text-[12px] font-medium text-cu-text hover:text-cu-purple" title={attachment.name}>{attachment.name}</a>}
        <span className="text-[11px] text-cu-text-tertiary">{formatSize(attachment.size)}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <a href={downloadUrl} download={attachment.name} aria-label={'Descargar '+attachment.name} className="rounded p-2 text-cu-text-secondary hover:bg-cu-hover focus-visible:outline-2 focus-visible:outline-cu-purple" title="Descargar original"><Download className="h-4 w-4"/></a>
        <button type="button" onClick={onDelete} className="rounded p-2 text-cu-text-secondary hover:bg-cu-hover hover:text-cu-urgent focus-visible:outline-2 focus-visible:outline-cu-purple" aria-label={'Eliminar '+attachment.name} title="Eliminar"><X className="h-4 w-4"/></button>
      </div>
    </div>
    <Dialog open={preview} onOpenChange={setPreview}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-cu-border bg-cu-panel text-cu-text sm:max-w-5xl">
        <DialogTitle className="break-words pr-8 text-sm">{attachment.name}</DialogTitle>
        <DialogDescription className="sr-only">Vista ampliada del archivo adjunto. Cerrá con Escape o descargá el original.</DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={attachment.name} className="mx-auto max-h-[65dvh] max-w-full object-contain"/>
        <a href={downloadUrl} download={attachment.name} className="inline-flex min-h-11 items-center justify-center gap-2 rounded border border-cu-border px-3 text-sm text-cu-text hover:bg-cu-hover"><Download className="h-4 w-4"/>Descargar original · {formatSize(attachment.size)}</a>
      </DialogContent>
    </Dialog>
  </>;
}
