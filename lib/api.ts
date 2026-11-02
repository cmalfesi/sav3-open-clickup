let mutationClientId: string | undefined;
export function mutationSource() { return mutationClientId ??= crypto.randomUUID(); }

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "X-SAV3-Client": mutationSource(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as {error?:unknown} | null;
    throw new Error(typeof body?.error === "string" ? body.error : "No pudimos guardar el cambio. Volvé a intentar.");
  }
  return res.json();
}
