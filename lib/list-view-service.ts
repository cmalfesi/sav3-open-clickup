import { randomUUID } from "node:crypto";
import { AccessError, type Actor } from "./access-context";

type ViewReference = { listId: string; type: string; config: unknown };

function dashboardId(config: unknown): string {
  try {
    const value = typeof config === "string" ? JSON.parse(config) : config;
    return typeof value?.dashboardId === "string" ? value.dashboardId : "";
  } catch {
    return "";
  }
}

export function canManageListView(actor: Actor, view: ViewReference): boolean {
  return actor.role !== "GUEST" && actor.kind !== "token"
    && actor.access.can("LIST", view.listId, "EDIT")
    && (view.type !== "DASHBOARD" || actor.access.can("DASHBOARD", dashboardId(view.config), "EDIT"));
}

export async function requireManageableListView(db: D1Database, actor: Actor, id: string) {
  const view = await db.prepare("SELECT listId, type, config FROM View WHERE id=?")
    .bind(id).first<{ listId: string; type: string; config: string | null }>();
  if (!view) throw new AccessError(404, "La vista ya no existe.");
  if (!canManageListView(actor, view)) throw new AccessError(403, "No tenés permiso para administrar esta vista.");
  return view;
}

export async function deleteListView(db: D1Database, actor: Actor, id: string) {
  const view = await requireManageableListView(db, actor, id);
  const condition = `id=? AND listId=? AND type=? AND config IS ?
    AND EXISTS (SELECT 1 FROM View sibling WHERE sibling.listId=View.listId
      AND sibling.id<>View.id AND sibling.type<>'DASHBOARD')`;
  const target = [id, view.listId, view.type, view.config] as const;
  const [, deletion] = await db.batch([
    db.prepare(`INSERT INTO AccessAudit (id,actorId,action,targetId,createdAt)
      SELECT ?,?,'view.delete',id,? FROM View WHERE ${condition}`)
      .bind(randomUUID(), actor.user.id, Date.now(), ...target),
    db.prepare(`DELETE FROM View WHERE ${condition}`).bind(...target),
  ]);
  if (!deletion.meta.changes) {
    throw new AccessError(409, "La vista cambió o es la última vista de tareas de la lista. Actualizá la lista antes de reintentar.");
  }
}

export async function createListView(db:D1Database,a:Actor,input:{listId:string;name:string;type:string;config?:unknown;duplicateId?:string}){
 if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');
 a.access.assert('LIST',input.listId,'EDIT');
 let config=input.config??{};
 if(input.duplicateId){const source=await requireManageableListView(db,a,input.duplicateId);if(source.listId!==input.listId||source.type==='DASHBOARD')throw new AccessError(400,'Vista incompatible.');config=source.config?JSON.parse(String(source.config)):{};}
 const id=randomUUID();
 await db.batch([
 db.prepare('INSERT INTO View(id,listId,name,type,config,position) VALUES(?,?,?,?,?,(SELECT coalesce(max(position),0)+1 FROM View WHERE listId=?))').bind(id,input.listId,input.name,input.type,JSON.stringify(config),input.listId),
 db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) VALUES(?,?,'view.create',?,?)").bind(randomUUID(),a.user.id,id,Date.now())]);
 return {id};
}
