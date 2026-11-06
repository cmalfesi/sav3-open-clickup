import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {AccessError,type Actor} from './access-context';
import {fieldCatalog} from './custom-field-service';
import {fieldTypes} from './custom-field-model';
import {isEmptyValue} from './advanced-filters';
const schema=z.object({operation:z.enum(['convert','merge']),targetType:z.enum(Object.keys(fieldTypes) as [keyof typeof fieldTypes,...(keyof typeof fieldTypes)[]]).optional(),targetId:z.string().optional(),dryRun:z.boolean().default(true),revision:z.number().int(),targetRevision:z.number().int().optional()});
export async function fieldTransformRoute(req:Request,db:D1Database,a:Actor|null):Promise<Response|null>{
 const u=new URL(req.url),match=u.pathname.match(/^\/api\/custom-fields\/([^/]+)\/transform$/);if(!match)return null;
 try{if(!a)throw new AccessError(401,'Iniciá sesión.');if(req.method!=='POST')throw new AccessError(405,'Solo POST.');if(a.role==='GUEST'||a.tokenScope==='read')throw new AccessError(403,'Solo lectura.');if(req.headers.get('Origin')!==u.origin&&!(['native','token'].includes(a.kind)&&!req.headers.get('Origin')))throw new AccessError(403,'Origen no permitido.');
 const p=schema.parse(await req.json()),catalog=await fieldCatalog(db,a),source=catalog.fields.find(f=>f.id===decodeURIComponent(match[1])),target=p.operation==='merge'?catalog.fields.find(f=>f.id===p.targetId):undefined;
 if(!source?.canEdit||p.operation==='merge'&&!target?.canEdit)throw new AccessError(403,'Necesitás gestionar todas las ubicaciones de ambos campos.');
 if(source.revision!==p.revision||target&&target.revision!==p.targetRevision)throw new AccessError(409,'Los campos cambiaron. Recargá la configuración.');
 if(source.type==='FORMULA'||p.targetType==='FORMULA')throw new AccessError(400,'Las fórmulas se crean como campos calculados nuevos.');
 if(target&&(source.id===target.id||source.type!==target.type||!!source.adminOnly!==!!target.adminOnly||!!source.required!==!!target.required||JSON.stringify([...(source.readerIds??[])].sort())!==JSON.stringify([...(target.readerIds??[])].sort())||JSON.stringify([...(source.editorIds??[])].sort())!==JSON.stringify([...(target.editorIds??[])].sort())))throw new AccessError(400,'Elegí otro campo del mismo tipo, obligatoriedad y permisos.');
 const type=target?.type??p.targetType;if(!type)throw new AccessError(400,'Elegí un tipo destino.');
 if(target){const references=await db.prepare("SELECT 1 FROM DashboardDocument WHERE instr(config,?)>0 UNION ALL SELECT 1 FROM View WHERE instr(config,?)>0 UNION ALL SELECT 1 FROM CustomField WHERE id<>? AND instr(coalesce(config,''),?)>0 LIMIT 1").bind(source.id,source.id,source.id,source.id).first();if(references)throw new AccessError(409,'Hay vistas, tarjetas o fórmulas que usan el campo. Reconfiguralas al destino antes de fusionar.');}
 const original=(await db.prepare('SELECT taskId,value FROM CustomFieldValue WHERE customFieldId=?').bind(source.id).all<{taskId:string;value:string}>()).results;
 const current=target?(await db.prepare('SELECT taskId,value FROM CustomFieldValue WHERE customFieldId=?').bind(target.id).all<{taskId:string;value:string}>()).results:[];
 const options=type==='DROPDOWN'||type==='LABELS'?[...(target?.options??(source.type===type?source.options:[]))]:[];
 const label=(v:unknown)=>source.options.find(o=>o.id===v)?.label??String(v??'');
 function convert(v:unknown):unknown{
 if(isEmptyValue(v))return null;
 let text=Array.isArray(v)?v.map(label).join(', '):['DROPDOWN','LABELS'].includes(source!.type)?label(v):String(v);
 if(type==='DROPDOWN'||type==='LABELS'){
 const values=Array.isArray(v)?v:[v];const ids=values.map(value=>{const name=['DROPDOWN','LABELS'].includes(source!.type)?label(value):String(value);let o=options.find(x=>x.label.toLocaleLowerCase()===name.toLocaleLowerCase());if(!o){if(options.length>=500)throw new Error('Máximo de 500 opciones.');o={id:randomUUID(),label:name,color:'#7b68ee',position:options.length};options.push(o);}return o.id;});if(type==='DROPDOWN'&&ids.length>1)throw new Error('Hay valores múltiples que no entran en una opción única.');return type==='DROPDOWN'?ids[0]:ids;
 }
 if(['NUMBER','MONEY','RATING','PROGRESS'].includes(type!)){if(typeof v==='boolean'||Array.isArray(v)||!text.trim()||!Number.isFinite(Number(text)))throw new Error('No es numérico.');const n=Number(text);if(type==='RATING'&&(!Number.isInteger(n)||n<0||n>5)||type==='PROGRESS'&&(n<0||n>100))throw new Error('Fuera de rango.');return n;}
 if(type==='CHECKBOX'){if(v===true||v===false)return v;if(text==='true'||text==='1')return true;if(text==='false'||text==='0')return false;throw new Error('No se puede interpretar como casilla.');}
 if(type==='DATE'){if(!Number.isFinite(Date.parse(text)))throw new Error('Fecha inválida.');text=new Date(text).toISOString();}
 if(type==='URL'&&!/^https?:\/\//i.test(text))throw new Error('URL inválida.');if(type==='EMAIL'&&!z.string().email().safeParse(text).success)throw new Error('Email inválido.');return text;
 }
 const conflicts:{taskId:string;reason:string}[]=[],converted:{taskId:string;value:unknown}[]=[];
 for(const row of original){try{const value=convert(JSON.parse(row.value)),existing=current.find(v=>v.taskId===row.taskId);if(existing&&!isEmptyValue(JSON.parse(existing.value))&&JSON.stringify(JSON.parse(existing.value))!==JSON.stringify(value))throw new Error('El destino ya tiene otro valor.');converted.push({taskId:row.taskId,value});}catch(e){conflicts.push({taskId:row.taskId,reason:e instanceof Error?e.message:'Valor incompatible.'});}}
 const preview={total:original.length,conflicts,samples:converted.slice(0,10),canApply:conflicts.length===0,sourceRevision:source.revision,targetRevision:target?.revision};
 if(p.dryRun)return Response.json(preview);if(conflicts.length)throw new AccessError(409,'Hay valores incompatibles. Resolvelos antes de aplicar.');
 const configRow=await db.prepare('SELECT config FROM CustomField WHERE id=?').bind(source.id).first<{config:string|null}>(),config=JSON.parse(configRow?.config??'{}');delete config.defaultValue;
 const key=randomUUID(),fieldId=target?.id??source.id;
 const writes:D1PreparedStatement[]=[db.prepare("INSERT OR IGNORE INTO CustomFieldRevision(customFieldId,revision,writeKey) VALUES(?,0,'')").bind(source.id)];
 if(target)writes.push(db.prepare("INSERT OR IGNORE INTO CustomFieldRevision(customFieldId,revision,writeKey) VALUES(?,0,'')").bind(target.id));
 writes.push(db.prepare('UPDATE CustomFieldRevision SET revision=revision+1,writeKey=? WHERE customFieldId=? AND revision=?'+(target?' AND EXISTS(SELECT 1 FROM CustomFieldRevision WHERE customFieldId=? AND revision=?)':'')).bind(key,fieldId,target?.revision??source.revision,...(target?[source.id,source.revision]:[])));
 const guard='EXISTS(SELECT 1 FROM CustomFieldRevision WHERE customFieldId=? AND writeKey=?)';
 if(!target)writes.push(db.prepare('UPDATE CustomField SET type=?,config=? WHERE id=? AND '+guard).bind(type,JSON.stringify(config),fieldId,fieldId,key));
 for(const o of options)writes.push(db.prepare('INSERT OR IGNORE INTO CustomFieldOption(id,customFieldId,label,color,position) SELECT ?,?,?,?,? WHERE '+guard).bind(o.id,fieldId,o.label,o.color,o.position,fieldId,key));
 for(const v of converted)writes.push(db.prepare('INSERT INTO CustomFieldValue(id,taskId,customFieldId,value) SELECT ?,?,?,? WHERE '+guard+' ON CONFLICT(taskId,customFieldId) DO UPDATE SET value=excluded.value').bind(randomUUID(),v.taskId,fieldId,JSON.stringify(v.value),fieldId,key));
 if(target){for(const l of source.locations)writes.push(db.prepare('INSERT OR IGNORE INTO CustomFieldLocation(customFieldId,spaceId,listId) SELECT ?,?,? WHERE '+guard).bind(fieldId,l.type==='SPACE'?l.id:null,l.type==='LIST'?l.id:null,fieldId,key));
 writes.push(db.prepare('DELETE FROM CustomFieldValue WHERE customFieldId=? AND '+guard).bind(source.id,fieldId,key),db.prepare('DELETE FROM CustomField WHERE id=? AND '+guard).bind(source.id,fieldId,key));}
 else if(!['DROPDOWN','LABELS'].includes(type))writes.push(db.prepare('DELETE FROM CustomFieldOption WHERE customFieldId=? AND '+guard).bind(fieldId,fieldId,key));
 writes.push(db.prepare("INSERT INTO AccessAudit(id,actorId,action,targetId,createdAt) SELECT ?,?,?,?,? WHERE "+guard).bind(randomUUID(),a.user.id,'custom-field.'+p.operation,source.id+(target?'->'+target.id:''),Date.now(),fieldId,key));
 const affected=catalog.locations.filter(l=>l.type==='LIST'&&[...source.locations,...(target?.locations??[])].some(p=>p.type==='LIST'?p.id===l.id:p.id===l.parentId));
 for(const l of affected)writes.push(db.prepare('INSERT INTO ChangeEvent(taskId,listId,actorId,createdAt) SELECT NULL,?,?,? WHERE '+guard).bind(l.id,a.user.id,Date.now(),fieldId,key));
 await db.batch(writes);const applied=await db.prepare('SELECT writeKey FROM CustomFieldRevision WHERE customFieldId=?').bind(fieldId).first<{writeKey:string}>();if(applied?.writeKey!==key)throw new AccessError(409,'Los campos cambiaron.');return Response.json({...preview,applied:true,id:fieldId});
 }catch(e){if(e instanceof AccessError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError)return Response.json({error:'Datos de conversión inválidos.'},{status:400});console.error('[field-transform]',e instanceof Error?e.message:'Error');return Response.json({error:'No pudimos transformar el campo. No se aplicaron cambios.'},{status:500});}
}
