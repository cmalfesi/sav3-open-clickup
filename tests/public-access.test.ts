import { describe, expect, it, vi } from "vitest";
import { publicAccess, authorizePrivateRequest, privateResponse } from "@/lib/public-access";

describe("public entry boundary", () => {
  it("allows only the public entry and framework assets", () => {
    expect(publicAccess("/")).toBe("page");
    expect(publicAccess("/login")).toBe("page");
    expect(publicAccess("/_next/static/chunks/app.js")).toBe("asset");
    for (const path of ["/home", "/documents", "/lab-report", "/api/tasks/1", "/mcp", "/restored-files/file.bin", "/uploads/file.bin", "/_next/static/%2e%2e/file.bin"]) {
      expect(publicAccess(path)).toBeNull();
    }
  });

  it("denies anonymous access without querying private data", async () => {
    const read = vi.fn();
    expect(await authorizePrivateRequest(new Request("https://site.test/documents"), read)).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects other signed-in accounts and permits the existing owner", async () => {
    const request = (id: string) => new Request("https://site.test/api/tasks/1", { headers: {
      "oai-authenticated-user-id": id, "oai-authenticated-user-email": "test@example.com",
    } });
    const state = async () => ({ ownerKey: "owner", complete: 1 });
    expect(await authorizePrivateRequest(request("other"), state)).toBe(403);
    expect(await authorizePrivateRequest(request("owner"), state)).toBeNull();
    expect(await authorizePrivateRequest(request("owner"), async () => null)).toBe(503);
  });

  it("prevents caching of authenticated data and preserves response status", () => {
    const response = privateResponse(Response.json({ ok: true }, { status: 202 }));
    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, noarchive");
  });
});
