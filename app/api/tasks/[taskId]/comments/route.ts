import { z } from 'zod';
import { route, readJson } from '@/lib/api-helpers';
import { requireRole } from '@/lib/permissions';
import { createComment } from '@/lib/comments';
export const POST=route(async(req,{params}:{params:Promise<{taskId:string}>})=>{
 await requireRole('MEMBER');const {taskId}=await params;
 const {body,parentId}=await readJson(req,z.object({body:z.string().trim().min(1).max(200000),parentId:z.string().nullish()}));
 return Response.json(await createComment(taskId,body,parentId),{status:201});
});
