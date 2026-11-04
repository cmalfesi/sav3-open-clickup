import { randomUUID } from "node:crypto";
import { AccessError, type Actor } from "./access-context";
import { brandingPath, logoTypes, maxLogoBytes, maxWorkspaceName, workspaceLogoVersion } from "./workspace-branding";

type Branding = { name: string; avatarUrl: string | null };

function matchesSignature(mime: string, bytes: Uint8Array) {
  const begins = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  switch (mime) {
    case "image/png": return begins([137, 80, 78, 71, 13, 10, 26, 10]);
    case "image/jpeg": return begins([255, 216, 255]);
    case "image/webp": return begins([82, 73, 70, 70]) && begins([87, 69, 66, 80], 8);
    default: return false;
  }
}

export async function workspaceBrandingRoute(
  req: Request, db: D1Database, bucket: R2Bucket | undefined, actor: Actor | null,
): Promise<Response | null> {
  const url = new URL(req.url);
  if (url.pathname !== brandingPath && !url.pathname.startsWith(brandingPath + "/")) return null;
  try {
    if (!actor) throw new AccessError(401, "Iniciá sesión.");
    if (actor.kind === "token") throw new AccessError(403, "Usá una sesión del espacio.");
    const isLogo = url.pathname !== brandingPath;
    if (isLogo ? req.method !== "GET" : req.method !== "POST") {
      throw new AccessError(405, "Método no permitido.");
    }
    if (!isLogo) {
      if (!actor.access.admin) throw new AccessError(403, "Solo administradores pueden cambiar la marca.");
      if (req.headers.get("Origin") !== url.origin) throw new AccessError(403, "Origen no permitido.");
    }

    const workspaceId = actor.workspaceId;
    const previous = await db.prepare("SELECT name,avatarUrl FROM Workspace WHERE id=?")
      .bind(workspaceId).first<Branding>();
    if (!previous) throw new AccessError(404, "Espacio no encontrado.");
    const previousVersion = workspaceLogoVersion(previous.avatarUrl);
    const key = (version: string) => `workspace-brand/${workspaceId}/${version}`;
    if (isLogo) {
      if (!previousVersion || url.pathname !== previous.avatarUrl) throw new AccessError(404, "Logo no disponible.");
      const object = await bucket?.get(key(previousVersion));
      if (!object) throw new AccessError(404, "Logo no disponible.");
      return new Response(object.body, { headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      } });
    }

    const maxFormBytes = maxLogoBytes + 16 * 1024;
    if (Number(req.headers.get("Content-Length")) > maxFormBytes) {
      throw new AccessError(413, "El logo debe pesar hasta 1 MB.");
    }
    let size = 0;
    let oversized = false;
    const stream = req.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;
        if (size > maxFormBytes) {
          oversized = true;
          controller.error(new Error("Formulario demasiado grande."));
        } else {
          controller.enqueue(chunk);
        }
      },
    }));
    const body = await new Response(stream, { headers: req.headers }).formData().catch(() => {
      if (oversized) throw new AccessError(413, "El logo debe pesar hasta 1 MB.");
      throw new AccessError(400, "Formulario inválido.");
    });
    const value = body.get("name");
    const name = typeof value === "string" ? value.trim() : "";
    const file = body.get("logo");
    const removeLogo = body.get("removeLogo") === "true";
    if (!name || name.length > maxWorkspaceName) throw new AccessError(400, "Ingresá un nombre de 1 a 80 caracteres.");
    if ((file !== null && !(file instanceof File)) || (file && removeLogo)) throw new AccessError(400, "Logo inválido.");

    let newVersion: string | null = null;
    let avatarUrl = removeLogo ? null : previous.avatarUrl;
    if (file instanceof File) {
      if (file.size > maxLogoBytes) throw new AccessError(413, "El logo debe pesar hasta 1 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!logoTypes.includes(file.type) || !matchesSignature(file.type, bytes)) {
        throw new AccessError(400, "Usá un archivo PNG, JPEG o WebP válido.");
      }
      if (!bucket) throw new AccessError(503, "El almacenamiento de logos no está disponible.");
      newVersion = randomUUID();
      await bucket.put(key(newVersion), bytes, { httpMetadata: { contentType: file.type } });
      avatarUrl = `${brandingPath}/logo/${newVersion}`;
    }

    if (name === previous.name && avatarUrl === previous.avatarUrl) return Response.json(previous);
    const condition = "id=? AND name=? AND avatarUrl IS ?";
    const current = [workspaceId, previous.name, previous.avatarUrl] as const;
    const [, update] = await db.batch([
      db.prepare(`INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt)
        SELECT ?,?,'workspace.branding',id,? FROM Workspace WHERE ${condition}`)
        .bind(randomUUID(), actor.user.id, Date.now(), ...current),
      db.prepare(`UPDATE Workspace SET name=?,avatarUrl=? WHERE ${condition}`).bind(name, avatarUrl, ...current),
    ]);
    if (!update.meta.changes) {
      if (newVersion) await bucket?.delete(key(newVersion)).catch(() => undefined);
      throw new AccessError(409, "La marca cambió en otra sesión. Recargá antes de guardar.");
    }
    if (previousVersion && previous.avatarUrl !== avatarUrl) {
      await bucket?.delete(key(previousVersion)).catch(() => undefined);
    }
    return Response.json({ name, avatarUrl });
  } catch (error) {
    if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[workspace-branding] No se pudo completar la operación.", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "No pudimos actualizar la marca." }, { status: 500 });
  }
}
