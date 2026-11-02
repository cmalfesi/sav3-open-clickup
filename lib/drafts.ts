// Browser-only draft identities; no task content is retained in this registry.
const drafts=new Set<string>();
export function markDraft(id:string,dirty:boolean){if(dirty)drafts.add(id);else drafts.delete(id);}
export function hasDrafts(){return drafts.size>0;}
