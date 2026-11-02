import { actor } from "@/lib/access-context";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { readJson, route } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ taskId: string; fieldId: string }> };
const schema = z.object({ value: z.any() });

// upsert (or clear) a custom field value for a task
export const PUT = route(async (req, { params }: Ctx) => {
  const { taskId, fieldId } = await params;
  const {user}=await requireRole("MEMBER");
  const before=await prisma.customFieldValue.findUnique({where:{taskId_customFieldId:{taskId,customFieldId:fieldId}}});
  const { value } = await readJson(req, schema);

  const isEmpty =
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (isEmpty) {
    await prisma.customFieldValue.deleteMany({ where: { taskId, customFieldId: fieldId } });
    if(before)await prisma.activity.create({data:{taskId,userId:user.id,type:'custom_field_changed',data:{fieldId,before:before.value,after:null,source:actor().channel??'web'}}});
    return NextResponse.json({ ok: true, cleared: true });
  }

  const saved = await prisma.customFieldValue.upsert({
    where: { taskId_customFieldId: { taskId, customFieldId: fieldId } },
    create: { taskId, customFieldId: fieldId, value },
    update: { value },
  });
  if(JSON.stringify(before?.value)!==JSON.stringify(value))await prisma.activity.create({data:{taskId,userId:user.id,type:'custom_field_changed',data:{fieldId,before:before?.value??null,after:value,source:actor().channel??'web'}}});
  return NextResponse.json(saved);
});
