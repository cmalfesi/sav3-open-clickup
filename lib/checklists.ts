import {z} from "zod";
import {prisma,getD1} from "./db";
import {actor,Access,AccessError,type Grant,type Role} from "./access-context";
import {userSelect} from "./queries";
import {createNotifications} from "./notifications";

export const checklistItemInput = z.object({
  name:z.string().trim().min(1).max(2000),
  assigneeId:z.string().min(1).max(200).nullable().optional(),
});
export const checklistItemPatch = checklistItemInput.partial().extend({resolved:z.boolean().optional()}).strict();
export const checklistItemInclude = {assignee:{select:userSelect}};

async function validateAssignee(taskId:string,userId:string|null|undefined) {
  if(!userId)return;
  const a=actor(),db=getD1();
  const [members,grants,policies]=await db.batch([
    db.prepare("SELECT m.role,a.scopeAll FROM WorkspaceMember m JOIN AccountAccess a ON a.userId=m.userId AND a.enabled=1 WHERE m.workspaceId=? AND m.userId=?").bind(a.workspaceId,userId),
    db.prepare("SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=?").bind(userId),
    db.prepare("SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1"),
  ]);
  const member=members.results[0] as {role:Role;scopeAll:number}|undefined;
  const resources=(['SPACE','LIST','TASK','DASHBOARD'] as const).flatMap(type=>a.access.resources(type));
  if(!member||!new Access(member.role,!!member.scopeAll,resources,grants.results as Grant[],(policies.results as {resourceType:string;resourceId:string}[]).map(p=>`${p.resourceType}:${p.resourceId}`)).can('TASK',taskId))
    throw new AccessError(400,'El responsable debe ser un usuario activo con acceso a esta tarea.');
}
export async function addChecklistItem(checklistId:string,input:z.infer<typeof checklistItemInput>) {
  const a=actor();
  const cl=await prisma.checklist.findUnique({where:{id:checklistId},select:{taskId:true}});
  if(!cl)throw new AccessError(404,'Checklist no encontrado.');
  a.access.assert('TASK',cl.taskId,'EDIT');
  await validateAssignee(cl.taskId,input.assigneeId);
  const last=await prisma.checklistItem.findFirst({where:{checklistId},orderBy:{position:'desc'},select:{position:true}});
  const saved=await prisma.checklistItem.create({data:{...input,checklistId,position:(last?.position??0)+1000},include:checklistItemInclude});
  if(saved.assigneeId)await createNotifications({recipientIds:[saved.assigneeId],actorId:a.user.id,taskId:cl.taskId,type:'assigned',body:'te asignó un ítem de checklist'});
  return saved;
}
export async function updateChecklistItem(itemId:string,input:z.infer<typeof checklistItemPatch>) {
  const a=actor();
  const previous=await prisma.checklistItem.findUnique({where:{id:itemId},include:{checklist:{select:{taskId:true}}}});
  if(!previous)throw new AccessError(404,'Ítem no encontrado.');
  a.access.assert('TASK',previous.checklist.taskId,'EDIT');
  await validateAssignee(previous.checklist.taskId,input.assigneeId);
  const saved=await prisma.checklistItem.update({where:{id:itemId},data:input,include:checklistItemInclude});
  if(saved.assigneeId&&saved.assigneeId!==previous.assigneeId)await createNotifications({recipientIds:[saved.assigneeId],actorId:a.user.id,taskId:previous.checklist.taskId,type:'assigned',body:'te asignó un ítem de checklist'});
  return saved;
}

/** List only enabled members who can read this task; assignment grants no new access. */
export async function checklistAssignees(taskId:string){
 const a=actor();a.access.assert('TASK',taskId);
 const [members,grants,policies]=await getD1().batch([
  getD1().prepare('SELECT u.id,u.name,u.email,u.color,u.avatarUrl,m.role,a.scopeAll FROM User u JOIN AccountAccess a ON a.userId=u.id AND a.enabled=1 JOIN WorkspaceMember m ON m.userId=u.id AND m.workspaceId=? ORDER BY u.name,u.id').bind(a.workspaceId),
  getD1().prepare('SELECT userId,resourceType,resourceId,level FROM ResourceGrant'),
  getD1().prepare('SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1'),
 ]);
 const resources=(['SPACE','LIST','TASK','DASHBOARD'] as const).flatMap(type=>a.access.resources(type));
 const restricted=(policies.results as {resourceType:string;resourceId:string}[]).map(p=>`${p.resourceType}:${p.resourceId}`);
 return (members.results as (import('./queries').UserLite&{role:Role;scopeAll:number})[])
  .filter(u=>new Access(u.role,!!u.scopeAll,resources,(grants.results as (Grant&{userId:string})[]).filter(g=>g.userId===u.id),restricted).can('TASK',taskId))
  .map(({id,name,email,color,avatarUrl})=>({id,name,email,color,avatarUrl}));
}
