import {imageMime} from '@/lib/attachment-content';
import {env} from 'cloudflare:workers';
import {prisma} from '@/lib/db';
import {requireRole} from '@/lib/permissions';
import {route,ApiError} from '@/lib/api-helpers';
export const POST=route(async(req,{params}:{params:Promise<{taskId:string}>})=>{
  const {user}=await requireRole('MEMBER');const {taskId}=await params;
  if(!await prisma.task.findUnique({where:{id:taskId}}))throw new ApiError(404,'Task not found');
  const file=(await req.formData()).get('file');
  if(!(file instanceof File)||!file.size)throw new ApiError(400,'File required');
  if(file.size>25*1024*1024)throw new ApiError(413,'File exceeds 25 MB');
  if(!env.BUCKET)throw new ApiError(503,'File storage unavailable');
  const mime=imageMime(new Uint8Array(await file.slice(0,12).arrayBuffer()))??file.type??'application/octet-stream';
  const id=crypto.randomUUID();await env.BUCKET.put(id,file.stream(),{httpMetadata:{contentType:mime||'application/octet-stream'}});
  const a=await prisma.attachment.create({data:{id,taskId,name:file.name,url:'/api/files/'+id,size:file.size,mime:mime||'application/octet-stream',uploadedById:user.id}});
  return Response.json(a,{status:201});
});
