import {canReadField,fieldSettings,evaluateFormula} from "./field-runtime";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AccessError, type Actor } from "./access-context";
import {
  fieldSchema,
  type FieldCatalog,
  type FieldLocation,
  type FieldInput,
  type ManagedField,
  sameLocation,
} from "./custom-field-model";

async function rows<T>(
  db: D1Database,
  sql: string,
  ...args: (string | number)[]
) {
  return (
    await db
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
}
const applicable = `(f.listId=l.id OR EXISTS (SELECT 1 FROM CustomFieldLocation p WHERE p.customFieldId=f.id AND (p.listId=l.id OR p.spaceId=l.spaceId)))`;
export async function effectiveFieldIds(
  db: D1Database,
  listId: string | string[],
) {
  const listIds = typeof listId === "string" ? [listId] : listId;
  return (
    await rows<{ id: string }>(
      db,
      `SELECT DISTINCT f.id FROM CustomField f JOIN List l ON l.id IN (SELECT value FROM json_each(?)) WHERE ${applicable} ORDER BY f.position,f.id`,
      JSON.stringify(listIds),
    )
  ).map((f) => f.id);
}
export async function fieldApplies(
  db: D1Database,
  fieldId: string,
  listId: string,
) {
  return !!(await db
    .prepare(
      `SELECT f.id FROM CustomField f JOIN List l ON l.id=? WHERE f.id=? AND ${applicable}`,
    )
    .bind(listId, fieldId)
    .first());
}
export function canManageFieldLocation(a: Actor, location: FieldLocation) {
  if (a.role === "GUEST" || a.tokenScope === "read") return false;
  return location.type === "SPACE"
    ? a.access.admin && a.access.can("SPACE", location.id, "EDIT")
    : a.access.can("LIST", location.id, "EDIT");
}
export async function fieldCatalog(
  db: D1Database,
  a: Actor,
): Promise<FieldCatalog> {
  const [lists, spaces, fields, placements, options] = await Promise.all([
    rows<{ id: string; name: string; spaceId: string }>(
      db,
      "SELECT l.id,l.name,l.spaceId FROM List l JOIN Space s ON s.id=l.spaceId WHERE s.workspaceId=?",
      a.workspaceId,
    ),
    rows<{ id: string; name: string }>(
      db,
      "SELECT id,name FROM Space WHERE workspaceId=?",
      a.workspaceId,
    ),
    rows<{
      id: string;
      name: string;
      listId: string | null;
      type: ManagedField["type"];
      config: string | null;
      revision: number | null;
      createdBy: string | null;
      createdAt: number | null;
    }>(
      db,
      "SELECT f.*,r.revision,u.name createdBy,r.createdAt FROM CustomField f LEFT JOIN CustomFieldRevision r ON r.customFieldId=f.id LEFT JOIN User u ON u.id=r.createdBy",
    ),
    rows<{
      customFieldId: string;
      spaceId: string | null;
      listId: string | null;
    }>(db, "SELECT * FROM CustomFieldLocation"),
    rows<ManagedField["options"][number] & { customFieldId: string }>(
      db,
      "SELECT * FROM CustomFieldOption ORDER BY position,id",
    ),
  ]);
  const locations: FieldCatalog["locations"] = [
    ...spaces
      .filter(
        (s) =>
          a.access.can("SPACE", s.id) ||
          lists.some((l) => l.spaceId === s.id && a.access.visibleList(l.id)),
      )
      .map((s) => ({
        ...s,
        type: "SPACE" as const,
        canEdit: canManageFieldLocation(a, { ...s, type: "SPACE" }),
      })),
    ...lists
      .filter((l) => a.access.visibleList(l.id))
      .map((l) => ({
        ...l,
        parentId: l.spaceId,
        type: "LIST" as const,
        canEdit: canManageFieldLocation(a, { ...l, type: "LIST" }),
      })),
  ];
  const visible: ManagedField[] = [];
  for (const f of fields) {
    const all: FieldLocation[] = [
      ...(f.listId ? [{ type: "LIST" as const, id: f.listId }] : []),
      ...placements
        .filter((p) => p.customFieldId === f.id)
        .map((p) =>
          p.spaceId
            ? { type: "SPACE" as const, id: p.spaceId }
            : { type: "LIST" as const, id: p.listId! },
        ),
    ];
    const unique = all.filter(
      (l, i) => all.findIndex((p) => sameLocation(l, p)) === i,
    );
    const shown = unique.flatMap((l) => {
      const location = locations.find((p) => sameLocation(l, p));
      return location ? [location] : [];
    });
    if (!shown.length || !canReadField(a,f.config)) continue;
    let description = "";
    try {
      description = JSON.parse(f.config ?? "{}")?.description ?? "";
    } catch {
      /* Imported config can be absent. */
    }
    visible.push({
      id: f.id,
      name: f.name,
      type: f.type,
      description, ...fieldSettings(f.config),
      revision: f.revision ?? 0,
      locations: shown,
      options: options.filter((o) => o.customFieldId === f.id),
      canEdit: (a.access.admin||!(fieldSettings(f.config).readerIds?.length||fieldSettings(f.config).editorIds?.length)) && unique.every(
        (l) =>
          !!locations.find((p) => sameLocation(l, p)) &&
          canManageFieldLocation(a, l),
      ),
      createdBy: f.createdBy,
      createdAt: f.createdAt,
    });
  }
  return { fields: visible, locations };
}
async function validateLocations(
  db: D1Database,
  a: Actor,
  locations: FieldLocation[],
) {
  for (const l of locations) {
    if (!canManageFieldLocation(a, l))
      throw new AccessError(
        403,
        "No podés gestionar campos en una ubicación seleccionada.",
      );
    const sql =
      l.type === "SPACE"
        ? "SELECT id FROM Space WHERE id=? AND workspaceId=?"
        : "SELECT l.id FROM List l JOIN Space s ON s.id=l.spaceId WHERE l.id=? AND s.workspaceId=?";
    if (!(await db.prepare(sql).bind(l.id, a.workspaceId).first()))
      throw new AccessError(403, "Ubicación no disponible.");
  }
}
export async function saveCustomField(
  db: D1Database,
  a: Actor,
  input: FieldInput,
  id?: string,
) {
  const catalog = await fieldCatalog(db, a);
  const previous = id ? catalog.fields.find((f) => f.id === id) : undefined;
  if (id && !previous) throw new AccessError(404, "Campo no disponible.");
  if (previous && !previous.canEdit)
    throw new AccessError(
      403,
      "Necesitás permiso para editar el campo en todas sus ubicaciones.",
    );
  await validateLocations(db, a, [
    ...input.locations,
    ...(previous?.locations ?? []),
  ]);
  if (previous && input.type !== previous.type)
    throw new AccessError(
      400,
      "El tipo de un campo existente se conserva. Creá otro campo para usar un tipo diferente.",
    );
  if (previous && input.revision !== previous.revision)
    throw new AccessError(
      409,
      "El campo cambió en otra sesión. Recargá antes de guardar.",
    );
  const ids = input.options.flatMap((o) => (o.id ? [o.id] : []));
  if (
    new Set(ids).size !== ids.length ||
    ids.some((optionId) => !previous?.options.some((o) => o.id === optionId))
  )
    throw new AccessError(400, "Opción inválida.");
  const fieldId = id ?? randomUUID(),
    key = randomUUID();
  const options = input.options.map((o, position) => ({
    ...o,
    id: o.id ?? randomUUID(),
    position,
  }));
  const configRow = id
    ? await db
        .prepare("SELECT config FROM CustomField WHERE id=?")
        .bind(id)
        .first<{ config: string | null }>()
    : null;
  let config: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(configRow?.config ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      config = parsed;
  } catch {
    /* Preserve other valid settings. */
  }
  if((input.adminOnly||previous?.adminOnly||input.readerIds?.length||input.editorIds?.length||previous?.readerIds?.length||previous?.editorIds?.length)&&!a.access.admin)throw new AccessError(403,'Solo administradores pueden gestionar campos privados.');
  if(input.type==='FORMULA'&&input.required)throw new AccessError(400,'Una fórmula no puede ser un campo obligatorio editable.');
  if(input.type==='FORMULA'){
    if(!input.formula)throw new AccessError(400,'Ingresá una fórmula.');
    const refs=[...input.formula.matchAll(/\{\{([^{}]+)\}\}/g)].map(m=>m[1]);
    if(refs.some(ref=>ref===id||!catalog.fields.some(f=>f.id===ref&&['NUMBER','MONEY','RATING','PROGRESS'].includes(f.type)&&(!f.adminOnly||input.adminOnly))))throw new AccessError(400,'La fórmula debe usar campos numéricos disponibles y respetar su privacidad.');
    for(const ref of refs){const field=catalog.fields.find(f=>f.id===ref)!;if(field.readerIds?.length&&!input.adminOnly&&(!input.readerIds?.length||input.readerIds.some(id=>!field.readerIds!.includes(id))))throw new AccessError(400,'La fórmula debe respetar los lectores de sus campos de origen.');}
    evaluateFormula(input.formula,Object.fromEntries(refs.map(ref=>[ref,1])));
  }
  if(input.defaultValue!==undefined&&input.defaultValue!==null){
    const v=input.defaultValue;
    if(['NUMBER','MONEY','RATING','PROGRESS'].includes(input.type)&&(typeof v!=='number'||!Number.isFinite(v)))throw new AccessError(400,'El valor predeterminado debe ser numérico.');
    if(input.type==='CHECKBOX'&&typeof v!=='boolean')throw new AccessError(400,'Valor predeterminado inválido.');
    if(input.type==='RATING'&&(!Number.isInteger(v)||Number(v)<0||Number(v)>5)||input.type==='PROGRESS'&&(Number(v)<0||Number(v)>100))throw new AccessError(400,'Valor predeterminado fuera de rango.');
    if(!['NUMBER','MONEY','RATING','PROGRESS','CHECKBOX','LABELS'].includes(input.type)&&(typeof v!=='string'||v.length>50000))throw new AccessError(400,'El valor predeterminado debe ser texto.');
    if(input.type==='URL'&&!/^https?:\/\//i.test(String(v))||input.type==='EMAIL'&&!z.string().email().safeParse(v).success||input.type==='DATE'&&!Number.isFinite(Date.parse(String(v))))throw new AccessError(400,'Valor predeterminado inválido para el tipo de campo.');
    if(input.type==='FORMULA')throw new AccessError(400,'Las fórmulas no admiten valor predeterminado.');
    if(input.type==='DROPDOWN'&&!input.options.some(o=>o.id===v))throw new AccessError(400,'Guardá primero las opciones y luego elegí el valor predeterminado.');
    if(input.type==='LABELS'&&(!Array.isArray(v)||v.some(id=>!input.options.some(o=>o.id===id))))throw new AccessError(400,'Valor predeterminado inválido.');
  }
  for(const userId of [...(input.readerIds??[]),...(input.editorIds??[])])if(!await db.prepare('SELECT id FROM User WHERE id=?').bind(userId).first())throw new AccessError(400,'Usuario de campo inválido.');
  config.readerIds=input.readerIds??config.readerIds;config.editorIds=input.editorIds??config.editorIds;
  config.description = input.description;config.required=input.required??config.required??false;config.adminOnly=input.adminOnly??config.adminOnly??false;if(input.formula!==undefined)config.formula=input.formula;if(input.defaultValue!==undefined)config.defaultValue=input.defaultValue;
  const guard =
    "EXISTS (SELECT 1 FROM CustomFieldRevision WHERE customFieldId=? AND writeKey=?)";
  const writes: D1PreparedStatement[] = [];
  if (!id) {
    writes.push(
      db
        .prepare(
          "INSERT INTO CustomField (id,name,type,config,position) VALUES (?,?,?,?,?)",
        )
        .bind(
          fieldId,
          input.name,
          input.type,
          JSON.stringify(config),
          Date.now(),
        ),
    );
    writes.push(
      db
        .prepare(
          "INSERT INTO CustomFieldRevision (customFieldId,revision,writeKey,createdBy,createdAt) VALUES (?,1,?,?,?)",
        )
        .bind(fieldId, key, a.user.id, Date.now()),
    );
  } else {
    writes.push(
      db
        .prepare(
          "INSERT OR IGNORE INTO CustomFieldRevision (customFieldId,revision,writeKey) VALUES (?,0,'')",
        )
        .bind(fieldId),
    );
    writes.push(
      db
        .prepare(
          "UPDATE CustomFieldRevision SET revision=revision+1,writeKey=? WHERE customFieldId=? AND revision=?",
        )
        .bind(key, fieldId, input.revision!),
    );
  }
  writes.push(
    db
      .prepare(
        `UPDATE CustomField SET name=?,config=?,listId=NULL WHERE id=? AND ${guard}`,
      )
      .bind(input.name, JSON.stringify(config), fieldId, fieldId, key),
  );
  writes.push(
    db
      .prepare(
        `DELETE FROM CustomFieldLocation WHERE customFieldId=? AND ${guard}`,
      )
      .bind(fieldId, fieldId, key),
  );
  writes.push(
    db
      .prepare(
        `INSERT INTO CustomFieldLocation (customFieldId,spaceId,listId) SELECT ?,CASE WHEN json_extract(value,'$.type')='SPACE' THEN json_extract(value,'$.id') END,CASE WHEN json_extract(value,'$.type')='LIST' THEN json_extract(value,'$.id') END FROM json_each(?) WHERE ${guard}`,
      )
      .bind(
        fieldId,
        JSON.stringify(
          input.locations.filter(
            (l, i, all) => all.findIndex((p) => sameLocation(l, p)) === i,
          ),
        ),
        fieldId,
        key,
      ),
  );
  writes.push(
    db
      .prepare(
        `DELETE FROM CustomFieldOption WHERE customFieldId=? AND id NOT IN (SELECT json_extract(value,'$.id') FROM json_each(?)) AND ${guard}`,
      )
      .bind(fieldId, JSON.stringify(options), fieldId, key),
  );
  writes.push(
    db
      .prepare(
        `INSERT INTO CustomFieldOption (id,customFieldId,label,color,position) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.label'),json_extract(value,'$.color'),json_extract(value,'$.position') FROM json_each(?) WHERE ${guard} ON CONFLICT(id) DO UPDATE SET label=excluded.label,color=excluded.color,position=excluded.position WHERE CustomFieldOption.customFieldId=excluded.customFieldId`,
      )
      .bind(fieldId, JSON.stringify(options), fieldId, key),
  );
  writes.push(
    db
      .prepare(
        `INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt) SELECT ?,?,?,?,? WHERE ${guard}`,
      )
      .bind(
        randomUUID(),
        a.user.id,
        id ? "custom-field.update" : "custom-field.create",
        fieldId,
        Date.now(),
        fieldId,
        key,
      ),
  );
  try {
    const result = await db.batch(writes);
    if (!result[id ? 1 : 0].meta.changes)
      throw new AccessError(
        409,
        "El campo cambió en otra sesión. Recargá antes de guardar.",
      );
  } catch (error) {
    if (error instanceof Error && error.message.includes("OPTION_IN_USE"))
      throw new AccessError(
        409,
        "Una opción que intentás quitar está usada en tareas. Cambiá esos valores antes de eliminarla.",
      );
    throw error;
  }
  const lists = await rows<{ id: string }>(
    db,
    `SELECT DISTINCT l.id FROM List l JOIN CustomField f ON f.id=? WHERE ${applicable}`,
    fieldId,
  );
  const oldLists = previous
    ? catalog.locations
        .filter(
          (l) =>
            l.type === "LIST" &&
            previous.locations.some((p) =>
              p.type === "LIST" ? p.id === l.id : p.id === l.parentId,
            ),
        )
        .map((l) => ({ id: l.id }))
    : [];
  const targets = [...new Set([...lists, ...oldLists].map((l) => l.id))];
  if (targets.length)
    await db.batch(
      targets.map((listId) =>
        db
          .prepare(
            "INSERT INTO ChangeEvent (taskId,listId,actorId,clientId,createdAt) VALUES (NULL,?,?,?,?)",
          )
          .bind(listId, a.user.id, a.clientId ?? null, Date.now()),
      ),
    );
  return { id: fieldId };
}
export async function customFieldRoute(
  req: Request,
  db: D1Database,
  a: Actor | null,
): Promise<Response | null> {
  const path = new URL(req.url).pathname;
  const match = path.match(/^\/api\/custom-fields(?:\/([^/]+))?$/);
  if (!match) return null;
  try {
    if (!a) throw new AccessError(401, "Iniciá sesión.");
    if (a.role === "GUEST")
      throw new AccessError(
        403,
        "El administrador de campos está disponible para miembros y administradores.",
      );
    if (req.method === "GET" && !match[1])
      return Response.json(await fieldCatalog(db, a));
    if (req.method !== "POST" || (match[1] && !decodeURIComponent(match[1])))
      throw new AccessError(405, "Método no permitido.");
    if (
      req.headers.get("Origin") !== new URL(req.url).origin &&
      !((a.kind === "native" || a.kind === "token") && !req.headers.get("Origin"))
    )
      throw new AccessError(403, "Origen no permitido.");
    if (a.tokenScope === "read") throw new AccessError(403, "Solo lectura.");
    const raw = await req.text();
    if (raw.length > 200000)
      throw new AccessError(413, "Configuración demasiado grande.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AccessError(400, "JSON inválido.");
    }
    return Response.json(
      await saveCustomField(
        db,
        a,
        fieldSchema.parse(body),
        match[1] ? decodeURIComponent(match[1]) : undefined,
      ),
    );
  } catch (error) {
    if (error instanceof AccessError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError)
      return Response.json(
        { error: error.issues[0]?.message ?? "Campo inválido." },
        { status: 400 },
      );
    console.error(
      "[custom-fields]",
      error instanceof Error ? error.message : "Error",
    );
    return Response.json(
      { error: "No pudimos guardar el campo." },
      { status: 500 },
    );
  }
}

export async function saveCustomFieldValue(
  db: D1Database,
  a: Actor,
  taskId: string,
  fieldId: string,
  value: unknown,
) {
  a.access.assert("TASK", taskId, "EDIT");
  if (a.role === "GUEST" || a.tokenScope === "read")
    throw new AccessError(403, "Solo lectura.");
  const task = await db
    .prepare("SELECT listId FROM Task WHERE id=?")
    .bind(taskId)
    .first<{ listId: string }>();
  if (!task || !(await fieldApplies(db, fieldId, task.listId)))
    throw new AccessError(400, "El campo no está disponible en esta Lista.");
  const field = await db
    .prepare("SELECT type,config FROM CustomField WHERE id=?")
    .bind(fieldId)
    .first<{ type: string; config: string | null }>();
  if(!canReadField(a,field?.config))throw new AccessError(403,"Campo privado.");
  const editors=fieldSettings(field?.config).editorIds;if(editors?.length&&!a.access.admin&&!editors.includes(a.user.id))throw new AccessError(403,"Solo podés leer este campo.");
  if(field?.type==="FORMULA")throw new AccessError(400,"Las fórmulas se calculan automáticamente.");
  const before = await db
    .prepare(
      "SELECT value FROM CustomFieldValue WHERE taskId=? AND customFieldId=?",
    )
    .bind(taskId, fieldId)
    .first<{ value: string }>();
  const empty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && !value.length);
  if(empty&&fieldSettings(field?.config).required)throw new AccessError(400,"Este campo es obligatorio.");
  if (!empty) {
    const type = field!.type;
    const number = ["NUMBER", "MONEY", "RATING", "PROGRESS"].includes(type);
    if (number && (typeof value !== "number" || !Number.isFinite(value)))
      throw new AccessError(400, "Ingresá un número válido.");
    if (
      type === "RATING" &&
      (Number(value) < 0 || Number(value) > 5 || !Number.isInteger(value))
    )
      throw new AccessError(400, "La valoración debe estar entre 0 y 5.");
    if (type === "PROGRESS" && (Number(value) < 0 || Number(value) > 100))
      throw new AccessError(400, "El progreso debe estar entre 0 y 100.");
    if (type === "CHECKBOX" && typeof value !== "boolean")
      throw new AccessError(400, "Casilla inválida.");
    if (
      type === "LABELS"
        ? !Array.isArray(value) ||
          value.length > 500 ||
          value.some((v) => typeof v !== "string")
        : !number && type !== "CHECKBOX" && typeof value !== "string"
    )
      throw new AccessError(400, "Valor inválido para el tipo de campo.");
    if (typeof value === "string" && value.length > 50000)
      throw new AccessError(400, "El valor es demasiado largo.");
    if (type === "DATE" && !Number.isFinite(Date.parse(String(value))))
      throw new AccessError(400, "Fecha inválida.");
    if (type === "URL" && !/^https?:\/\//i.test(String(value)))
      throw new AccessError(400, "Usá una URL con https:// o http://.");
    if (type === "EMAIL" && !z.string().email().safeParse(value).success)
      throw new AccessError(400, "Email inválido.");
  }
  const after = empty ? null : value;
  const audit = JSON.stringify({
    fieldId,
    before: before ? JSON.parse(before.value) : null,
    after,
    source: a.channel ?? "web",
  });
  const writes: D1PreparedStatement[] = [];
  if (empty) {
    writes.push(
      db
        .prepare(
          "INSERT INTO Activity (id,taskId,userId,type,data,createdAt) SELECT ?,?,?, 'custom_field_changed',?,? WHERE EXISTS(SELECT 1 FROM CustomFieldValue WHERE taskId=? AND customFieldId=?)",
        )
        .bind(
          randomUUID(),
          taskId,
          a.user.id,
          audit,
          new Date().toISOString(),
          taskId,
          fieldId,
        ),
    );
    writes.push(
      db
        .prepare(
          "DELETE FROM CustomFieldValue WHERE taskId=? AND customFieldId=?",
        )
        .bind(taskId, fieldId),
    );
    await db.batch(writes);
    return { ok: true, cleared: true };
  }
  const key = randomUUID();
  const optionIds =
    field!.type === "DROPDOWN"
      ? [value]
      : field!.type === "LABELS"
        ? value
        : [];
  const validOptions =
    "NOT EXISTS(SELECT 1 FROM json_each(?) chosen WHERE NOT EXISTS(SELECT 1 FROM CustomFieldOption o WHERE o.customFieldId=? AND o.id=chosen.value))";
  writes.push(
    db
      .prepare(
        `INSERT INTO CustomFieldValue (id,taskId,customFieldId,value) SELECT ?,?,?,? WHERE ${validOptions} ON CONFLICT(taskId,customFieldId) DO UPDATE SET id=excluded.id,value=excluded.value`,
      )
      .bind(
        key,
        taskId,
        fieldId,
        JSON.stringify(value),
        JSON.stringify(optionIds),
        fieldId,
      ),
  );
  if (!before || before.value !== JSON.stringify(value))
    writes.push(
      db
        .prepare(
          "INSERT INTO Activity (id,taskId,userId,type,data,createdAt) SELECT ?,?,?, 'custom_field_changed',?,? WHERE EXISTS(SELECT 1 FROM CustomFieldValue WHERE id=?)",
        )
        .bind(
          randomUUID(),
          taskId,
          a.user.id,
          audit,
          new Date().toISOString(),
          key,
        ),
    );
  const result = await db.batch(writes);
  if (!result[0].meta.changes)
    throw new AccessError(
      409,
      "La opción no está disponible. Actualizá el campo e intentá de nuevo.",
    );
  return { id: key, taskId, customFieldId: fieldId, value };
}
