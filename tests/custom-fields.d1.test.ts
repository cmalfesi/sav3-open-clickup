import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { Access, type Actor } from "@/lib/access-context";
import { resourceGraph } from "@/lib/team-service";
import {
  customFieldRoute,
  effectiveFieldIds,
  fieldCatalog,
  saveCustomFieldValue,
} from "@/lib/custom-field-service";
import { dashboardDataset } from "@/lib/dashboard-service";
import { emptyDashboard } from "@/lib/dashboard-model";
import type { FieldInput } from "@/lib/custom-field-model";
const require = createRequire(import.meta.url);
const { Miniflare } = require(
  require.resolve("miniflare", { paths: [require.resolve("wrangler")] }),
);
let mf: InstanceType<typeof Miniflare>, db: D1Database;
const origin = "https://site.test";
async function actor(
  role: "OWNER" | "MEMBER" | "GUEST" = "OWNER",
): Promise<Actor> {
  return {
    user: {
      id: "owner",
      email: "owner@test.com",
      name: "Owner",
      color: "#000000",
      avatarUrl: null,
    },
    workspaceId: "w",
    role,
    kind: "local",
    access: new Access(
      role,
      role === "OWNER",
      await resourceGraph(db),
      role === "MEMBER"
        ? [{ resourceType: "LIST", resourceId: "l", level: "EDIT" }]
        : [],
    ),
  };
}
async function call(
  body?: unknown,
  id?: string,
  role: "OWNER" | "MEMBER" | "GUEST" = "OWNER",
  requestOrigin = origin,
) {
  return (await customFieldRoute(
    new Request(origin + "/api/custom-fields" + (id ? "/" + id : ""), {
      method: body ? "POST" : "GET",
      headers: { Origin: requestOrigin },
      body: body ? JSON.stringify(body) : undefined,
    }),
    db,
    await actor(role),
  ))!;
}
const definition = (locations: FieldInput["locations"]): FieldInput => ({
  name: "Etapa",
  type: "DROPDOWN",
  description: "",
  options: [{ label: "Inicial", color: "#112233" }],
  locations,
});
async function current(id: string) {
  return (await fieldCatalog(db, await actor())).fields.find(
    (f) => f.id === id,
  )!;
}
async function apply(file: string) {
  for (const sql of readFileSync("drizzle/" + file, "utf8").split(
    "--> statement-breakpoint",
  ))
    if (sql.trim()) await db.prepare(sql).run();
}
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "custom-fields-test" },
  });
  db = await mf.getD1Database("DB");
  const files = readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files.filter((f) => f < "0005")) await apply(f);
  await db.batch([
    db.prepare("INSERT INTO Workspace(id,name) VALUES ('w','Workspace')"),
    db.prepare(
      "INSERT INTO User(id,email,name) VALUES ('owner','owner@test.com','Owner')",
    ),
    db.prepare(
      "INSERT INTO Space(id,workspaceId,name) VALUES ('s','w','Space'),('empty','w','Empty space'),('other','w','Other space')",
    ),
    db.prepare(
      "INSERT INTO List(id,spaceId,name) VALUES ('l','s','Oportunidades'),('second','s','Second'),('hidden','other','Hidden')",
    ),
    db.prepare(
      "INSERT INTO Status(id,listId,name,type) VALUES ('st','l','Open','NOT_STARTED'),('st2','second','Open','NOT_STARTED')",
    ),
    db.prepare(
      "INSERT INTO Task(id,listId,statusId,name,updatedAt) VALUES ('t','l','st','Task',CURRENT_TIMESTAMP),('t2','second','st2','Task2',CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "INSERT INTO CustomField(id,listId,name,type,config,position) VALUES ('legacy','l','Etapa del Deal','DROPDOWN','{\"legacySetting\":true}',0)",
    ),
    db.prepare(
      "INSERT INTO CustomFieldOption(id,customFieldId,label,color,position) VALUES ('legacy-option','legacy','Won','#123456',0)",
    ),
    db.prepare(
      "INSERT INTO CustomFieldValue(id,taskId,customFieldId,value) VALUES ('v','t','legacy','\"legacy-option\"')",
    ),
  ]);
  for(const f of files.filter(f=>f >= "0005"))await apply(f);
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
describe("Custom Field Manager and compatibility", () => {
  it("preserves imported definitions, options and task values during the schema migration", async () => {
    expect((await current("legacy")).options[0].id).toBe("legacy-option");
    expect(
      await db
        .prepare("SELECT value FROM CustomFieldValue WHERE id='v'")
        .first(),
    ).toEqual({ value: '"legacy-option"' });
    expect(await db.prepare("PRAGMA foreign_key_check").all()).toMatchObject({
      results: [],
    });
  });
  it("edits an imported dropdown, preserving option identity, values, settings and audit", async () => {
    const f = await current("legacy");
    const r = await call(
      {
        ...f,
        name: "Etapa comercial",
        description: "Detalle",
        options: [
          { ...f.options[0], label: "Ganado", color: "#abcdef" },
          { label: "Negociación", color: "#445566" },
        ],
      },
      f.id,
    );
    expect(r.status).toBe(200);
    const saved = await current(f.id);
    expect(saved.options[0]).toMatchObject({
      id: "legacy-option",
      label: "Ganado",
      color: "#abcdef",
    });
    expect(await effectiveFieldIds(db, "l")).toContain("legacy");
    expect(
      await db
        .prepare("SELECT value FROM CustomFieldValue WHERE id='v'")
        .first(),
    ).toEqual({ value: '"legacy-option"' });
    const raw = await db
      .prepare("SELECT config FROM CustomField WHERE id='legacy'")
      .first<{ config: string }>();
    expect(JSON.parse(raw!.config)).toMatchObject({
      legacySetting: true,
      description: "Detalle",
    });
    expect(
      await db
        .prepare("SELECT actorId FROM AccessAudit WHERE targetId='legacy'")
        .first(),
    ).toEqual({ actorId: "owner" });
  });
  it("inherits a field even into a List created after an empty Space", async () => {
    const r = await call(definition([{ type: "SPACE", id: "empty" }]));
    expect(r.status).toBe(200);
    const { id } = (await r.json()) as { id: string };
    await db
      .prepare(
        "INSERT INTO List(id,spaceId,name) VALUES ('future','empty','Future')",
      )
      .run();
    expect(await effectiveFieldIds(db, "future")).toContain(id);
    expect(await effectiveFieldIds(db, "l")).not.toContain(id);
  });
  it("shares the same field and options across Lists and dashboard calculations", async () => {
    const f = await current("legacy");
    expect(
      (await call({ ...f, locations: [{ type: "SPACE", id: "s" }] }, f.id))
        .status,
    ).toBe(200);
    expect(await effectiveFieldIds(db, "second")).toContain(f.id);
    await saveCustomFieldValue(db, await actor(), "t2", f.id, "legacy-option");
    const data = await dashboardDataset(
      db,
      await actor(),
      emptyDashboard(["second"]),
    );
    expect(data.fields.find((x) => x.id === f.id)?.options[0].name).toBe(
      "Ganado",
    );
    expect(data.tasks.find((x) => x.id === "t2")?.fields[f.id]).toBe(
      "legacy-option",
    );
  });
  it("rejects removal of a used option and rolls the whole edit back", async () => {
    const f = await current("legacy");
    const r = await call(
      {
        ...f,
        name: "Should roll back",
        options: f.options.filter((o) => o.id !== "legacy-option"),
      },
      f.id,
    );
    expect(r.status).toBe(409);
    expect((await current("legacy")).name).toBe(f.name);
    expect((await current("legacy")).revision).toBe(f.revision);
    await expect(
      saveCustomFieldValue(db, await actor(), "t", f.id, "not-an-option"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("allows members to create List fields and refuses Space or globally shared edits", async () => {
    expect(
      (await call(definition([{ type: "LIST", id: "l" }]), undefined, "MEMBER"))
        .status,
    ).toBe(200);
    expect(
      (
        await call(
          definition([{ type: "SPACE", id: "s" }]),
          undefined,
          "MEMBER",
        )
      ).status,
    ).toBe(403);
    const f = await current("legacy");
    expect((await call({ ...f, name: "No" }, f.id, "MEMBER")).status).toBe(403);
    const visible = await fieldCatalog(db, await actor("MEMBER"));
    expect(visible.fields.find((x) => x.id === "legacy")?.canEdit).toBe(false);
    expect(visible.locations.some((x) => x.id === "hidden")).toBe(false);
  });
  it("rejects anonymous, guest, foreign-origin and invalid configuration requests", async () => {
    expect(
      (await customFieldRoute(
        new Request(origin + "/api/custom-fields"),
        db,
        null,
      ))!.status,
    ).toBe(401);
    expect((await call(undefined, undefined, "GUEST")).status).toBe(403);
    expect(
      (
        await call(
          definition([{ type: "LIST", id: "l" }]),
          undefined,
          "OWNER",
          "https://evil.test",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call({
          ...definition([{ type: "LIST", id: "l" }]),
          options: [{ label: "Bad", color: "red" }],
        })
      ).status,
    ).toBe(400);
    const f = await current("legacy");
    expect(
      (
        await call(
          {
            ...f,
            options: [{ id: "foreign-id", label: "Invalid", color: "#112233" }],
          },
          f.id,
        )
      ).status,
    ).toBe(400);
  });
  it("uses revisions to refuse stale and concurrent updates", async () => {
    const f = await current("legacy");
    const results = await Promise.all([
      call({ ...f, name: "First" }, f.id),
      call({ ...f, name: "Second" }, f.id),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await current(f.id)).revision).toBe(f.revision + 1);
  });
  it("keeps shared values and field identity when the original List is removed", async () => {
    const f = await current("legacy");
    await db.prepare("DELETE FROM List WHERE id='l'").run();
    expect(await effectiveFieldIds(db, "second")).toContain(f.id);
    expect(
      await db
        .prepare(
          "SELECT value FROM CustomFieldValue WHERE taskId='t2' AND customFieldId='legacy'",
        )
        .first(),
    ).toEqual({ value: '"legacy-option"' });
  });
});
