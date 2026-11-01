import {env} from 'cloudflare:workers';import {prisma} from '@/lib/db';import {requireUser} from '@/lib/auth';import {route,ApiError} from '@/lib/api-helpers';
export const GET=route(async(_req,{params}:{params:Promise<{id:string}>})=>{
 await requireUser();const {id}=await params;const attachment=await prisma.attachment.findUnique({where:{id}});
 if(!attachment||!env.BUCKET)throw new ApiError(404,'File not found');const file=await env.BUCKET.get(id);if(!file)throw new ApiError(404,'File not found');
 const safeImage=/^image\/(png|jpeg|webp|gif)$/.test(attachment.mime);
 return new Response(file.body,{headers:{'Content-Type':safeImage?attachment.mime:'application/octet-stream','Content-Disposition':(safeImage?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(attachment.name),'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
});
