import { env } from "cloudflare:workers";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

let client: PrismaClient | undefined;
function getClient() {
  if (!env.DB) throw new Error("D1 binding is unavailable");
  return client ??= new PrismaClient({ adapter: new PrismaD1(env.DB) });
}
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const instance = getClient();
    const value = Reflect.get(instance, key);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
