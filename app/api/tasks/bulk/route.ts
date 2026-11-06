import { NextResponse } from "next/server";
import { z } from "zod";
import {trashTasks} from "@/lib/trash-service";
import {saveCustomFieldValue} from "@/lib/custom-field-service";
import {actor} from "@/lib/access-context";
import { getD1, prisma } from "@/lib/db";
import { updateTask } from "@/lib/tasks";
import { requireRole } from "@/lib/permissions";
import { readJson, route } from "@/lib/api-helpers";
import { publish } from "@/lib/events";

async function notifyLists(ids: string[]) {
  const tasks = await prisma.task.findMany({ where: { id: { in: ids } }, select: { listId: true } });
  for (const listId of new Set(tasks.map((t) => t.listId))) publish({ type: "list", listId });
}

const schema = z.object({
  ids: z.array(z.string()).max(200).min(1, "ids[] required"),
  delete: z.boolean().optional(),
  customField: z.object({fieldId:z.string().min(1),value:z.unknown()}).optional(),
  patch: z
    .object({
      statusId: z.string().optional(),
      priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
      assigneeIds: z.array(z.string()).optional(),
      tagIds: z.array(z.string()).optional(),
      dueDate: z.string().datetime().nullable().optional(),
      archived: z.boolean().optional(),
    })
    .optional(),
});

export const POST = route(async (req) => {
  const {user}=await requireRole("MEMBER");
  const { ids, patch, customField, delete: del } = await readJson(req, schema);

  if (del) {
    await notifyLists(ids); // resolve listIds before the rows are gone
    await trashTasks(getD1(),actor(),ids);
    return NextResponse.json({ ok: true, deleted: ids.length });
  }

  const failed:{id:string;error:string}[]=[];let updated=0;
  for(const taskId of ids){try{if(patch)await updateTask(taskId,patch,user.id);if(customField)await saveCustomFieldValue(getD1(),actor(),taskId,customField.fieldId,customField.value);updated++;}catch(e){failed.push({id:taskId,error:e instanceof Error?e.message:'No se pudo guardar.'});}}

  await notifyLists(ids);
  return NextResponse.json({ ok: failed.length===0, updated, failed });
});
