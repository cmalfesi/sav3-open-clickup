// Keep the anonymous surface explicit. Anything not listed here requires a
// verified Site identity and membership, including static imported attachments.
const publicFiles = new Set([
  "/favicon.ico", "/favicon.svg", "/file.svg", "/globe.svg",
  "/next.svg", "/vercel.svg", "/window.svg",
]);

export function publicAccess(pathname: string): "page" | "asset" | null {
  if (pathname === "/" || pathname === "/login" || pathname === "/activate") return "page";
  if (publicFiles.has(pathname)) return "asset";
  if (pathname.startsWith("/_next/static/") &&
      !pathname.includes("%") && !pathname.includes("\\")) return "asset";
  return null;
}

export type AccessState = { ownerKey: string; complete: number } | null;

export async function authorizePrivateRequest(
  request: Request,
  readState: () => Promise<AccessState>,
): Promise<401 | 403 | 503 | null> {
  // Sites supplies this verified identity; a public Site may have no identity.
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!userId || !email) return 401;
  const state = await readState();
  if (!state?.complete) return 503;
  return state.ownerKey === userId ? null : 403;
}

export function privateResponse(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set("Cache-Control", "private, no-store");
  secured.headers.set("X-Robots-Tag", "noindex, noarchive");
  secured.headers.set("X-Content-Type-Options", "nosniff");
  return secured;
}
