import type {Actor} from './access-context';

/** Presentation hints only. Every existing API still authorizes the action. */
export function taskMenuPermissions(a:Pick<Actor,'role'|'access'|'tokenScope'>,task:{id:string;listId:string;parentId:string|null}){
 const canEdit=a.role!=='GUEST'&&a.tokenScope!=='read'&&a.access.can('TASK',task.id,'EDIT');
 const canEditList=canEdit&&a.access.can('LIST',task.listId,'EDIT');
 const nodes=a.access.resources('TASK'),byId=new Map(nodes.map(n=>[n.id,n]));
 // Deleting/moving a parent also requires access to every descendant.
 let hasNestedChildren=false;
 const canEditTree=canEdit&&nodes.every(node=>{
  let current:typeof node|undefined=node,depth=0;const seen=new Set<string>();
  while(current&&!seen.has(current.id)){
   if(current.id===task.id){if(depth>1)hasNestedChildren=true;return a.access.can('TASK',node.id,'EDIT');}
   seen.add(current.id);depth++;current=current.parentType==='TASK'?byId.get(current.parentId??''):undefined;
  }
  return true;
 });
 // The existing move endpoint migrates direct children only, not deeper trees.
 const canMove=canEditList&&canEditTree&&!task.parentId&&!hasNestedChildren;
 return {canEdit,canDelete:canEditTree,canDuplicate:canEditList,canMove,
  moveListIds:canMove?a.access.resources('LIST').filter(list=>list.id!==task.listId&&a.access.can('LIST',list.id,'EDIT')).map(list=>list.id):[],
  canSaveTemplate:canEdit&&a.access.admin,canManageFields:canEditList,canRemind:a.role!=='GUEST'&&a.tokenScope!=='read'};
}
export type TaskMenuPermissions=ReturnType<typeof taskMenuPermissions>;
