import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),{Miniflare}=require(require.resolve('miniflare',{paths:[require.resolve('wrangler')]}));
const legacyImage=new TextEncoder().encode('GIF89a-original-bytes');
const mf=new Miniflare({modules:readdirSync('dist/server',{recursive:true}).filter(f=>String(f).endsWith('.js')||String(f).endsWith('.wasm')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:String(a).localeCompare(String(b))).map(f=>({type:String(f).endsWith('.wasm')?'CompiledWasm':'ESModule',path:resolve('dist/server',String(f))})),modulesRoot:resolve('dist/server'),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'smoke'},r2Buckets:['BUCKET'],serviceBindings:{ASSETS:(req:Request)=>new URL(req.url).pathname==='/restored-files/legacy.bin'?new Response(legacyImage):new Response('Not found',{status:404})}});
try{const db=await mf.getD1Database('DB');for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+f,'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();const token='sav3_'+'ab'.repeat(32);await db.batch([
 db.prepare("INSERT INTO User(id,email,name) VALUES('qa','qa@example.test','QA')"),db.prepare("INSERT INTO Workspace(id,name) VALUES('90132980889','QA')"),db.prepare("INSERT INTO WorkspaceMember(id,workspaceId,userId,role) VALUES('m','90132980889','qa','OWNER')"),db.prepare("INSERT INTO AccountAccess(userId,enabled,scopeAll) VALUES('qa',1,1)"),db.prepare("INSERT INTO Space(id,workspaceId,name) VALUES('s','90132980889','Space')"),db.prepare("INSERT INTO List(id,spaceId,name) VALUES('l','s','List')"),db.prepare("INSERT INTO Status(id,listId,name,type) VALUES('st','l','Open','NOT_STARTED')"),db.prepare("INSERT INTO IntegrationToken(id,userId,name,tokenHash,scope,createdAt,expiresAt) VALUES('key','qa','QA',?,'write',?,?)").bind(createHash('sha256').update(token).digest('hex'),Date.now(),Date.now()+3600000)]);
 async function call(path:string,method='GET',body?:unknown,auth=true,key?:string){const r=await mf.dispatchFetch('https://site.test'+path,{method,headers:{...(auth?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();console.log(method,path,r.status);if(r.status>=400)throw new Error(JSON.stringify(d));return d as {id:string};}
 const anon=await mf.dispatchFetch('https://site.test/api/tasks?listId=l');if(anon.status!==401)throw new Error('Anonymous access '+anon.status);console.log('anonymous ACL',anon.status);
 await call('/api/v1/tasks?listId=l');const first=await call('/api/v1/tasks','POST',{listId:'l',name:'Smoke task'},true,'smoke-create');const second=await call('/api/v1/tasks','POST',{listId:'l',name:'Smoke task'},true,'smoke-create');if(first.id!==second.id)throw new Error('Idempotent create duplicated');await call('/api/v1/search?q=Smoke');await call('/api/custom-fields');// Exercise actual multipart upload and byte-identical delivery through compiled routes.
 const native={'oai-authenticated-user-id':'qa-native','oai-authenticated-user-email':'qa@example.test',Origin:'https://site.test'};
 const taskUrl='/l/l?task='+first.id;
 const sharedRedirect=await mf.dispatchFetch('https://site.test'+taskUrl,{headers:{Accept:'text/html'},redirect:'manual'});
 const loginLocation=sharedRedirect.headers.get('Location');
 if(sharedRedirect.status!==303||!loginLocation||new URL(loginLocation).searchParams.get('return_to')!==taskUrl)throw new Error('Shared task login lost its destination');
 const loginPage=await mf.dispatchFetch(loginLocation),loginHtml=await loginPage.text();
 if(loginPage.status!==200||!loginHtml.includes('/signin-with-chatgpt?return_to='+encodeURIComponent(taskUrl)))throw new Error('Login does not preserve task destination for owner sign-in');
 console.log('Shared task redirects to login with its original destination');
 await db.prepare("INSERT INTO RestoreState(id,ownerKey,complete) VALUES('backup-2026-10-30','qa-native',1)").run();
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=','base64'));
 for(const [name,mime,bytes] of [['Más posibilidades.png','application/octet-stream',png],['Contrato.pdf','application/pdf',new TextEncoder().encode('%PDF-1.7\nOriginal attachment')]] as const){
  const form=new FormData();form.append('file',new File([bytes],name,{type:mime}));
  const multipart=new Request('https://site.test',{method:'POST',body:form});
  const uploaded=await mf.dispatchFetch('https://site.test/api/tasks/'+first.id+'/attachments',{method:'POST',headers:{...native,'Content-Type':multipart.headers.get('Content-Type')!},body:new Uint8Array(await multipart.arrayBuffer())});
  if(uploaded.status!==201)throw new Error('Upload failed '+uploaded.status+' '+await uploaded.text());
  const a=await uploaded.json() as {id:string;mime:string};
  if(name.endsWith('.png')&&a.mime!=='image/png')throw new Error('Upload MIME not repaired');
  for(const suffix of ['', '?download=1']){
   const response=await mf.dispatchFetch('https://site.test/api/files/'+a.id+suffix,{headers:native});
   if(response.status!==200)throw new Error('Attachment GET '+response.status+' '+await response.text());
   if(!response.headers.get('Content-Disposition')?.includes('filename*=UTF-8'))throw new Error('Filename missing');
   if((suffix||!name.endsWith('.png'))&&!response.headers.get('Content-Disposition')?.startsWith('attachment;'))throw new Error('Download not forced');
   if(!Buffer.from(await response.arrayBuffer()).equals(Buffer.from(bytes)))throw new Error('Attachment bytes changed');
  }
  const denied=await mf.dispatchFetch('https://site.test/api/files/'+a.id);
  if(denied.status!==401)throw new Error('Anonymous attachment exposed');
 }
 await db.prepare("INSERT INTO Attachment(id,taskId,name,url,size,mime,uploadedById) VALUES('legacy',?,'Importada.gif','/restored-files/legacy.bin',?,'application/octet-stream','qa')").bind(first.id,legacyImage.length).run();
 const imported=await mf.dispatchFetch('https://site.test/api/files/legacy',{headers:native});
 if(imported.status!==200||imported.headers.get('Content-Type')!=='image/gif'||!Buffer.from(await imported.arrayBuffer()).equals(Buffer.from(legacyImage)))throw new Error('Imported attachment delivery failed');
 console.log('Attachment upload, inline image, named download, exact bytes, imported assets and anonymous ACL passed');
 await db.batch([db.prepare("INSERT INTO User(id,email,name) VALUES('recovery-user','recovery@example.test','Recovery test')"),db.prepare("INSERT INTO WorkspaceMember(id,workspaceId,userId,role) VALUES('recovery-member','90132980889','recovery-user','MEMBER')"),db.prepare("INSERT INTO AccountAccess(userId,enabled,scopeAll) VALUES('recovery-user',1,0)")]);
 // Checklist assignment and nested child removal through the real compiled router.
 async function web(path:string,method='GET',body?:unknown,expected=200){
  const r=await mf.dispatchFetch('https://site.test'+path,{method,headers:{...native,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await r.json();if(r.status!==expected)throw new Error(path+' '+r.status+' '+JSON.stringify(data));return data;
 }
 await db.prepare("INSERT INTO ResourceGrant(userId,resourceType,resourceId,level) VALUES('recovery-user','LIST','l','EDIT')").run();
 const cl=await web('/api/tasks/'+first.id+'/checklists','POST',{},201) as {id:string};
 const ci=await web('/api/checklists/'+cl.id+'/items','POST',{name:'Assigned checklist item',assigneeId:'recovery-user'},201) as {id:string;assignee:{id:string}};
 if(ci.assignee?.id!=='recovery-user')throw new Error('Checklist assignee missing');
 await web('/api/checklist-items/'+ci.id,'PATCH',{resolved:true});
 const detail=await web('/api/tasks/'+first.id) as {checklists:{id:string;items:{id:string;assigneeId:string;resolved:boolean}[]}[]};
 if(!detail.checklists.find(c=>c.id===cl.id)?.items.some(i=>i.id===ci.id&&i.assigneeId==='recovery-user'&&i.resolved))throw new Error('Checklist assignment not persisted');
 if(!(await db.prepare("SELECT id FROM Notification WHERE userId='recovery-user' AND type='assigned'").first()))throw new Error('Checklist assignment notification missing');
 await web('/api/checklist-items/'+ci.id,'PATCH',{assigneeId:null});
 await web('/api/checklist-items/'+ci.id,'PATCH',{assigneeId:'missing'},400);
 const nestedParent=await web('/api/tasks','POST',{listId:'l',name:'Subtask',parentId:first.id},201) as {id:string};
 const nestedChild=await web('/api/tasks','POST',{listId:'l',name:'Nested child',parentId:nestedParent.id},201) as {id:string};
 const childDetail=await web('/api/tasks/'+nestedChild.id) as {parent:{id:string;name:string;listId:string}|null};
 if(childDetail.parent?.id!==nestedParent.id||childDetail.parent.name!=='Subtask'||childDetail.parent.listId!=='l')throw new Error('Nested parent navigation metadata missing');
 const rootDetail=await web('/api/tasks/'+first.id) as {parent:unknown};if(rootDetail.parent!==null)throw new Error('Root task has a parent');
 console.log('Nested subtask exposes its immediate parent; root task has no parent');
 const parentDetail=await web('/api/tasks/'+nestedParent.id) as {subtasks:{id:string}[]};
 if(!parentDetail.subtasks.some(t=>t.id===nestedChild.id))throw new Error('Nested child not shown');
 await web('/api/tasks/'+nestedChild.id,'DELETE');
 const parentAfter=await web('/api/tasks/'+nestedParent.id) as {subtasks:{id:string}[]};
 if(parentAfter.subtasks.some(t=>t.id===nestedChild.id))throw new Error('Deleted child still visible');
 if(!(await db.prepare('SELECT entityId FROM TrashEntity WHERE entityId=?').bind(nestedChild.id).first()))throw new Error('Nested child not recoverable');
 const unauthed=await mf.dispatchFetch('https://site.test/api/checklist-items/'+ci.id,{method:'PATCH',headers:{Origin:'https://site.test','Content-Type':'application/json'},body:'{"resolved":false}'});if(unauthed.status!==401)throw new Error('Anonymous checklist write allowed');
 console.log('Checklist assignment, notification, persistent state, anonymous ACL and nested subtask trash passed');
 const reset=await mf.dispatchFetch('https://site.test/api/team/users/reset-password',{method:'POST',headers:{...native,'Content-Type':'application/json'},body:JSON.stringify({userId:'recovery-user'})});
 if(reset.status!==200)throw new Error('Owner password reset failed '+reset.status);
 const generated=await reset.json() as {password:string};
 const logged=await mf.dispatchFetch('https://site.test/api/auth/login',{method:'POST',headers:{Origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify({email:'recovery@example.test',password:generated.password})});
 if(logged.status!==200)throw new Error('Generated password login failed '+logged.status);
 console.log('Owner-generated password accepted by compiled login');
 const cookie=logged.headers.get('Set-Cookie')!.split(';')[0];
 // Exercise the same cookie and renewal header through the compiled Worker.
 if(!logged.headers.get('Set-Cookie')?.includes('Max-Age=432000'))throw new Error('Login cookie does not last five days');
 const browserSessionId=createHash('sha256').update(cookie.split('=')[1]).digest('hex');
 const legacyDeadline=new Date(Date.now()+3600000).toISOString();
 await db.prepare('UPDATE Session SET expiresAt=? WHERE id=?').bind(legacyDeadline,browserSessionId).run();
 const idleSignal={clientId:'550e8400-e29b-41d4-a716-446655440002',visible:false,idleMs:0,resources:[]};
 const idleResponse=await mf.dispatchFetch('https://site.test/api/presence',{method:'POST',headers:{Cookie:cookie,Origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify(idleSignal)});
 if(idleResponse.status!==200||idleResponse.headers.has('Set-Cookie'))throw new Error('Hidden tab renewed session');
 const unchanged=await db.prepare('SELECT expiresAt FROM Session WHERE id=?').bind(browserSessionId).first() as {expiresAt:string}|null;if(unchanged?.expiresAt!==legacyDeadline)throw new Error('Hidden tab changed expiry');
 const presenceBody={clientId:'550e8400-e29b-41d4-a716-446655440000',visible:true,idleMs:0,resources:[]};
 async function ping(){return mf.dispatchFetch('https://site.test/api/presence',{method:'POST',headers:{Cookie:cookie,Origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify(presenceBody)})}
 const before=await ping();if(before.status!==200)throw new Error('Presence '+before.status);const initial=await before.json() as {revision:string};
 if(!before.headers.get('Set-Cookie')?.includes('Max-Age=432000'))throw new Error('Active presence failed to renew browser cookie');
 const renewed=await db.prepare('SELECT expiresAt FROM Session WHERE id=?').bind(browserSessionId).first() as {expiresAt:string}|null;if(!renewed||Date.parse(renewed.expiresAt)<Date.now()+4.99*86400000)throw new Error('Session deadline was not renewed');
 console.log('Five-day persistent login, idle exclusion and renewal headers through compiled Worker passed');
 const edit=await mf.dispatchFetch('https://site.test/api/team/users',{method:'PATCH',headers:{...native,'Content-Type':'application/json'},body:JSON.stringify({userId:'recovery-user',enabled:true,role:'GUEST',scopeAll:false,grants:[{resourceType:'LIST',resourceId:'l',level:'VIEW'}]})});
 if(edit.status!==200)throw new Error('Permission edit '+edit.status);
 const after=await ping();if(after.status!==200)throw new Error('Permission edit logged out user');const current=await after.json() as {revision:string};if(current.revision===initial.revision)throw new Error('Permission revision did not change');
 const overview=await mf.dispatchFetch('https://site.test/api/team/presence',{headers:native});if(overview.status!==200)throw new Error('Presence overview '+overview.status);const overviewBody=await overview.json() as {users:{id:string;state:string}[]};if(overviewBody.users.find(u=>u.id==='recovery-user')?.state!=='active')throw new Error('Active member absent');
 const privateOverview=await mf.dispatchFetch('https://site.test/api/team/presence',{headers:{Cookie:cookie}});if(privateOverview.status!==403)throw new Error('Presence overview exposed');
 const guestChecklist=await mf.dispatchFetch('https://site.test/api/checklist-items/'+ci.id,{method:'PATCH',headers:{Cookie:cookie,Origin:'https://site.test','Content-Type':'application/json'},body:'{"resolved":false}'});if(guestChecklist.status!==403)throw new Error('Guest checklist write allowed');
 console.log('Same-session permission change, revision update and owner-only presence passed');
 const guestDetail=await mf.dispatchFetch('https://site.test/api/tasks/'+first.id,{headers:{Cookie:cookie}});
 const guestTask=await guestDetail.json() as {menuPermissions:{canEdit:boolean;canDelete:boolean;canDuplicate:boolean;canSaveTemplate:boolean}};
 if(guestDetail.status!==200||guestTask.menuPermissions.canEdit||guestTask.menuPermissions.canDelete||guestTask.menuPermissions.canDuplicate||guestTask.menuPermissions.canSaveTemplate)throw new Error('Guest task menu permits mutations');
 await db.batch([db.prepare("INSERT INTO List(id,spaceId,name) VALUES('private-link-list','s','Private')"),db.prepare("INSERT INTO Status(id,listId,name,type) VALUES('private-link-status','private-link-list','Open','NOT_STARTED')"),db.prepare("INSERT INTO Task(id,listId,statusId,name,updatedAt) VALUES('private-link-task','private-link-list','private-link-status','Hidden',?)").bind(new Date().toISOString())]);
 const deniedLink=await mf.dispatchFetch('https://site.test/api/tasks/private-link-task',{headers:{Cookie:cookie}});if(deniedLink.status!==403)throw new Error('A task link granted access to a private task');
 console.log('Task menu reflects guest permissions; sharing a link does not grant private task access');
 // Personal widths use the compiled self-preference route, including read-only users.
 await db.prepare("INSERT INTO View(id,listId,name,type,config) VALUES('width-list','l','List','LIST','{}'),('width-table','l','Table','TABLE','{}')").run();
 async function preferenceWrite(body:unknown,expected=200){
  const r=await mf.dispatchFetch('https://site.test/api/lists/l/view-preferences',{method:'PATCH',headers:{Cookie:cookie,Origin:'https://site.test','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(r.status!==expected)throw new Error('Column preference write '+r.status+' '+await r.text());
 }
 await preferenceWrite({views:{'width-list':{columnWidths:{name:450}},'width-table':{columnWidths:{name:700}}}});
 await preferenceWrite({views:{'width-list':{columnWidths:{assignee:160}}}});
 await preferenceWrite({views:{'width-list':{columnWidths:{name:1601}}}},400);
 const savedWidths=await mf.dispatchFetch('https://site.test/api/lists/l/view-preferences',{headers:{Cookie:cookie}});
 const savedBody=await savedWidths.json() as {views:Record<string,{columnWidths?:Record<string,number>}>};
 if(savedWidths.status!==200||savedBody.views['width-list'].columnWidths?.name!==450||savedBody.views['width-list'].columnWidths?.assignee!==160||savedBody.views['width-table'].columnWidths?.name!==700)throw new Error('Personal column widths did not round-trip');
 const ownerWidths=await web('/api/lists/l/view-preferences') as {views:Record<string,{columnWidths?:Record<string,number>}>};
 if(ownerWidths.views['width-list'].columnWidths)throw new Error('Column widths leaked between users');
 const anonymousWidths=await mf.dispatchFetch('https://site.test/api/lists/l/view-preferences');if(anonymousWidths.status!==401)throw new Error('Anonymous preferences allowed');
 console.log('Personal column widths round-trip, partial merge, per-view/user isolation, guest presentation and validation passed');
 await db.prepare('UPDATE Session SET expiresAt=? WHERE id=?').bind(new Date(Date.now()-1000).toISOString(),browserSessionId).run();
 const expiredPresence=await ping();if(expiredPresence.status!==401||expiredPresence.headers.has('Set-Cookie'))throw new Error('Expired session was revived');
 console.log('Expired browser session rejected without renewal');

 await call('/api/tasks/'+first.id,'DELETE');const tombstone=await db.prepare('SELECT entityId FROM TrashEntity WHERE entityId=?').bind(first.id).first();if(!tombstone)throw new Error('Trash missing');console.log('Compiled Worker smoke passed');}finally{await mf.dispose();}
