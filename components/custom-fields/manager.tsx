"use client";

import { nanoid } from "nanoid";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";
import { apiGet, apiSend } from "@/lib/api";
import { useWorkspace } from "@/components/workspace-context";
import {
  fieldTypes,
  sameLocation,
  type FieldCatalog,
  type FieldInput,
  type FieldLocation,
  type ManagedField,
} from "@/lib/custom-field-model";

export type FieldManagerRequest = {
  location?: FieldLocation;
  fieldId?: string;
  sourceIds?: string[];
};
export function openFieldManager(detail: FieldManagerRequest = {}) {
  window.dispatchEvent(new CustomEvent("open-custom-fields", { detail }));
}
const control =
  "min-h-9 rounded border border-cu-border bg-cu-panel px-2 py-1.5 text-sm text-cu-text outline-none focus-visible:ring-2 focus-visible:ring-cu-purple";
const button = control + " hover:bg-cu-hover disabled:opacity-50";
const primary = button + " bg-cu-purple text-white hover:bg-cu-purple-dark";

export function CustomFieldManagerHost() {
  const { authorization, currentUser } = useWorkspace();
  const [request, setRequest] = useState<FieldManagerRequest | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    function open(event: Event) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setRequest((event as CustomEvent<FieldManagerRequest>).detail ?? {});
    }
    window.addEventListener("open-custom-fields", open);
    return () => window.removeEventListener("open-custom-fields", open);
  }, []);
  if (authorization.role === "GUEST" || !request) return null;
  return (
    <FieldManager
      key={currentUser.id}
      request={request}
      onClose={() => {
        const target = returnFocus.current;
        setRequest(null);
        requestAnimationFrame(() => target?.focus());
      }}
      onReturnFocus={() => returnFocus.current?.focus()}
    />
  );
}

