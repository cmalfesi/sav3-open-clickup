import { z } from 'zod';
const ids=z.array(z.string().min(1).max(200)).max(200);
export const filterSchema=z.object({
 statuses:ids.default([]),priorities:ids.default([]),assignees:ids.default([]),tags:ids.default([]),
 custom:z.array(z.object({fieldId:z.string().max(200),values:ids})).max(30).default([]),
 dateField:z.enum(['createdAt','dueDate','completedAt']).default('createdAt'),dateFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),dateTo:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
 includeSubtasks:z.boolean().default(true),includeArchived:z.boolean().default(false),
}).refine(f=>!f.dateFrom||!f.dateTo||f.dateFrom<=f.dateTo,{message:'La fecha desde debe ser anterior o igual a la fecha hasta.'});
export type DashboardFilter=z.infer<typeof filterSchema>;
export const emptyFilter=():DashboardFilter=>filterSchema.parse({});
export const cardSchema=z.object({
 id:z.string().min(1).max(200),title:z.string().trim().min(1).max(120),
 type:z.enum(['kpi','bar','pie','line','table','activity']),metric:z.enum(['count','sum','avg','min','max','percent_done']).default('count'),
 field:z.string().max(220).default('timeEstimate'),groupBy:z.string().max(220).default('status'),filter:filterSchema.default(()=>emptyFilter()),
 color:z.string().regex(/^#[0-9a-f]{6}$/i).default('#7b68ee'),
 background:z.string().regex(/^#[0-9a-f]{6}$/i).nullable().default(null),
 fontSize:z.number().int().min(16).max(128).default(36),
 layout:z.object({x:z.number().int().min(0).max(11),y:z.number().int().min(0).max(10000),w:z.number().int().min(3).max(12),h:z.number().int().min(1).max(16)}).default({x:0,y:0,w:6,h:5}),
}).refine(c=>c.type==='kpi'||c.layout.h>=4,{message:'Los gráficos y tablas requieren una altura mínima de 4.'}).refine(c=>c.type!=='pie'||['count','sum'].includes(c.metric),{message:'La torta admite conteos o sumas; usá barras para promedios y porcentajes.'});
export type DashboardCard=z.infer<typeof cardSchema>;
export const dashboardSchema=z.object({version:z.literal(1).default(1),sources:ids.default([]),filter:filterSchema.default(()=>emptyFilter()),autoRefresh:z.boolean().default(false),cards:z.array(cardSchema).max(40).default([])}).superRefine((v,ctx)=>{
 if(new Set(v.cards.map(c=>c.id)).size!==v.cards.length)ctx.addIssue({code:'custom',message:'Las tarjetas deben tener identificadores distintos.'});
 for(const c of v.cards)if(c.layout.x+c.layout.w>12)ctx.addIssue({code:'custom',message:'Una tarjeta queda fuera de la grilla.'});
});
export type DashboardConfig=z.infer<typeof dashboardSchema>;
export const emptyDashboard=(sources:string[]=[]):DashboardConfig=>dashboardSchema.parse({sources});
export type Option={id:string;name:string;color?:string;listId?:string};
export type DashboardTask={id:string;name:string;listId:string;parentId:string|null;statusId:string;statusName:string;statusColor:string;statusType:string;priority:string|null;createdAt:string;dueDate:string|null;completedAt:string|null;archived:number;timeEstimate:number|null;assignees:string[];tags:string[];fields:Record<string,unknown>};
export type DashboardData={tasks:DashboardTask[];lists:Option[];statuses:Option[];members:Option[];tags:Option[];fields:(Option&{type:string;options:Option[]})[];activities:{id:string;taskId:string;taskName:string;listId:string;userName:string;type:string;createdAt:string}[];refreshedAt:string};
function values(value:unknown):string[]{return value===null||value===undefined||value===''?[]:Array.isArray(value)?value.flatMap(values):[String(value)];}
export function filterTasks(tasks:DashboardTask[],f:DashboardFilter){return tasks.filter(t=>{
 if(!f.includeArchived&&t.archived)return false;if(!f.includeSubtasks&&t.parentId)return false;
 if(f.statuses.length&&!f.statuses.includes(t.statusId))return false;
 if(f.priorities.length&&!f.priorities.includes(t.priority??'NONE'))return false;
 if(f.assignees.length&&!(t.assignees.length?t.assignees:['NONE']).some(id=>f.assignees.includes(id)))return false;
 if(f.tags.length&&!(t.tags.length?t.tags:['NONE']).some(id=>f.tags.includes(id)))return false;
 for(const c of f.custom){if(!c.values.length)continue;const vs=values(t.fields[c.fieldId]);if(!(vs.length?vs:['NONE']).some(v=>c.values.includes(v)))return false;}
 const date=t[f.dateField]?.slice(0,10);if(f.dateFrom&&(!date||date<f.dateFrom))return false;if(f.dateTo&&(!date||date>f.dateTo))return false;return true;
});}
export function aggregate(tasks:DashboardTask[],metric:DashboardCard['metric'],field:string):number|null{
 if(metric==='count')return tasks.length;if(metric==='percent_done')return tasks.length?100*tasks.filter(t=>['DONE','CLOSED'].includes(t.statusType)).length/tasks.length:null;
 const ns=tasks.flatMap(t=>{const v=field==='timeEstimate'?t.timeEstimate:t.fields[field.replace(/^custom:/,'')];if(v===null||v===undefined||v===''||typeof v==='boolean'||Array.isArray(v)||typeof v==='object')return [];const n=Number(v);return Number.isFinite(n)?[n]:[];});
 if(!ns.length)return null;return metric==='sum'?ns.reduce((a,b)=>a+b,0):metric==='avg'?ns.reduce((a,b)=>a+b,0)/ns.length:metric==='min'?Math.min(...ns):Math.max(...ns);
}
export type CardResult={value:number|null;count:number;rows:{key:string;name:string;value:number|null;taskIds:string[];color?:string}[];tasks:DashboardTask[]};
export function calculateCard(config:DashboardConfig,card:DashboardCard,data:DashboardData):CardResult{
 const tasks=filterTasks(filterTasks(data.tasks.filter(t=>!config.sources.length||config.sources.includes(t.listId)),config.filter),card.filter),map=new Map<string,{name:string;tasks:DashboardTask[];color?:string}>();
 const option=(list:Option[],id:string)=>list.find(o=>o.id===id)?.name??id;
 for(const t of tasks){let groups:{id:string;name:string;color?:string}[]=[];
  if(card.groupBy==='status')groups=[{id:t.statusId,name:t.statusName,color:t.statusColor}];
  else if(card.groupBy==='priority')groups=[{id:t.priority??'NONE',name:({URGENT:'Urgente',HIGH:'Alta',NORMAL:'Normal',LOW:'Baja',NONE:'Sin prioridad'} as Record<string,string>)[t.priority??'NONE']}];
  else if(card.groupBy==='assignee')groups=(t.assignees.length?t.assignees:['NONE']).map(id=>({id,name:id==='NONE'?'Sin asignar':option(data.members,id)}));
  else if(card.groupBy==='tag')groups=(t.tags.length?t.tags:['NONE']).map(id=>({id,name:id==='NONE'?'Sin etiquetas':option(data.tags,id)}));
  else if(card.groupBy==='list')groups=[{id:t.listId,name:option(data.lists,t.listId)}];
  else if(['createdMonth','dueMonth','completedMonth'].includes(card.groupBy)){const key=card.groupBy==='dueMonth'?'dueDate':card.groupBy==='completedMonth'?'completedAt':'createdAt',month=t[key]?.slice(0,7);groups=[{id:month??'NONE',name:month??'Sin fecha'}];}
  else if(card.groupBy.startsWith('custom:')){const id=card.groupBy.slice(7),f=data.fields.find(f=>f.id===id),vs=values(t.fields[id]);groups=(vs.length?vs:['NONE']).map(v=>({id:v,name:v==='NONE'?'Sin valor':f?.options.find(o=>o.id===v)?.name??v,color:f?.options.find(o=>o.id===v)?.color}));}
  for(const g of groups){if(!map.has(g.id))map.set(g.id,{name:g.name,color:g.color,tasks:[]});map.get(g.id)!.tasks.push(t);}
 }
 const rows=[...map].map(([key,v])=>({key,name:v.name,color:v.color,value:aggregate(v.tasks,card.metric,card.field),taskIds:v.tasks.map(t=>t.id)}));
 rows.sort((a,b)=>['createdMonth','dueMonth','completedMonth'].includes(card.groupBy)?a.key.localeCompare(b.key):(b.value??-Infinity)-(a.value??-Infinity));
 return {value:aggregate(tasks,card.metric,card.field),count:tasks.length,rows,tasks};
}
