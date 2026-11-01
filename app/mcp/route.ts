import {z} from 'zod';
import {prisma} from '@/lib/db';
import {requireUser} from '@/lib/auth';
import {requireRole} from '@/lib/permissions';
import {getWorkspaceTree,getTaskDetail} from '@/lib/queries';
import {createTask,updateTask} from '@/lib/tasks';
import {POST as restoreStep} from '@/app/api/restore/route';

const properties={list_id:{type:'string'},task_id:{type:'string'},name:{type:'string'},description:{type:'string'},status_id:{type:'string'},priority:{type:'string',enum:['URGENT','HIGH','NORMAL','LOW']},parent_id:{type:'string'},query:{type:'string'},body:{type:'string'}};
const definitions=[
 {name:'prepare_workspace',description:'Prepara la copia privada del respaldo en lotes reanudables. Repetir mientras complete sea false.',keys:[],required:[]},
 {name:'get_workspace',description:'Consulta espacios, listas, estados, miembros y cantidades del laboratorio privado.',keys:[],required:[]},
 {name:'search_tasks',description:'Busca tareas del laboratorio por texto y/o lista, hasta 100 resultados.',keys:['query','list_id'],required:[]},
 {name:'get_task',description:'Lee una tarea con descripción, comentarios, campos y adjuntos.',keys:['task_id'],required:['task_id']},
 {name:'create_task',description:'Crea una tarea en la copia de ensayo, sin modificar ClickUp original.',keys:['list_id','name','description','status_id','priority','parent_id'],required:['list_id','name']},
 {name:'update_task',description:'Actualiza nombre, descripción, estado o prioridad de una tarea del laboratorio.',keys:['task_id','name','description','status_id','priority'],required:['task_id']},
 {name:'add_comment',description:'Agrega un comentario de texto seguro a una tarea de la copia.',keys:['task_id','body'],required:['task_id','body']},
];
const schemas={
 prepare_workspace:z.object({}),get_workspace:z.object({}),
 search_tasks:z.object({query:z.string().max(300).optional(),list_id:z.string().optional()}),
 get_task:z.object({task_id:z.string().min(1)}),
 create_task:z.object({list_id:z.string().min(1),name:z.string().trim().min(1).max(2000),description:z.string().optional(),status_id:z.string().optional(),priority:z.enum(['URGENT','HIGH','NORMAL','LOW']).optional(),parent_id:z.string().optional()}),
 update_task:z.object({task_id:z.string().min(1),name:z.string().trim().min(1).optional(),description:z.string().optional(),status_id:z.string().optional(),priority:z.enum(['URGENT','HIGH','NORMAL','LOW']).optional()}),
 add_comment:z.object({task_id:z.string().min(1),body:z.string().trim().min(1).max(20000)}),
};
function safeText(s:string){return '<p>'+s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'</p><p>')+'</p>'}
async function call(name:string,input:unknown){
 if(!(name in schemas))throw new Error('Unknown tool');
 if(name==='prepare_workspace'){
  let result:{complete?:boolean;cursor?:number;total?:number;error?:string}={};
  for(let i=0;i<10;i++){const response=await restoreStep();result=await response.json() as typeof result;if(!response.ok)throw new Error(result.error||'Restore failed');if(result.complete)break;}
  return result;
 }
 const user=await requireUser();
 if(name==='get_workspace')return {workspace:await getWorkspaceTree(),tasks:await prisma.task.count(),comments:await prisma.comment.count()};
 if(name==='search_tasks'){const a=schemas.search_tasks.parse(input);return prisma.task.findMany({where:{...(a.list_id?{listId:a.list_id}:{}),...(a.query?{name:{contains:a.query}}:{}),archived:false},take:100,select:{id:true,name:true,listId:true,status:true,priority:true,dueDate:true}})}
 if(name==='get_task'){const a=schemas.get_task.parse(input);const t=await getTaskDetail(a.task_id);if(!t)throw new Error('Task not found');return t;}
 await requireRole('MEMBER');
 if(name==='create_task'){
  const a=schemas.create_task.parse(input);if(a.status_id){const s=await prisma.status.findUnique({where:{id:a.status_id}});if(s?.listId!==a.list_id)throw new Error('Status belongs to another list');}
  if(a.parent_id){const p=await prisma.task.findUnique({where:{id:a.parent_id}});if(p?.listId!==a.list_id)throw new Error('Parent belongs to another list');}
  const t=await createTask({listId:a.list_id,name:a.name,statusId:a.status_id,priority:a.priority,parentId:a.parent_id,createdById:user.id});
  if(a.description)await updateTask(t.id,{description:safeText(a.description)},user.id);return {id:t.id,name:t.name,listId:t.listId};
 }
 if(name==='update_task'){
  const a=schemas.update_task.parse(input);if(a.status_id){const[t,s]=await Promise.all([prisma.task.findUnique({where:{id:a.task_id}}),prisma.status.findUnique({where:{id:a.status_id}})]);if(!t||s?.listId!==t.listId)throw new Error('Invalid list status');}
  const t=await updateTask(a.task_id,{name:a.name,description:a.description===undefined?undefined:safeText(a.description),statusId:a.status_id,priority:a.priority},user.id);return {id:t.id,name:t.name,status:t.status};
 }
 const a=schemas.add_comment.parse(input);if(!await prisma.task.findUnique({where:{id:a.task_id}}))throw new Error('Task not found');return prisma.comment.create({data:{taskId:a.task_id,userId:user.id,body:safeText(a.body)}});
}
export async function POST(req:Request){
 let rpc:{id?:string|number|null;method?:string;params?:{name?:string;arguments?:unknown}};
 try{rpc=await req.json() as typeof rpc}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}})}
 const id=rpc.id??null;
 if(rpc.method==='server/discover')return Response.json({jsonrpc:'2.0',id,result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}});
 if(rpc.method==='initialize')return Response.json({jsonrpc:'2.0',id,result:{protocolVersion:'2026-07-28',serverInfo:{name:'sav3-open-clickup-lab',version:'1.0.0'},capabilities:{tools:{}}}});
 if(rpc.method==='tools/list')return Response.json({jsonrpc:'2.0',id,result:{tools:definitions.map(d=>({name:d.name,description:d.description,inputSchema:{type:'object',properties:Object.fromEntries(d.keys.map(k=>[k,properties[k as keyof typeof properties]])),required:d.required,additionalProperties:false}}))}});
 if(rpc.method==='tools/call'){
  try{const result=await call(rpc.params?.name??'',rpc.params?.arguments??{});return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}]}})}
  catch(e){return Response.json({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:e instanceof Error?e.message:'Tool failed'}]}})}
 }
 return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}
