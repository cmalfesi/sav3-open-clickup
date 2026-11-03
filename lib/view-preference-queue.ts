import {mergePreferencePatch,type PreferencePatch} from './view-preference-model';
const empty=():PreferencePatch=>({views:{}});
const hasChanges=(p:PreferencePatch)=>!!p.activeViewId||Object.keys(p.views).length>0;
// Serializes writes, coalesces rapid changes and journals unacknowledged state.
export class ViewPreferenceQueue {
 private pending:PreferencePatch;private sending:PreferencePatch=empty();private running:Promise<void>|null=null;
 private listeners=new Set<()=>void>();private version=0;private error='';
 private snapshot={version:0,saving:false,error:'',unsaved:empty()};
 constructor(initial:PreferencePatch,private send:(patch:PreferencePatch)=>Promise<unknown>,private persist:(patch:PreferencePatch)=>void){this.pending=initial;this.publish();}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.snapshot;
 private publish(){this.snapshot={version:++this.version,saving:!!this.running,error:this.error,unsaved:mergePreferencePatch(this.sending,this.pending)};this.persist(this.snapshot.unsaved);this.listeners.forEach(l=>l());}
 enqueue(patch:PreferencePatch){this.pending=mergePreferencePatch(this.pending,patch);this.error='';this.publish();void this.flush();}
 prune(allowed:Set<string>){this.pending={...this.pending,views:Object.fromEntries(Object.entries(this.pending.views).filter(([id])=>allowed.has(id)))};if(this.pending.activeViewId&&!allowed.has(this.pending.activeViewId))delete this.pending.activeViewId;this.publish();}
 flush():Promise<void>{
  if(this.running)return this.running;if(!hasChanges(this.pending))return Promise.resolve();
  this.running=Promise.resolve().then(async()=>{
   while(hasChanges(this.pending)){
    this.sending=this.pending;this.pending=empty();this.publish();
    try{await this.send(this.sending);this.sending=empty();this.error='';this.publish();}
    catch(e){this.pending=mergePreferencePatch(this.sending,this.pending);this.sending=empty();this.error=(e as Error).message;break;}
   }
  }).finally(()=>{this.running=null;this.publish();});this.publish();return this.running;
 }
}
