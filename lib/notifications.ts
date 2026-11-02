import { prisma, getD1 } from "@/lib/db";
import { Access } from "./access-context";
import { resourceGraph } from "./team-service";
import { extractMentionIds } from "./mentions";
export { extractMentionIds };
export async function createNotifications(opts:{recipientIds:string[];actorId:string;taskId:string;type:"mention"|"assigned"|"comment";body:string}):Promise<void> {
 const recipients=[...new Set(opts.recipientIds)].filter(id=>id!==opts.actorId);
 if(!recipients.length)return;
 const db=getD1(),resources=await resourceGraph(db),data=[];
 for(const userId of recipients) {
  const [account,grants,policies]=await db.batch([
   db.prepare('SELECT m.role,a.scopeAll,coalesce(p.mentions,1) mentions,coalesce(p.assigned,1) assigned,coalesce(p.comments,1) comments FROM WorkspaceMember m JOIN AccountAccess a ON a.userId=m.userId AND a.enabled=1 LEFT JOIN NotificationPreference p ON p.userId=m.userId WHERE m.userId=? AND m.workspaceId=?').bind(userId,'90132980889'),
   db.prepare('SELECT resourceType,resourceId,level FROM ResourceGrant WHERE userId=?').bind(userId),
   db.prepare('SELECT resourceType,resourceId FROM ResourcePolicy WHERE restricted=1')]);
  const m=account.results[0] as {role:import('./access-context').Role;scopeAll:number;mentions:number;assigned:number;comments:number}|undefined;
  if(!m || !m[opts.type==='mention'?'mentions':opts.type==='comment'?'comments':'assigned'])continue;
  const access=new Access(m.role,!!m.scopeAll,resources,grants.results as import('./access-context').Grant[],(policies.results as {resourceType:string;resourceId:string}[]).map(p=>`${p.resourceType}:${p.resourceId}`));
  if(!access.can('TASK',opts.taskId))continue;
  data.push({userId,actorId:opts.actorId,taskId:opts.taskId,type:opts.type,body:opts.body});
 }
 if(data.length)await prisma.notification.createMany({data});
}
export async function notifyNewMentions(taskId:string,actorId:string,before:string,after:string) {
 const old=new Set(extractMentionIds(before));
 await createNotifications({taskId,actorId,type:'mention',body:'te mencionó en una tarea',recipientIds:extractMentionIds(after).filter(id=>!old.has(id))});
}