function FieldManager({
  request,
  onClose,
  onReturnFocus,
}: {
  request: FieldManagerRequest;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const { currentUser } = useWorkspace();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["custom-fields", currentUser.id],
    queryFn: () => apiGet<FieldCatalog>("/api/custom-fields"),
    staleTime: 0,
  });
  const [location, setLocation] = useState<FieldLocation | null>(
    request.location ?? null,
  );
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [editor, setEditor] = useState<string | null>(request.fieldId ?? null);
  const [addingExisting, setAddingExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const catalog = query.data;
  const target = catalog?.locations.find(
    (l) => location && sameLocation(l, location),
  );
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase();
  const matchesLocation = (field: ManagedField) =>
    !location ||
    field.locations.some(
      (p) =>
        sameLocation(p, location) ||
        (location.type === "LIST" &&
          p.type === "SPACE" &&
          p.id === target?.parentId),
    );
  const fields =
    catalog?.fields.filter(
      (f) =>
        matchesLocation(f) &&
        (!type || f.type === type) &&
        normalize(f.name + " " + f.id).includes(normalize(search)),
    ) ?? [];
  async function refresh() {
    await Promise.all([
      query.refetch(),
      ...["list", "task", "dashboard-data"].map((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      ),
    ]);
  }
  async function attach(field: ManagedField) {
    if (!location) return;
    setBusy(true);
    setError("");
    try {
      await apiSend(
        "/api/custom-fields/" + encodeURIComponent(field.id),
        "POST",
        { ...field, locations: [...field.locations, location] },
      );
      await refresh();
      setAddingExisting(false);
      setMessage("Campo agregado a la ubicación.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy && !editor) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/45" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onReturnFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (editor) {
              event.preventDefault();
              setEditor(null);
            }
          }}
          className="fixed inset-2 z-[91] flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-cu-border bg-cu-panel text-cu-text shadow-xl sm:inset-6 lg:inset-x-[5vw]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-cu-border px-4 py-3">
            <div>
              <Dialog.Title className="font-semibold">
                Administrador de campos personalizados
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-cu-text-secondary">
                {target?.name ?? "Todas las ubicaciones"} · Los campos del
                espacio se heredan en sus Listas.
              </Dialog.Description>
            </div>
            <Dialog.Close
              disabled={busy}
              onClick={onClose}
              aria-label="Cerrar administrador de campos"
              className={button}
            >
              <X size={17} />
            </Dialog.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            <nav
              aria-label="Ubicaciones de campos"
              className="max-h-40 shrink-0 overflow-y-auto border-b border-cu-border p-3 sm:max-h-none sm:w-56 sm:border-r sm:border-b-0"
            >
              <button
                className={`${button} mb-3 w-full text-left ${!location ? "font-semibold text-cu-purple" : ""}`}
                onClick={() => {
                  setLocation(null);
                  setAddingExisting(false);
                }}
              >
                Todos los campos personalizados
              </button>
              {catalog?.locations
                .filter((l) => l.type === "SPACE")
                .map((space) => (
                  <div key={space.id} className="mb-3">
                    <button
                      onClick={() => {
                        setLocation(space);
                        setAddingExisting(false);
                      }}
                      className={`${button} w-full truncate text-left ${location && sameLocation(space, location) ? "font-semibold text-cu-purple" : ""}`}
                    >
                      {space.name}
                    </button>
                    {catalog.locations
                      .filter(
                        (l) =>
                          l.type === "LIST" &&
                          l.parentId === space.id &&
                          (!request.sourceIds?.length ||
                            request.sourceIds.includes(l.id)),
                      )
                      .map((list) => (
                        <button
                          key={list.id}
                          onClick={() => {
                            setLocation(list);
                            setAddingExisting(false);
                          }}
                          className={`mt-1 block w-full truncate rounded px-3 py-2 text-left text-sm hover:bg-cu-hover ${location && sameLocation(list, location) ? "bg-cu-hover font-semibold text-cu-purple" : ""}`}
                        >
                          {list.name}
                        </button>
                      ))}
                  </div>
                ))}
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
              {(error || query.error) && (
                <p role="alert" className="mb-3 text-sm text-cu-urgent">
                  {error || query.error?.message}
                </p>
              )}
              {message && (
                <p
                  role="status"
                  className="mb-3 text-sm text-cu-text-secondary"
                >
                  {message}
                </p>
              )}
              {query.isLoading && <p role="status">Cargando campos…</p>}
              {catalog && !editor && (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <input
                      aria-label="Buscar campo por nombre o ID"
                      placeholder="Buscar campo…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className={`${control} min-w-40 flex-1`}
                    />
                    <select
                      aria-label="Tipo de campo"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className={control}
                    >
                      <option value="">Todos los tipos</option>
                      {Object.entries(fieldTypes).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {target?.canEdit && (
                      <button
                        className={button}
                        onClick={() => setAddingExisting((v) => !v)}
                      >
                        Agregar existente
                      </button>
                    )}
                    {catalog.locations.some((l) => l.canEdit) && (
                      <button
                        className={primary}
                        onClick={() => {
                          setEditor("new");
                          setError("");
                        }}
                      >
                        Crear nuevo
                      </button>
                    )}
                  </div>
                  {request.sourceIds && (
                    <p className="mb-4 text-xs leading-5 text-cu-text-secondary">
                      Elegí una Lista de origen o su espacio para agregar un
                      campo a las tareas del dashboard. Los gráficos usan estos
                      mismos campos.
                    </p>
                  )}
                  {addingExisting && (
                    <section className="mb-5 rounded-lg border border-cu-border p-3">
                      <h3 className="mb-2 text-sm font-semibold">
                        Agregar a {target?.name}
                      </h3>
                      <p className="mb-2 text-xs text-cu-text-secondary">
                        Se comparte el mismo campo y sus opciones entre
                        ubicaciones.
                      </p>
                      {catalog.fields
                        .filter((f) => f.canEdit && !matchesLocation(f))
                        .map((f) => (
                          <button
                            key={f.id}
                            disabled={busy}
                            onClick={() => void attach(f)}
                            className={`${button} mr-2 mb-2`}
                          >
                            {f.name} +
                          </button>
                        ))}
                      {!catalog.fields.some(
                        (f) => f.canEdit && !matchesLocation(f),
                      ) && (
                        <p className="text-sm">
                          No hay otros campos disponibles.
                        </p>
                      )}
                    </section>
                  )}
                  {Object.entries(fieldTypes)
                    .filter(([kind]) => fields.some((f) => f.type === kind))
                    .map(([kind, label]) => (
                      <details key={kind} open className="mb-5">
                        <summary className="cursor-pointer py-2 text-sm font-semibold text-cu-purple">
                          {label} ·{" "}
                          {fields.filter((f) => f.type === kind).length}
                        </summary>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[540px] text-left text-sm">
                            <thead className="text-xs font-normal text-cu-text-tertiary">
                              <tr>
                                <th className="p-2">Nombre</th>
                                <th className="p-2">Ubicaciones</th>
                                <th className="p-2">Creador</th>
                                <th className="p-2">Creación</th>
                                <th className="w-10 p-2">
                                  <span className="sr-only">Acciones</span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields
                                .filter((f) => f.type === kind)
                                .map((f) => (
                                  <tr
                                    key={f.id}
                                    className="border-t border-cu-border"
                                  >
                                    <td className="p-2">
                                      <button
                                        className="text-left hover:text-cu-purple hover:underline"
                                        onClick={() => setEditor(f.id)}
                                      >
                                        {f.name}
                                      </button>
                                      {f.description && (
                                        <p className="mt-1 max-w-72 text-xs text-cu-text-secondary">
                                          {f.description}
                                        </p>
                                      )}
                                    </td>
                                    <td className="p-2 text-xs text-cu-text-secondary">
                                      {f.locations.map((l) => (
                                        <span
                                          key={l.type + l.id}
                                          className="mr-1 inline-block rounded bg-cu-hover px-2 py-1"
                                        >
                                          {l.name}
                                          {l.type === "SPACE"
                                            ? " · Espacio"
                                            : ""}
                                        </span>
                                      ))}
                                    </td>
                                    <td className="p-2 text-xs">
                                      {f.createdBy ?? "Sin registro"}
                                    </td>
                                    <td className="p-2 text-xs">
                                      {f.createdAt
                                        ? new Date(
                                            f.createdAt,
                                          ).toLocaleDateString("es-AR")
                                        : "Sin registro"}
                                    </td>
                                    <td className="p-2">
                                      <button
                                        aria-label={"Editar campo " + f.name}
                                        onClick={() => setEditor(f.id)}
                                        className={button}
                                      >
                                        <Pencil size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  {!fields.length && (
                    <p className="py-8 text-sm text-cu-text-secondary">
                      No hay campos que coincidan con esta selección.
                    </p>
                  )}
                </>
              )}
              {catalog && editor && (
                <FieldEditor
                  key={editor}
                  field={catalog.fields.find((f) => f.id === editor)}
                  catalog={catalog}
                  location={location}
                  onCancel={() => setEditor(null)}
                  onSaved={async () => {
                    await refresh();
                    setEditor(null);
                    setMessage("Campo guardado.");
                  }}
                  onBusy={setBusy}
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FieldEditor({
  field,
  catalog,
  location,
  onCancel,
  onSaved,
  onBusy,
}: {
  field?: ManagedField;
  catalog: FieldCatalog;
  location: FieldLocation | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState<FieldInput["type"]>(field?.type ?? "TEXT");
  const [description, setDescription] = useState(field?.description ?? "");
  const [options, setOptions] = useState(
    (field?.options ?? []).map((o) => ({ ...o, key: o.id })) as {
      id?: string;
      key: string;
      label: string;
      color: string;
    }[],
  );
  const [locations, setLocations] = useState<FieldLocation[]>(
    field?.locations ?? (location ? [location] : []),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const editable = field ? field.canEdit : true;
  const selectable = type === "DROPDOWN" || type === "LABELS";
  function changeOption(
    index: number,
    patch: { label?: string; color?: string },
  ) {
    setOptions((previous) =>
      previous.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    );
  }
  function moveOption(index: number, step: number) {
    setOptions((previous) => {
      const next = [...previous];
      [next[index], next[index + step]] = [next[index + step], next[index]];
      return next;
    });
  }
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (!editable || busy) return;
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          await apiSend(
            "/api/custom-fields" +
              (field ? "/" + encodeURIComponent(field.id) : ""),
            "POST",
            {
              name,
              type,
              description,
              options: selectable
                ? options.map(({ id, label, color }) => ({ id, label, color }))
                : [],
              locations,
              revision: field?.revision,
            },
          );
          await onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
      className="mx-auto max-w-2xl space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">
          {field ? "Editar campo personalizado" : "Crear campo personalizado"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={button}
        >
          Volver
        </button>
      </div>
      {field && (
        <p className="text-xs leading-5 text-cu-text-secondary">
          Los cambios se aplican a todas las ubicaciones de este campo. Los
          valores asignados conservan su identidad.
        </p>
      )}
      {!editable && (
        <p className="text-sm text-cu-text-secondary">
          Necesitás permisos de edición en todas las ubicaciones para configurar
          este campo.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-cu-urgent">
          {error}
        </p>
      )}
      <fieldset
        disabled={!editable || busy}
        className="space-y-4 disabled:opacity-65"
      >
        <label className="block text-sm">
          Nombre
          <input
            autoFocus
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${control} mt-1 w-full`}
          />
        </label>
        <label className="block text-sm">
          Tipo
          <select
            value={type}
            disabled={!!field}
            onChange={(e) => setType(e.target.value as FieldInput["type"])}
            className={`${control} mt-1 w-full`}
          >
            {Object.entries(fieldTypes).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Descripción
          <textarea
            maxLength={1000}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${control} mt-1 w-full`}
          />
        </label>
        {selectable && (
          <section>
            <h4 className="mb-2 text-sm font-semibold">Opciones</h4>
            <p className="mb-2 text-xs text-cu-text-secondary">
              Podés cambiar nombres, colores y orden. Para quitar una opción en
              uso, cambiá primero el valor de esas tareas.
            </p>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={o.key} className="flex items-center gap-1">
                  <input
                    type="color"
                    aria-label={"Color de opción " + (i + 1)}
                    value={o.color}
                    onChange={(e) => changeOption(i, { color: e.target.value })}
                    className="h-9 w-9 shrink-0 cursor-pointer rounded border border-cu-border"
                  />
                  <input
                    required
                    aria-label={"Nombre de opción " + (i + 1)}
                    maxLength={100}
                    value={o.label}
                    onChange={(e) => changeOption(i, { label: e.target.value })}
                    className={`${control} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveOption(i, -1)}
                    aria-label={"Subir opción " + (i + 1)}
                    className={button}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={i === options.length - 1}
                    onClick={() => moveOption(i, 1)}
                    aria-label={"Bajar opción " + (i + 1)}
                    className={button}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((previous) =>
                        previous.filter((x) => x.key !== o.key),
                      )
                    }
                    aria-label={"Quitar opción " + (i + 1)}
                    className={button}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={options.length >= 500}
              onClick={() =>
                setOptions((previous) => [
                  ...previous,
                  { key: nanoid(), label: "", color: "#7b68ee" },
                ])
              }
              className={`${button} mt-2 inline-flex items-center gap-1`}
            >
              <Plus size={15} /> Agregar opción
            </button>
          </section>
        )}
        <section>
          <h4 className="mb-2 text-sm font-semibold">Ubicaciones</h4>
          <div className="max-h-48 overflow-y-auto rounded border border-cu-border p-2">
            {catalog.locations
              .filter((l) => l.canEdit)
              .map((l) => (
                <label
                  key={l.type + l.id}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={locations.some((p) => sameLocation(l, p))}
                    onChange={(e) =>
                      setLocations((previous) =>
                        e.target.checked
                          ? [...previous, { type: l.type, id: l.id }]
                          : previous.filter((p) => !sameLocation(l, p)),
                      )
                    }
                  />
                  <span>
                    {l.type === "SPACE" ? "Espacio · " : "Lista · "}
                    {l.name}
                  </span>
                </label>
              ))}
          </div>
        </section>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={button}
        >
          Cancelar
        </button>
        {editable && (
          <button disabled={busy || !locations.length} className={primary}>
            {busy ? "Guardando…" : "Guardar campo"}
          </button>
        )}
      </div>
    </form>
  );
}
