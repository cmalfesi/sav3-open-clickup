import { actorOrNull } from "./access-context";
import { ApiError } from "./api-helpers";
export { hashPassword, verifyPassword } from "./password";
export async function getCurrentUser() { return actorOrNull()?.user ?? null; }
export async function requireUser() { const user = await getCurrentUser(); if (!user)
    throw new ApiError(401, "Iniciá sesión para continuar."); return user; }
export async function createSession(_userId: string): Promise<never> { throw new ApiError(403, "Las sesiones se crean desde el ingreso seguro."); }
export async function destroySession() { return; }
