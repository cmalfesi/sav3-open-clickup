/** One browser-local status for writes, including callers outside React Query. */
type Snapshot = {pending:number;startedAt:number;revision:number;error:string|null};
let snapshot:Snapshot={pending:0,startedAt:0,revision:0,error:null};
const initial=snapshot;
const listeners=new Set<()=>void>();
function emit(next:Snapshot){snapshot=next;listeners.forEach(fn=>fn());}
export const subscribeWrites=(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};};
export const writeSnapshot=()=>snapshot;
export const serverWriteSnapshot=()=>initial;
export function dismissWriteError(){emit({...snapshot,error:null});}
export function failWrite(error:Error){emit({...snapshot,error:error.message,revision:snapshot.revision+1});}
export function beginWrite(){
  emit({...snapshot,pending:snapshot.pending+1,startedAt:snapshot.pending?snapshot.startedAt:Date.now()});
  let ended=false;
  return (error?:unknown)=>{
    if(ended)return;ended=true;
    emit({...snapshot,pending:Math.max(0,snapshot.pending-1),revision:snapshot.revision+1,
      error:error instanceof Error?error.message:error?'No pudimos guardar el cambio.':snapshot.error});
  };
}
export const foregroundWrite=(url:string)=>!/^\/api\/(presence(?:\?|$)|auth\/|notifications\/read)/.test(url);
