import { AppShell } from "@/components/app-shell";
import { RestoreGate } from "@/components/restore-gate";
export const dynamic = "force-dynamic";
export default function AppLayout({children}:{children:React.ReactNode}) {
  return <RestoreGate><AppShell>{children}</AppShell></RestoreGate>;
}
