import React from "react";
import { env } from "cloudflare:workers";
import { AppShell } from "@/components/app-shell";
import { RestoreGate } from "@/components/restore-gate";
export const dynamic = "force-dynamic";
export default async function AppLayout({children}:{children:React.ReactNode}) {
  if (!env.DB) throw new Error("Database binding unavailable");
  const state = await env.DB.prepare("SELECT complete FROM RestoreState WHERE id = ?")
    .bind("backup-2026-10-30").first<{ complete: number }>();
  return <RestoreGate initialReady={state?.complete === 1}><AppShell>{children}</AppShell></RestoreGate>;
}
