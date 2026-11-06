'use client';
import type {ViewState} from '@/lib/view-state';
import type {CustomFieldWithOptions,StatusModel} from '@/lib/queries';
import type {FieldFilter} from '@/lib/advanced-filters';
const input='w-full min-h-8 rounded border border-cu-border bg-cu-panel px-2 py-1 text-xs';
export function AdvancedFilterControls({state,onChange,fields,statuses}:{state:ViewState;onChange:(s:ViewState)=>void;fields:CustomFieldWithOptions[];statuses:StatusModel[]}){
 const filters=state.filters,custom=filters.custom??[];
 function set(p:Partial<ViewState['filters']>){onChange({...state,filters:{...filters,...p}});}
 function edit(i:number,p:Partial<FieldFilter>){set({custom:custom.map((f,n)=>n===i?{...f,...p}:f)});}
 return <section className="mt-3 space-y-3 border-t border-cu-border pt-3">
 <fieldset><legend className="text-xs font-semibold">Estado</legend>{statuses.map(s=><label key={s.id} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={filters.statuses?.includes(s.id)??false} onChange={e=>set({statuses:e.target.checked?[...(filters.statuses??[]),s.id]:(filters.statuses??[]).filter(id=>id!==s.id)})}/>{s.name}</label>)}</fieldset>
 <label className="block text-xs">Vence desde<input type="date" value={filters.dueFrom??''} onChange={e=>set({dueFrom:e.target.value||undefined})} className={input}/></label>
 <label className="block text-xs">Vence hasta<input type="date" value={filters.dueTo??''} onChange={e=>set({dueTo:e.target.value||undefined})} className={input}/></label>
 <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={filters.noDueDate??false} onChange={e=>set({noDueDate:e.target.checked})}/>Sin vencimiento</label>
 <p className="text-xs font-semibold">Campos personalizados · coincidir con todos</p>
 {custom.map((f,i)=>{const field=fields.find(x=>x.id===f.fieldId);return <div key={i} className="space-y-1 rounded border border-cu-border p-2"><select aria-label="Campo a filtrar" className={input} value={f.fieldId} onChange={e=>edit(i,{fieldId:e.target.value,value:undefined})}>{fields.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><select aria-label="Condición" value={f.op} onChange={e=>edit(i,{op:e.target.value as FieldFilter['op']})} className={input}>{Object.entries({eq:'Es',neq:'No es',contains:'Contiene',empty:'Sin valor',not_empty:'Con valor',gte:'Mayor o igual',lte:'Menor o igual',before:'Antes de',after:'Después de'}).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>{!['empty','not_empty'].includes(f.op)&&(field?.type==='DROPDOWN'||field?.type==='LABELS'?<select aria-label="Valor" value={String(f.value??'')} onChange={e=>edit(i,{value:e.target.value})} className={input}><option value="">Elegir valor</option>{field.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>:field?.type==='CHECKBOX'?<select aria-label="Valor" value={String(f.value??true)} onChange={e=>edit(i,{value:e.target.value==='true'})} className={input}><option value="true">Marcada</option><option value="false">Sin marcar</option></select>:<input aria-label="Valor" type={field?.type==='DATE'?'date':['NUMBER','MONEY','RATING','PROGRESS'].includes(field?.type??'')?'number':'text'} className={input} value={String(f.value??'')} onChange={e=>edit(i,{value:e.target.value})}/>)}<button type="button" className="text-xs text-cu-urgent" onClick={()=>set({custom:custom.filter((_,n)=>n!==i)})}>Quitar condición</button></div>})}
 {fields.length>0&&<button type="button" className="text-xs text-cu-purple" onClick={()=>set({custom:[...custom,{fieldId:fields[0].id,op:'not_empty'}]})}>+ Agregar condición</button>}
 </section>;
}
