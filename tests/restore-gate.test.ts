import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ first: vi.fn() }));
vi.mock("cloudflare:workers", () => ({
  env: { DB: { prepare: () => ({ bind: () => ({ first: database.first }) }) } },
}));
vi.mock("@/components/app-shell", () => ({ AppShell: "section" }));
import AppLayout from "@/app/(app)/layout";

describe("workspace initial render", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a restored workspace immediately on each page load", async () => {
    database.first.mockResolvedValue({ complete: 1 });
    for (const page of ["Dashboard A", "Dashboard B"]) {
      const html = renderToStaticMarkup(await AppLayout({ children: page }));
      expect(html).toContain(page);
      expect(html).not.toContain("Preparando");
      expect(html).not.toContain("0%");
    }
  });

  it.each([{ complete: 0 }, null])("keeps initial import available for %j", async (state) => {
    database.first.mockResolvedValue(state);
    const html = renderToStaticMarkup(await AppLayout({ children: "Workspace content" }));
    expect(html).toContain("Preparando tu espacio de trabajo");
    expect(html).not.toContain("Workspace content");
  });
});
