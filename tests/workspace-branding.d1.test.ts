import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Access, type Actor } from "@/lib/access-context";
import { workspaceBrandingRoute } from "@/lib/workspace-branding-service";
import { brandingPath } from "@/lib/workspace-branding";

const require = createRequire(import.meta.url);
const { Miniflare } = require(require.resolve("miniflare", { paths: [require.resolve("wrangler")] }));
let mf: InstanceType<typeof Miniflare>;
let db: D1Database;
let bucket: R2Bucket;
const origin = "https://example.test";
const sample = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4d8AAAAASUVORK5CYII=", "base64"));

function actor(role: Actor["role"], workspaceId = "w", kind: Actor["kind"] = "local"): Actor {
  return { role, workspaceId, kind, access: new Access(role, false, [], []),
    user: { id: "user", email: "user@example.test", name: "User", color: "#000000", avatarUrl: null } };
}
async function save(input: { name: string; logo?: File; remove?: boolean }, who: Actor | null, requestOrigin = origin) {
  const form = new FormData();
  form.set("name", input.name);
  if (input.logo) form.set("logo", input.logo);
  if (input.remove) form.set("removeLogo", "true");
  return (await workspaceBrandingRoute(new Request(origin + brandingPath,
    { method: "POST", headers: { Origin: requestOrigin }, body: form }), db, bucket, who))!;
}
const logoRequest = (path: string, who: Actor | null) =>
  workspaceBrandingRoute(new Request(origin + path), db, bucket, who);

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: "export default {fetch(){return new Response('ok')}}",
    compatibilityDate: "2026-05-15", d1Databases: { DB: "branding" }, r2Buckets: { BUCKET: "branding" } });
  db = await mf.getD1Database("DB");
  bucket = await mf.getR2Bucket("BUCKET");
  for (const file of readdirSync("drizzle").filter(f => f.endsWith(".sql")).sort()) {
    for (const sql of readFileSync("drizzle/" + file, "utf8").split("--> statement-breakpoint")) {
      if (sql.trim()) await db.prepare(sql).run();
    }
  }
  await db.prepare("INSERT INTO Workspace (id,name) VALUES ('w','Original'),('other','Other')").run();
}, 30000);
afterAll(async () => { await mf?.dispose(); });

describe("workspace branding", () => {
  it("rejects anonymous, member, integration-token and cross-origin writes", async () => {
    expect((await save({ name: "Nuevo" }, null)).status).toBe(401);
    expect((await save({ name: "Nuevo" }, actor("MEMBER"))).status).toBe(403);
    expect((await save({ name: "Nuevo" }, actor("ADMIN", "w", "token"))).status).toBe(403);
    expect((await save({ name: "Nuevo" }, actor("OWNER"), "https://other.test")).status).toBe(403);
    expect(await db.prepare("SELECT name FROM Workspace WHERE id='w'").first()).toEqual({ name: "Original" });
  });

  it("validates names and image signatures", async () => {
    const admin = actor("ADMIN");
    expect((await save({ name: " " }, admin)).status).toBe(400);
    expect((await save({ name: "Nuevo", logo: new File(["<svg/>"], "spoof.png", { type: "image/png" }) }, admin)).status).toBe(400);
    const oversized = new File([new Uint8Array(1024 * 1024 + 1)], "big.png", { type: "image/png" });
    expect((await save({ name: "Nuevo", logo: oversized }, admin)).status).toBe(413);
  });

  it("persists, replaces and removes a logo while isolating workspace reads", async () => {
    const admin = actor("ADMIN");
    const png = new File([sample], "logo.png", { type: "image/png" });
    const response = await save({ name: " Equipo nuevo ", logo: png }, admin);
    expect(response.status).toBe(200);
    const first = await response.json() as { name: string; avatarUrl: string };
    expect(first.name).toBe("Equipo nuevo");
    expect((await logoRequest(first.avatarUrl, null))?.status).toBe(401);
    expect((await logoRequest(first.avatarUrl, actor("MEMBER", "other")))?.status).toBe(404);
    const image = await logoRequest(first.avatarUrl, actor("MEMBER"));
    expect(image?.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await image!.arrayBuffer())).toEqual(sample);
    const second = await (await save({ name: "Renombrado", logo: png }, admin)).json() as { avatarUrl: string };
    expect(second.avatarUrl).not.toBe(first.avatarUrl);
    expect((await logoRequest(first.avatarUrl, admin))?.status).toBe(404);
    expect(await (await save({ name: "Renombrado", remove: true }, admin)).json()).toEqual({ name: "Renombrado", avatarUrl: null });
    expect((await logoRequest(second.avatarUrl, admin))?.status).toBe(404);
    expect(await db.prepare("SELECT count(*) AS n FROM AccessAudit WHERE action='workspace.branding'").first()).toEqual({ n: 3 });
  });
});
