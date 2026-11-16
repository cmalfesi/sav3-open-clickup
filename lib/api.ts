import {beginWrite,foregroundWrite} from "./write-status";
let mutationClientId: string | undefined;
export function mutationSource() { return mutationClientId ??= crypto.randomUUID(); }

export async function apiGet<T>(url: string, signal?:AbortSignal): Promise<T> {
  const res = await fetch(url,{signal});
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

// Coalesce repeated creates/deletes only while the identical request is in flight.
// PATCH/PUT must retain order: A → B → A are three different user intents.
const inFlight = new Map<string,Promise<unknown>>();
export function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  options?: {keepalive?:boolean},
): Promise<T> {
  const serialized=body===undefined?undefined:JSON.stringify(body);
  const key=JSON.stringify([url,method,serialized]);
  const coalesce=foregroundWrite(url)&&(method==='POST'||method==='DELETE');
  if(coalesce&&inFlight.has(key))return inFlight.get(key) as Promise<T>;
  const end=foregroundWrite(url)?beginWrite():()=>{};
  const promise=(async()=>{
    try {
      const res = await fetch(url, {
        method,
        keepalive:options?.keepalive,
        headers: { "X-SAV3-Client": mutationSource(), ...(serialized!==undefined ? { "Content-Type": "application/json" } : {}) },
        body:serialized,
      });
      if (!res.ok) {
        const result = await res.json().catch(() => null) as {error?:unknown} | null;
        throw new Error(typeof result?.error === "string" ? result.error : "No pudimos guardar el cambio. Volvé a intentar.");
      }
      const result=await res.json() as T;
      end();return result;
    } catch(error) {
      const problem=error instanceof TypeError?new Error('Se interrumpió la conexión. El resultado no está confirmado: verificá el contenido antes de volver a enviarlo.'):error;
      end(problem);throw problem;
    } finally {if(coalesce)inFlight.delete(key);}
  })();
  if(coalesce)inFlight.set(key,promise);
  return promise;
}
