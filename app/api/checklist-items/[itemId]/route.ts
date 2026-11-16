import {NextResponse} from "next/server";
import {prisma} from "@/lib/db";
import {requireRole} from "@/lib/permissions";
import {readJson,route} from "@/lib/api-helpers";
import {updateChecklistItem,checklistItemPatch} from "@/lib/checklists";
type Ctx={params:Promise<{itemId:string}>};
export const PATCH=route(async(req,{params}:Ctx)=>{
  await requireRole("MEMBER");
  return NextResponse.json(await updateChecklistItem((await params).itemId,await readJson(req,checklistItemPatch)));
});
export const DELETE=route(async(_req,{params}:Ctx)=>{
  await requireRole("MEMBER");
  await prisma.checklistItem.delete({where:{id:(await params).itemId}});
  return NextResponse.json({ok:true});
});
