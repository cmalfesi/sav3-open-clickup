import { z } from 'zod';
export const fieldFilterSchema=z.object({fieldId:z.string().min(1).max(200),op:z.enum(['eq','neq','contains','empty','not_empty','gte','lte','before','after']),value:z.union([z.string().max(2000),z.number(),z.boolean(),z.array(z.string()).max(100)]).optional()});
export type FieldFilter=z.infer<typeof fieldFilterSchema>;
export function isEmptyValue(v:unknown){return v===null||v===undefined||v===''||(Array.isArray(v)&&v.length===0);}
export function matchFieldFilter(value:unknown,f:FieldFilter){
 if(f.op==='empty')return isEmptyValue(value);
 if(f.op==='not_empty')return !isEmptyValue(value);
 if(isEmptyValue(value))return false;
 const norm=(v:unknown)=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const values=Array.isArray(value)?value:[value], wanted=Array.isArray(f.value)?f.value:[f.value];
 if(f.op==='eq'||f.op==='neq'){const found=values.some(v=>wanted.some(w=>norm(v)===norm(w)));return f.op==='eq'?found:!found;}
 if(f.op==='contains')return values.some(v=>norm(v).includes(norm(f.value)));
 if(f.op==='before'||f.op==='after'){const a=Date.parse(String(value)),b=Date.parse(String(f.value));return Number.isFinite(a)&&Number.isFinite(b)&&(f.op==='before'?a<b:a>b);}
 const a=Number(value),b=Number(f.value);return Number.isFinite(a)&&Number.isFinite(b)&&(f.op==='gte'?a>=b:a<=b);
}
