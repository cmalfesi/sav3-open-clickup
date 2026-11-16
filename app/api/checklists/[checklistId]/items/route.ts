import {NextResponse} from "next/server";
import {requireRole} from "@/lib/permissions";
import {readJson,route} from "@/lib/api-helpers";
import {addChecklistItem,checklistItemInput} from "@/lib/checklists";
type Ctx={params:Promise<{checklistId:string}>};
export const POST=route(async(req,{params}:Ctx)=>{
  await requireRole("MEMBER");
  return NextResponse.json(await addChecklistItem((await params).checklistId,await readJson(req,checklistItemInput)),{status:201});
});
