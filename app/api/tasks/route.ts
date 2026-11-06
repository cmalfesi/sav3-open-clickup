import { NextResponse } from "next/server";
import { z } from "zod";
import {getListData} from "@/lib/queries";
import {ApiError} from "@/lib/api-helpers";
import { createTask } from "@/lib/tasks";
import { requireRole } from "@/lib/permissions";
import { readJson, route } from "@/lib/api-helpers";

const schema = z.object({
  listId: z.string().min(1),
  name: z.string().trim().min(1, "name is required"),
  statusId: z.string().optional(),
  parentId: z.string().nullish(),
  priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).nullish(),
  assigneeIds: z.array(z.string()).optional(),
});

export const POST = route(async (req) => {
  const body = await readJson(req, schema);
  const { user } = await requireRole("MEMBER");
  const task = await createTask({
    listId: body.listId,
    name: body.name,
    statusId: body.statusId,
    parentId: body.parentId ?? null,
    priority: body.priority ?? null,
    assigneeIds: body.assigneeIds ?? [],
    createdById: user.id,
  });
  return NextResponse.json(task, { status: 201 });
});

export const GET=route(async(req)=>{const u=new URL(req.url),id=u.searchParams.get('listId');if(!id)throw new ApiError(400,'listId es obligatorio.');const data=await getListData(id);if(!data)throw new ApiError(404,'Lista no disponible.');const offset=Math.max(0,Math.floor(Number(u.searchParams.get('offset')))||0),limit=Math.min(100,Math.max(1,Math.floor(Number(u.searchParams.get('limit')))||50));return Response.json({tasks:data.tasks.slice(offset,offset+limit),nextOffset:offset+limit<data.tasks.length?offset+limit:null,total:data.tasks.length});});
