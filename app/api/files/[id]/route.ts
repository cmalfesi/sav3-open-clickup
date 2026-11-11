import {env} from 'cloudflare:workers';
import {prisma} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {route,ApiError} from '@/lib/api-helpers';
import {attachmentResponse} from '@/lib/attachment-content';
export const GET=route(async(req,{params}:{params:Promise<{id:string}>})=>{
 await requireUser();const {id}=await params;const attachment=await prisma.attachment.findUnique({where:{id}});
 if(!attachment)throw new ApiError(404,'File not found');
 let body:ReadableStream<Uint8Array>|null=null;
 if(attachment.url.startsWith('/restored-files/')&&env.ASSETS){
  const response=await env.ASSETS.fetch(new Request(new URL(attachment.url,req.url)));
  if(response.ok)body=response.body;
 }else if(attachment.url.startsWith('/api/files/')){
  const file=await env.BUCKET?.get(id);body=file?.body??null;
 }
 if(!body)throw new ApiError(404,'File not found');
 return attachmentResponse(body,attachment.name,attachment.mime,new URL(req.url).searchParams.get('download')==='1');
});
