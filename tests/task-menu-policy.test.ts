import {describe,it,expect} from 'vitest';
import {Access,type Actor,type Resource,type Role} from '@/lib/access-context';
import {taskMenuPermissions} from '@/lib/task-menu-policy';
const graph:Resource[]=[{id:'s',type:'SPACE'},{id:'l',type:'LIST',parentId:'s',parentType:'SPACE'},{id:'other',type:'LIST',parentId:'s',parentType:'SPACE'},{id:'t',type:'TASK',listId:'l',parentId:'l',parentType:'LIST'},{id:'child',type:'TASK',listId:'l',parentId:'t',parentType:'TASK'}];
function actor(role:Role,grants:ConstructorParameters<typeof Access>[3]):Pick<Actor,'role'|'access'|'tokenScope'>{return{role,access:new Access(role,false,graph,grants)};}
const task={id:'t',listId:'l',parentId:null};
describe('task menu capabilities',()=>{
 it('hides mutation commands for readers/guests and allows a member personal reminders',()=>{
  const reader=taskMenuPermissions(actor('MEMBER',[{resourceType:'TASK',resourceId:'t',level:'VIEW'}]),task);
  expect(reader).toMatchObject({canEdit:false,canDelete:false,canDuplicate:false,canMove:false,canSaveTemplate:false,canManageFields:false,canRemind:true,moveListIds:[]});
  const guest=taskMenuPermissions(actor('GUEST',[{resourceType:'LIST',resourceId:'l',level:'EDIT'}]),task);expect(guest.canEdit).toBe(false);expect(guest.canRemind).toBe(false);
 });
 it('distinguishes task-only edit access from List management and template administration',()=>{
  const p=taskMenuPermissions(actor('MEMBER',[{resourceType:'TASK',resourceId:'t',level:'EDIT'}]),task);
  expect(p).toMatchObject({canEdit:true,canDelete:true,canDuplicate:false,canManageFields:false,canMove:false,canSaveTemplate:false});
 });
 it('does not offer delete/move for a tree with a protected child or a non-editable target List',()=>{
  const p=taskMenuPermissions(actor('MEMBER',[{resourceType:'LIST',resourceId:'l',level:'EDIT'},{resourceType:'TASK',resourceId:'child',level:'NONE'},{resourceType:'LIST',resourceId:'other',level:'VIEW'}]),task);
  expect(p.canEdit).toBe(true);expect(p.canDelete).toBe(false);expect(p.canMove).toBe(false);expect(p.moveListIds).toEqual([]);
 });
 it('allows admin actions and valid destinations, but does not offer moving a subtask alone',()=>{
  const a=actor('OWNER',[]),p=taskMenuPermissions(a,task);expect(p).toMatchObject({canDelete:true,canMove:true,canSaveTemplate:true,moveListIds:['other']});
  expect(taskMenuPermissions(a,{id:'child',listId:'l',parentId:'t'}).canMove).toBe(false);
  expect(taskMenuPermissions({...a,tokenScope:'read'},task).canEdit).toBe(false);
  const deep={...a,access:new Access('OWNER',false,[...graph,{id:'grandchild',type:'TASK',listId:'l',parentId:'child',parentType:'TASK'}],[])};
  expect(taskMenuPermissions(deep,task).canMove).toBe(false);
 });
});
