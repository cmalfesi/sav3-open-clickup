import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Access, type Actor, type Grant, type Resource } from "@/lib/access-context";
import { authorizeResourceRequest } from "@/lib/request-access";
import { deleteListView } from "@/lib/list-view-service";

const require = createRequire(import.meta.url);
const { Miniflare } = require(require.resolve("miniflare", { paths: [require.resolve("wrangler")] }));
let mf: InstanceType<typeof Miniflare>;
let db: D1Database;

const resources: Resource[] = [
  { type: "LIST", id: "l" },
  { type: "DASHBOARD", id: "d" },
];

function actor(role: Actor["role"], grants: Grant[] = []): Actor {
  return {
    role, kind: "local", workspaceId: "w",
    user: { id: "member", email: "member@example.test", name: "M", color: "#000000", avatarUrl: null },
    access: new Access(role, false, resources, grants),
  };
}

const reader = actor("MEMBER", [{ resourceType: "LIST", resourceId: "l", level: "VIEW" }]);
const editor = actor("MEMBER", [
  { resourceType: "LIST", resourceId: "l", level: "EDIT" },
  { resourceType: "DASHBOARD", resourceId: "d", level: "VIEW" },
]);
const admin = actor("ADMIN");
const insertView = (id: string, type: string, config: string | null = null) =>
  db.prepare("INSERT INTO View (id,listId,name,type,config) VALUES (?,'l',?,?,?)").bind(id, id, type, config).run();

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}",
    compatibilityDate: "2026-05-15", d1Databases: { DB: "list-views" } });
  db = await mf.getD1Database("DB");
  for (const file of readdirSync("drizzle").filter(f => f.endsWith(".sql")).sort()) {
    for (const sql of readFileSync("drizzle/" + file, "utf8").split("--> statement-breakpoint")) {
      if (sql.trim()) await db.prepare(sql).run();
    }
  }
  await db.batch([
    db.prepare("INSERT INTO Workspace (id,name) VALUES ('w','W')"),
    db.prepare("INSERT INTO User (id,email,name) VALUES ('member','member@example.test','M')"),
    db.prepare("INSERT INTO Space (id,workspaceId,name) VALUES ('s','w','S')"),
    db.prepare("INSERT INTO List (id,spaceId,name) VALUES ('l','s','L')"),
    db.prepare("INSERT INTO Status (id,listId,name,type) VALUES ('open','l','Open','ACTIVE')"),
    db.prepare("INSERT INTO Task (id,listId,statusId,name,updatedAt) VALUES ('t','l','open','Task',CURRENT_TIMESTAMP)"),
    db.prepare("INSERT INTO Dashboard (id,name,sources,createdBy,createdAt) VALUES ('d','Dashboard','[\"l\"]','member',0)"),
  ]);
}, 30000);
afterAll(async () => { await mf?.dispose(); });

describe("shared view management", () => {
  it("rejects shared mutations from a reader and deletes an ordinary view for an editor", async () => {
    await insertView("list", "LIST");
    await insertView("board", "BOARD");
    const url = "https://example.test/api/views/board";
    await expect(authorizeResourceRequest(new Request(url, { method: "PATCH", headers: { Origin: "https://example.test" } }), db, reader))
      .rejects.toMatchObject({ status: 403 });
    await expect(deleteListView(db, reader, "board")).rejects.toMatchObject({ status: 403 });
    await db.batch([
      db.prepare("INSERT INTO UserViewPreference (userId,viewId,updatedAt) VALUES ('member','board',0)"),
      db.prepare("INSERT INTO UserListPreference (userId,listId,activeViewId,updatedAt) VALUES ('member','l','board',0)"),
    ]);
    await deleteListView(db, editor, "board");
    expect(await db.prepare("SELECT id FROM View WHERE id='board'").first()).toBeNull();
    expect(await db.prepare("SELECT viewId FROM UserViewPreference WHERE viewId='board'").first()).toBeNull();
    expect(await db.prepare("SELECT activeViewId FROM UserListPreference WHERE listId='l'").first()).toEqual({ activeViewId: null });
    expect(await db.prepare("SELECT action FROM AccessAudit WHERE targetId='board'").first()).toEqual({ action: "view.delete" });
    expect(await db.prepare("SELECT id FROM Task WHERE id='t'").first()).toEqual({ id: "t" });
  });

  it("requires dashboard edit permission and unlinks the view without deleting the dashboard", async () => {
    await insertView("dashboard", "DASHBOARD", JSON.stringify({ dashboardId: "d" }));
    await expect(deleteListView(db, editor, "dashboard")).rejects.toMatchObject({ status: 403 });
    await deleteListView(db, admin, "dashboard");
    expect(await db.prepare("SELECT id FROM View WHERE id='dashboard'").first()).toBeNull();
    expect(await db.prepare("SELECT id FROM Dashboard WHERE id='d'").first()).toEqual({ id: "d" });
  });

  it("retains an ordinary view when editors delete two views concurrently", async () => {
    await insertView("calendar", "CALENDAR");
    const results = await Promise.allSettled([
      deleteListView(db, editor, "list"),
      deleteListView(db, admin, "calendar"),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await db.prepare("SELECT count(*) AS count FROM View WHERE listId='l'").first()).toEqual({ count: 1 });
  });
});
