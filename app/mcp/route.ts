import { z } from 'zod';
import { prisma } from '@/lib/db';
import { actor, AccessError } from '@/lib/access-context';
import { requireRole } from '@/lib/permissions';
import { getWorkspaceTree, getTaskDetail } from '@/lib/queries';
import { createTask, updateTask } from '@/lib/tasks';
import { createComment } from '@/lib/comments';
import { POST as restoreStep } from '@/app/api/restore/route';
const text=z.string().max(200000),id=z.string().min(1).max(200);
const schemas={
 prepare_workspace:z.object({}).strict(), get_workspace:z.object({}).strict(),
 search_tasks:z.object({query:z.string().max(300).optional(),list_id:id.optional()}).strict(),
 get_task:z.object({task_id:id}).strict(),
 create_task:z.object({list_id:id,name:z.string().trim().min(1).max(2000),description:text.optional(),status_id:id.optional(),priority:z.enum(['URGENT','HIGH','NORMAL','LOW']).optional(),parent_id:id.optional(),mention_user_ids:z.array(id).max(100).optional()}).strict(),
 update_task:z.object({task_id:id,expected_description:text.nullable().optional(),name:z.string().trim().min(1).max(2000).optional(),description:text.optional(),status_id:id.optional(),priority:z.enum(['URGENT','HIGH','NORMAL','LOW']).nullable().optional(),due_date:z.string().datetime().nullable().optional(),start_date:z.string().datetime().nullable().optional(),assignee_ids:z.array(id).max(100).optional(),mention_user_ids:z.array(id).max(100).optional()}).strict(),
 add_comment:z.object({task_id:id,body:text.min(1),parent_id:id.optional(),mention_user_ids:z.array(id).max(100).optional()}).strict(),
};
const descriptions:Record<keyof typeof schemas,string>={prepare_workspace:'Solo administradores: reanuda la importación del respaldo.',get_workspace:'Consulta los espacios y listas permitidos para tu usuario.',search_tasks:'Busca hasta 100 tareas visibles para tu usuario.',get_task:'Lee una tarea permitida con su contenido y actividad.',create_task:'Crea una tarea en una lista donde tenés permiso de edición.',update_task:'Edita título, descripción, estado, prioridad, fechas y responsables. description reemplaza el texto; leé antes la tarea y enviá expected_description con el HTML leído para detectar conflictos. mention_user_ids agrega menciones a la descripción.',add_comment:'Agrega un comentario o respuesta. mention_user_ids notifica a los usuarios indicados si tienen acceso.'};
const safe=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
async function content(s:string,mentions:string[]=[]){
 const users=mentions.length?await prisma.user.findMany({where:{id:{in:mentions}},select:{id:true,name:true}}):[];
 if(users.length!==new Set(mentions).size)throw new AccessError(400,'Hay una mención inválida.');
 return '<p>'+safe(s).replace(/\n/g,'</p><p>')+'</p>'+users.map(u=>`<p><span data-type="mention" data-id="${safe(u.id)}" class="mention">@${safe(u.name)}</span></p>`).join('');
}
export async function callTool(name:string,input:unknown){
 const a=actor();
 if(!Object.hasOwn(schemas,name))throw new AccessError(400,'Herramienta desconocida.');
 const write=['prepare_workspace','create_task','update_task','add_comment'].includes(name);
 if(write&&(a.role==='GUEST'||a.tokenScope==='read'))throw new AccessError(403,'Esta conexión solo permite lectura.');
 if(name==='prepare_workspace'){
  await requireRole('ADMIN');let result:{complete?:boolean;error?:string}={};
  for(let i=0;i<10;i++){const response=await restoreStep();result=await response.json() as typeof result;if(!response.ok)throw new Error(result.error||'Error de importación');if(result.complete)break;}return result;
 }
 if(name==='get_workspace'){
  schemas.get_workspace.parse(input);const visible=a.access.resources('TASK').filter(t=>a.access.can('TASK',t.id));
  return {workspace:await getWorkspaceTree(),tasks:visible.length};
 }
 if(name==='search_tasks'){
  const p=schemas.search_tasks.parse(input);
  if(p.list_id&&!a.access.visibleList(p.list_id))throw new AccessError(403,'Sin acceso a la lista.');
  const tasks=await prisma.task.findMany({where:{archived:false,...(p.list_id?{listId:p.list_id}:{}),...(p.query?{name:{contains:p.query}}:{})},select:{id:true,name:true,listId:true,status:true,priority:true,dueDate:true},orderBy:{updatedAt:'desc'}});
  return tasks.filter(t=>a.access.can('TASK',t.id)).slice(0,100);
 }
 if(name==='get_task'){const p=schemas.get_task.parse(input);a.access.assert('TASK',p.task_id);return getTaskDetail(p.task_id);}
 await requireRole('MEMBER');
 if(name==='create_task'){
  const p=schemas.create_task.parse(input);a.access.assert('LIST',p.list_id,'EDIT');
  if(p.status_id){const s=await prisma.status.findUnique({where:{id:p.status_id}});if(s?.listId!==p.list_id)throw new AccessError(400,'Estado de otra lista.');}
  if(p.parent_id){a.access.assert('TASK',p.parent_id,'EDIT');const t=await prisma.task.findUnique({where:{id:p.parent_id}});if(t?.listId!==p.list_id)throw new AccessError(400,'Tarea padre de otra lista.');}
  const description=p.description!==undefined?await content(p.description,p.mention_user_ids):undefined;
  const t=await createTask({listId:p.list_id,name:p.name,statusId:p.status_id,priority:p.priority,parentId:p.parent_id,createdById:a.user.id});
  if(description)await updateTask(t.id,{description},a.user.id);return {id:t.id,name:t.name,listId:t.listId};
 }
 if(name==='update_task'){
  const p=schemas.update_task.parse(input);a.access.assert('TASK',p.task_id,'EDIT');
  if(p.status_id){const [t,s]=await Promise.all([prisma.task.findUnique({where:{id:p.task_id}}),prisma.status.findUnique({where:{id:p.status_id}})]);if(!t||s?.listId!==t.listId)throw new AccessError(400,'Estado de otra lista.');}
  if(p.mention_user_ids?.length&&p.description===undefined)throw new AccessError(400,'Las menciones requieren una descripción.');
  const t=await updateTask(p.task_id,{name:p.name,description:p.description===undefined?undefined:await content(p.description,p.mention_user_ids),expectedDescription:p.expected_description,statusId:p.status_id,priority:p.priority,dueDate:p.due_date,startDate:p.start_date,assigneeIds:p.assignee_ids},a.user.id);return {id:t.id,name:t.name,status:t.status};
 }
 const p=schemas.add_comment.parse(input);a.access.assert('TASK',p.task_id,'COMMENT');return createComment(p.task_id,await content(p.body,p.mention_user_ids),p.parent_id);
}
export async function POST(req:Request){
 let rpc:{id?:string|number|null;method?:string;params?:{name?:string;arguments?:unknown}};
 try{rpc=await req.json() as typeof rpc;if(!rpc||Array.isArray(rpc)||typeof rpc!=='object')throw new Error();}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON inválido'}});}
 const id=rpc.id??null;
 if(rpc.method==='server/discover')return Response.json({jsonrpc:'2.0',id,result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}});
 if(rpc.method==='initialize')return Response.json({jsonrpc:'2.0',id,result:{protocolVersion:'2026-07-28',serverInfo:{name:'sav3-open-clickup',version:'1.1.0'},capabilities:{tools:{}}}});
 if(rpc.method==='tools/list')return Response.json({jsonrpc:'2.0',id,result:{tools:Object.entries(schemas).map(([name,schema])=>({name,description:descriptions[name as keyof typeof schemas],inputSchema:z.toJSONSchema(schema)}))}});
 if(rpc.method==='tools/call'){
  try{return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(await callTool(rpc.params?.name??'',rpc.params?.arguments??{}))}]}});}
  catch(e){return Response.json({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Error de herramienta'}]}});}
 }
 return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Método desconocido'}});
}
