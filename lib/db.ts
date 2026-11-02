import { env } from "cloudflare:workers";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

export function getD1() {
  if (!env.DB) throw new Error("D1 binding is unavailable");
  return env.DB;
}

let client: PrismaClient | undefined;
function getClient() {
  return client ??= new PrismaClient({ adapter: new PrismaD1(getD1()) });
}
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const instance = getClient();
    const value = Reflect.get(instance, key);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
