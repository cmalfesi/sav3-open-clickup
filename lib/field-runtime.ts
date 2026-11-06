import {AccessError,type Actor} from './access-context';
import {isEmptyValue} from './advanced-filters';
export type FieldSettings={required?:boolean;defaultValue?:unknown;adminOnly?:boolean;readerIds?:string[];editorIds?:string[];formula?:string};
export function fieldSettings(config:unknown):FieldSettings{try{return (typeof config==='string'?JSON.parse(config):config)??{};}catch{return {};}}
export function canReadField(a:Actor,config:unknown){const s=fieldSettings(config);return a.access.admin||!s.adminOnly&&(!s.readerIds?.length||s.readerIds.includes(a.user.id));}
/** Arithmetic-only parser, no dynamic code or property/function access. Missing inputs stay null. */
export function evaluateFormula(expression:string,values:Record<string,unknown>):number|null{
 let missing=false;const text=expression.replace(/\{\{([^{}]+)\}\}/g,(_,id:string)=>{const n=values[id];if(isEmptyValue(n)||typeof n!=='number'||!Number.isFinite(n)){missing=true;return '0';}return '('+n+')';});
 if(missing)return null;if(text.length>1000||!/^[\d\s.+*/()\-]+$/.test(text))throw new AccessError(400,'Fórmula inválida. Usá números, +, -, *, /, paréntesis y referencias {{ID}}.');
 const tokens=text.match(/\d+(?:\.\d+)?|\.\d+|[()+*/-]/g)??[];let p=0;
 function atom():number{const t=tokens[p++];if(t==='-')return -atom();if(t==='+')return atom();if(t==='('){const n=expr();if(tokens[p++]!==')')throw new Error();return n;}if(!t||!/^\d|^\./.test(t))throw new Error();return Number(t);}
 function term():number{let n=atom();while(tokens[p]==='*'||tokens[p]==='/'){const op=tokens[p++],b=atom();n=op==='*'?n*b:n/b;}return n;}
 function expr():number{let n=term();while(tokens[p]==='+'||tokens[p]==='-'){const op=tokens[p++],b=term();n=op==='+'?n+b:n-b;}return n;}
 try{const n=expr();if(p!==tokens.length||!Number.isFinite(n))return null;return n;}catch{throw new AccessError(400,'Revisá la sintaxis de la fórmula.');}
}
export async function enforceRequiredFields(db:D1Database,listId:string,taskId:string,a?:Actor){
 const missing=await db.prepare(`SELECT f.name,f.config FROM CustomField f JOIN List l ON l.id=? LEFT JOIN CustomFieldValue v ON v.customFieldId=f.id AND v.taskId=? WHERE (f.listId=l.id OR EXISTS(SELECT 1 FROM CustomFieldLocation p WHERE p.customFieldId=f.id AND (p.listId=l.id OR p.spaceId=l.spaceId))) AND json_extract(CASE WHEN json_valid(f.config) THEN f.config ELSE '{}' END,'$.required')=1 AND (v.value IS NULL OR v.value='null' OR v.value='""' OR v.value='[]')`).bind(listId,taskId).all<{name:string;config:string|null}>();
 if(a&&missing.results.some(f=>!canReadField(a,f.config)))throw new AccessError(400,'Hay campos obligatorios restringidos. Pedile a un administrador que los complete antes de cambiar de estado.');
 if(missing.results.length)throw new AccessError(400,'Completá los campos obligatorios antes de cambiar de etapa: '+missing.results.map(f=>f.name).join(', '));
}
export async function applyFieldDefaults(db:D1Database,listId:string,taskId:string){
 await db.prepare(`INSERT OR IGNORE INTO CustomFieldValue(id,taskId,customFieldId,value) SELECT lower(hex(randomblob(16))),?,f.id,json_quote(json_extract(f.config,'$.defaultValue')) FROM CustomField f JOIN List l ON l.id=? WHERE (f.listId=l.id OR EXISTS(SELECT 1 FROM CustomFieldLocation p WHERE p.customFieldId=f.id AND (p.listId=l.id OR p.spaceId=l.spaceId))) AND json_valid(f.config) AND json_type(f.config,'$.defaultValue') IS NOT NULL AND json_type(f.config,'$.defaultValue')<>'null' AND f.type<>'FORMULA'`).bind(taskId,listId).run();
}
export function decorateFieldValues<T extends {id:string;customFieldId:string;value:unknown}>(a:Actor,fields:{id:string;type:string;config:unknown}[],values:T[],taskId:string):T[]{
 const visible=fields.filter(f=>canReadField(a,f.config)),ids=new Set(visible.map(f=>f.id)),out=values.filter(v=>ids.has(v.customFieldId));
 const raw=Object.fromEntries(out.map(v=>[v.customFieldId,v.value]));
 for(const f of visible.filter(f=>f.type==='FORMULA')){let value:number|null=null;try{value=evaluateFormula(fieldSettings(f.config).formula??'',raw);}catch{/* An imported invalid formula is unavailable. */}out.push({id:'computed:'+taskId+':'+f.id,taskId,customFieldId:f.id,value} as unknown as T);}
 return out;
}
