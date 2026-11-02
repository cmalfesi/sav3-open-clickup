import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { updateTask } from "@/lib/tasks";
import { requireRole } from "@/lib/permissions";
import { readJson, route } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

async function notifyLists(ids: string[]) {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { listId: true } });
  for (const listId of new Set(tasks.map((t) => t.listId))) publish({ type: "list", listId });
}

const schema = z.object({
  ids: z.array(z.string()).min(1, "ids[] required"),
  delete: z.boolean().optional(),
  patch: z
    .object({
      statusId: z.string().optional(),
      priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
      assigneeIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export const POST = route(async (req) => {
  const {user}=await requireRole("MEMBER");
  const { ids, patch, delete: del } = await readJson(req, schema);

  if (del) {
    await notifyLists(ids); // resolve listIds before the rows are gone
    await prisma.task.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  if(patch)for(const taskId of ids)await updateTask(taskId,patch,user.id);

  await notifyLists(ids);
  return NextResponse.json({ ok: true, updated: ids.length });
});
