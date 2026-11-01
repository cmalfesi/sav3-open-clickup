from pathlib import Path
import json,re,html,shutil,collections,hashlib
import argparse
parser=argparse.ArgumentParser(description="Prepare a private SAV3 ClickUp backup for restoration.")
parser.add_argument("--backup", required=True, type=Path)
parser.add_argument("--project", type=Path, default=Path.cwd())
args=parser.parse_args()
root=args.project.resolve()
backup=args.backup.resolve()
b=json.loads((backup/'data.json').read_text()); manifest=json.loads((backup/'manifest.json').read_text())
# Schema is owned by the committed Drizzle migrations; import data only.

records=collections.defaultdict(list); seen=set(); now='2026-10-30T00:00:00.000Z'; ops=[]
def row(table,**d):
 key=(table,str(d.get('id',tuple(d.values()))))
 if key in seen:return
 seen.add(key);records[table].append(d)
def iso(v):
 if not v:return None
 import datetime
 try:return datetime.datetime.fromtimestamp(int(v)/1000,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
 except:return v
def rich(s):return '<p>'+html.escape(s or '').replace('\\n','\n').replace('\n','</p><p>')+'</p>'
workspace=str(b['workspace']['hierarchy']['root']['id']);row('Workspace',id=workspace,name='SAV3 · copia ClickUp 30/10/2026',color='#7b68ee',createdAt=now)
users={}
def user(id,name=None,email=None):
 if id is None:return None
 key=str(id)
 if key not in users:users[key]={'id':key,'name':name or 'Usuario '+key,'email':email or key+'@imported.invalid','color':'#7b68ee','createdAt':now}
 elif name and users[key]['name'].startswith('Usuario '):users[key]['name']=name
 return key
for u in b['members']['members']:user(u['id'],u.get('name') or u.get('username'),u.get('email'))
raw={t['object_id']:t['data'] for t in b['tasks_raw']};raw.update({t['id']:t for t in b['tasks_alternative']})
lists={e['data']['id']:e['data'] for e in b['extra'] if e['key'].startswith('list/') and not e['isError']}
list_index={t['list']['id']:t['list']['name'] for t in b['task_index']}
for s in b['workspace']['hierarchy']['root']['children']:row('Space',id=s['id'],workspaceId=workspace,name=s['name'],color='#7b68ee',private=0,position=len(records['Space']),createdAt=now)
for i,(lid,lname) in enumerate(list_index.items()):
 data=lists.get(lid,{});s=data.get('space') or {'id':'recovered','name':'Ubicaciones recuperadas'}
 row('Space',id=s['id'],workspaceId=workspace,name=s['name'],color='#7b68ee',private=0,position=len(records['Space']),createdAt=now)
 row('List',id=lid,spaceId=s['id'],name=lname,position=i,createdAt=now)
 types={'open':'NOT_STARTED','unstarted':'NOT_STARTED','custom':'ACTIVE','done':'DONE','closed':'CLOSED'}
 for j,st in enumerate(data.get('statuses',[])):
  row('Status',id=lid+'__'+st['status'],listId=lid,name=st['status'],color=st.get('color','#87909e'),type=types.get(st.get('type'),'ACTIVE'),position=j)
fields={};option_maps={};fielddefs={e['key'].split('/')[1]:e['data'].get('list_fields',[]) for e in b['extra'] if e['key'].startswith('fields/') and not e['isError']}
typemap={'text':'TEXT','short_text':'TEXT','number':'NUMBER','currency':'MONEY','drop_down':'DROPDOWN','labels':'LABELS','date':'DATE','checkbox':'CHECKBOX','url':'URL','email':'EMAIL','phone':'PHONE','rating':'RATING','manual_progress':'PROGRESS','automatic_progress':'PROGRESS'}
unsupported=[]
for lid in list_index:
 for i,f in enumerate(fielddefs.get(lid,[])):
  fid=lid+'__'+f['id'];ft=typemap.get(f['type'],'TEXTAREA'); fields[(lid,f['id'])]=fid
  if f['type'] not in typemap:unsupported.append({'list_id':lid,'field_id':f['id'],'name':f['name'],'source_type':f['type'],'import_type':ft})
  config=f.get('type_config') or {};row('CustomField',id=fid,listId=lid,name=f['name'],type=ft,config=json.dumps(config),position=i)
  for j,o in enumerate(config.get('options',[])):
   oid=fid+'__'+str(o['id']);row('CustomFieldOption',id=oid,customFieldId=fid,label=o.get('name') or o.get('label') or str(o['id']),color=o.get('color') or '#656f7d',position=j)
   option_maps[(fid,str(o['id']))]=oid;option_maps[(fid,str(o.get('orderindex',j)))]=oid
type_names={'1003':'Idea','1004':'Evento','1001':'Goal','1':'Milestone','5':'AI Skill','None':'Task','null':'Task'}
for lid in list_index:
 fid=lid+'__task-kind';row('CustomField',id=fid,listId=lid,name='Tipo de tarea',type='DROPDOWN',position=-1)
 for i,kind in enumerate(['Task','Epic','Bug','User Story','Idea','Evento','Goal','Milestone','AI Skill']):row('CustomFieldOption',id=fid+'__'+kind,customFieldId=fid,label=kind,color='#7b68ee',position=i)
parents=[];known_tasks=set(raw)
for i,t in enumerate(b['task_index']):
 d=raw[t['id']];lid=t['list']['id'];name=t['status'];sid=lid+'__'+name
 row('Status',id=sid,listId=lid,name=name,color='#87909e',type='CLOSED' if t.get('date_closed') else 'ACTIVE',position=len(records['Status']))
 tm=d.get('time_mgmt',d);created=iso(tm.get('date_created')) or now;updated=iso(tm.get('date_updated')) or now
 creator=user((d.get('ownership') or {}).get('creator') or (d.get('creator') or {}).get('id'))
 parent=d.get('direct_parent') or d.get('parent');parent=parent if isinstance(parent,str) and parent in known_tasks else None
 row('Task',id=t['id'],listId=lid,statusId=sid,name=t['name'],description=rich(d.get('markdown_description') or d.get('text_content','')),priority=t['priority'].upper() if t.get('priority') else None,position=i,startDate=iso(tm.get('start_date')),dueDate=iso(tm.get('due_date')),timeEstimate=int(tm['time_estimate'])//60000 if tm.get('time_estimate') else None,createdById=creator,createdAt=created,updatedAt=updated,completedAt=iso(tm.get('date_closed')),archived=int((d.get('states') or {}).get('is_archived',False)))
 if parent:parents.append((t['id'],parent))
 for a in t.get('assignees',[]):row('TaskAssignee',taskId=t['id'],userId=user(a['id'],a.get('username')))
 for a in d.get('users',[]):
  if a.get('type')=='watcher':row('TaskWatcher',taskId=t['id'],userId=user(a['userid']))
 for j,f in enumerate(d.get('fields',d.get('custom_fields',[]))):
  old=f.get('field_id') or f.get('id');fid=fields.get((lid,old));value=f.get('value')
  if not fid or value is None:continue
  definition=next((x for x in records['CustomField'] if x['id']==fid),{})
  if definition.get('type')=='DROPDOWN':value=option_maps.get((fid,str(value)),str(value))
  elif definition.get('type')=='LABELS' and isinstance(value,list):value=[option_maps.get((fid,str(v)),str(v)) for v in value]
  elif definition.get('type')=='DATE':value=iso(value)
  elif isinstance(value,(dict,list)):value=json.dumps(value,ensure_ascii=False)
  row('CustomFieldValue',id=t['id']+'__'+fid,taskId=t['id'],customFieldId=fid,value=json.dumps(value,ensure_ascii=False))
 kind=type_names.get(str(d.get('custom_type',d.get('custom_item_id'))),'Task');fid=lid+'__task-kind';row('CustomFieldValue',id=t['id']+'__kind',taskId=t['id'],customFieldId=fid,value=json.dumps(fid+'__'+kind))
 for j,c in enumerate(d.get('checklists',[])):
  cid=c.get('id') or t['id']+'__checklist_'+str(j);row('Checklist',id=cid,taskId=t['id'],name=c.get('name') or 'Checklist',position=j)
  for k,item in enumerate(c.get('items',[])):
   if item.get('deleted'):continue
   row('ChecklistItem',id=item.get('id') or cid+'__'+str(k),checklistId=cid,name=item['name'],resolved=int(item.get('resolved',False)),position=k)
 for tag in t.get('tags',[]):
  space=next(l['spaceId'] for l in records['List'] if l['id']==lid);tid=space+'__'+tag['name'];row('Tag',id=tid,spaceId=space,name=tag['name'],color='#656f7d');row('TaskTag',taskId=t['id'],tagId=tid)
for tid,comments in b['comments'].items():
 for c in comments:
  row('Comment',id=c['id'],taskId=tid,userId=user(c['user']['id'],c['user'].get('username')),body=rich(c['comment_text']),resolved=int(c.get('resolved',False)),createdAt=iso(c['date']),updatedAt=iso(c['date']))
  thread=next((e['data']['comments'] for e in b['extra'] if e['key']=='thread/'+c['id']),[])
  for reply in thread:row('Comment',id=reply['id'],taskId=tid,userId=user(reply['user']['id'],reply['user'].get('username')),body=rich(reply['comment_text']),parentId=c['id'],resolved=int(reply.get('resolved',False)),createdAt=iso(reply['date']),updatedAt=iso(reply['date']))
for u in users.values():row('User',**u);row('WorkspaceMember',id='member_'+u['id'],workspaceId=workspace,userId=u['id'],role='GUEST',createdAt=now)
restored_files=root/'public/restored-files';restored_files.mkdir(parents=True,exist_ok=True)
for i,a in enumerate(json.loads((backup/'attachments_index.json').read_text())):
 target=hashlib.sha256(a['id'].encode()).hexdigest()+'.bin';shutil.copy2(backup/a['path'],restored_files/target)
 row('Attachment',id=a['id'],taskId=a['task_id'],name=a['title'],url='/restored-files/'+target,size=a['downloaded_bytes'],mime='application/octet-stream',createdAt=iso(a.get('date')) or now)
supported_views=[];unsupported_views=[]
for v0 in b['views']['views']:
 v=v0['value'];p=v.get('parent',{});vt=str(v.get('type')).upper()
 if p.get('type')=='list' and p.get('id') in list_index and vt in ['LIST','BOARD','CALENDAR','GANTT','TABLE']:
  group=(v.get('grouping') or {}).get('field') or 'status'; group=group if group in ['status','assignee','priority','none'] else 'status'
  cfg={'filters':{'priorities':[],'assignees':[],'tags':[]},'sort':{'field':None,'dir':'asc'},'groupBy':group}
  row('View',id=v['id'],listId=p['id'],name=v.get('name') or vt.title(),type=vt,config=json.dumps(cfg),position=len(records['View']));supported_views.append(v['id'])
 else:unsupported_views.append({'id':v['id'],'name':v.get('name'),'type':v.get('type'),'parent':p})
for lid in list_index:
 if not any(v['listId']==lid for v in records['View']):
  for i,vt in enumerate(['LIST','BOARD','TABLE','CALENDAR','GANTT']):row('View',id=lid+'__'+vt,listId=lid,name={'LIST':'Lista','BOARD':'Tablero','TABLE':'Tabla','CALENDAR':'Calendario','GANTT':'Gantt'}[vt],type=vt,config=json.dumps({'filters':{'priorities':[],'assignees':[],'tags':[]},'sort':{'field':None,'dir':'asc'},'groupBy':'status'}),position=i)
order=['User','Workspace','WorkspaceMember','Space','Folder','List','Status','CustomField','CustomFieldOption','Task','TaskAssignee','TaskWatcher','Tag','TaskTag','CustomFieldValue','Checklist','ChecklistItem','Comment','Attachment','View']
for table in order:
 for r in records[table]:
  cols=list(r);ops.append({'sql':f'INSERT OR IGNORE INTO "{table}" ('+', '.join('"'+x+'"' for x in cols)+') VALUES ('+', '.join('?' for x in cols)+')','params':[r[k] for k in cols]})
for tid,pid in parents:ops.append({'sql':'UPDATE "Task" SET "parentId" = ? WHERE "id" = ?','params':[pid,tid]})
report={'source_repository':'https://github.com/goshops-com/open-clickup','source_commit':'fd92240fbcec674afed5096b61f9414d16d1b653','backup_date':'2026-10-30','counts':{k:len(v) for k,v in records.items()},'restored_source_views':len(supported_views),'source_views_preserved_as_metadata_only':unsupported_views,'converted_custom_fields':unsupported,'original_backup_limitations':manifest['limitations'],'additional_limitations':['Es una adaptación de ensayo para Sites, no el repositorio original ejecutado sin cambios.','Los usuarios importados son identidades de referencia para asignación e historial, no tienen acceso habilitado. Solo el propietario de este Site puede operar.','Los tipos de tareas se representan mediante el campo personalizado Tipo de tarea.','Las vistas recuperadas conservan nombre y tipo; filtros y agrupaciones avanzadas requieren reconfiguración.','Las recurrencias no se activan al importar para evitar crear tareas automáticamente durante el ensayo.','Los documentos se conservan como texto de consulta y las descripciones históricas se importan como texto seguro, sin fidelidad completa al editor original.','Las relaciones fuera del respaldo y widgets de dashboards no se reconstruyen.','Las actualizaciones en vivo del repositorio usan eventos en memoria; entre distintas instancias se requiere refrescar.']}
(root/'lib/restore-plan.json').write_text(json.dumps({'workspaceId':workspace,'operations':ops,'report':report},ensure_ascii=False,separators=(',',':')))
(root/'lib/restored-documents.json').write_text(json.dumps(b['document_pages'],ensure_ascii=False))
(root/'IMPORT_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'tables':report['counts'],'operations':len(ops),'supported_source_views':len(supported_views),'unsupported_fields':len(unsupported)},ensure_ascii=False))
