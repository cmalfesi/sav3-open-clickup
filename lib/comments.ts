import { actor } from "./access-context";
import { prisma } from "./db";
import { userSelect } from "./queries";
import { createNotifications, extractMentionIds } from "./notifications";
import { publish } from "./events";
export async function createComment(taskId:string,body:string,parentId?:string|null) {
 const a=actor();a.access.assert('TASK',taskId,'COMMENT');
 if(a.role==='GUEST')throw new Error('Los invitados solo pueden leer.');
 if(parentId){const parent=await prisma.comment.findUnique({where:{id:parentId}});if(parent?.taskId!==taskId)throw new Error('El comentario pertenece a otra tarea.');}
 const task=await prisma.task.findUniqueOrThrow({where:{id:taskId},select:{listId:true,assignees:true,watchers:true}});
 const comment=await prisma.comment.create({data:{taskId,userId:a.user.id,body,parentId:parentId??null},include:{user:{select:userSelect},reactions:true}});
 await prisma.activity.create({data:{taskId,userId:a.user.id,type:'commented',data:{commentId:comment.id,source:a.channel??'web'}}});
 const mentions=extractMentionIds(body);
 await createNotifications({recipientIds:mentions,actorId:a.user.id,taskId,type:'mention',body:'te mencionó en un comentario'});
 const parent=parentId?await prisma.comment.findUnique({where:{id:parentId},select:{userId:true}}):null;
 await createNotifications({recipientIds:[...task.assignees,...task.watchers,...(parent?[parent]:[])].map(x=>x.userId).filter(id=>!mentions.includes(id)),actorId:a.user.id,taskId,type:'comment',body:parentId?'respondió en una tarea que seguís':'comentó una tarea que seguís'});
 publish({type:'list',listId:task.listId,clientId:a.clientId});return comment;
}
