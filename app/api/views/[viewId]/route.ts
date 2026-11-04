import { NextResponse } from "next/server";
import { z } from "zod";
import { getD1, prisma } from "@/lib/db";
import { actor } from "@/lib/access-context";
import { deleteListView, requireManageableListView } from "@/lib/list-view-service";
import { requireRole } from "@/lib/permissions";
import { ApiError, readJson, route } from "@/lib/api-helpers";

type Ctx = { params: Promise<{ viewId: string }> };
const schema = z.object({
  config: z.any().optional(),
  name: z.string().trim().min(1).optional(),
});

export const PATCH = route(async (req, { params }: Ctx) => {
  const { viewId } = await params;
  await requireRole("MEMBER");
  const current = await requireManageableListView(getD1(), actor(), viewId);
  if (current.type === "DASHBOARD") throw new ApiError(405, "Los dashboards se editan desde el panel.");
  const body = await readJson(req, schema);
  const data: Record<string, unknown> = {};
  if (body.config !== undefined) data.config = body.config;
  if (body.name !== undefined) data.name = body.name;
  const view = await prisma.view.update({ where: { id: viewId }, data });
  return NextResponse.json(view);
});


export const DELETE = route(async (_req, { params }: Ctx) => {
  await requireRole("MEMBER");
  await deleteListView(getD1(), actor(), (await params).viewId);
  return NextResponse.json({ ok: true });
});
