"use client";
import {createContext,useCallback,useContext,useEffect,useState,useSyncExternalStore,type Dispatch,type SetStateAction} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {apiGet,apiSend} from '@/lib/api';
import {useWorkspace} from '@/components/workspace-context';
import {ViewPreferenceQueue} from '@/lib/view-preference-queue';
import {applyPreferencePatch,preferencePatchSchema,type ListViewPreferences,type PreferencePatch,type ViewPreference} from '@/lib/view-preference-model';
import type {GroupBy} from '@/lib/view-state';

const queues=new Map<string,ViewPreferenceQueue>();
const emptySnapshot={version:0,saving:false,error:'',unsaved:{views:{}} as PreferencePatch};
function queueFor(key:string,url:string,onSaved:(p:PreferencePatch)=>void){
 if(typeof window!=='undefined'&&queues.has(key))return queues.get(key)!;
 let initial:PreferencePatch={views:{}};
 try{const parsed=preferencePatchSchema.safeParse(JSON.parse(localStorage.getItem(key)??'{}'));if(parsed.success)initial=parsed.data;}catch{}
 const queue=new ViewPreferenceQueue(initial,async patch=>{await apiSend(url,'PATCH',patch,{keepalive:true});onSaved(patch);},patch=>{
  try{if(Object.keys(patch.views).length||patch.activeViewId)localStorage.setItem(key,JSON.stringify(patch));else localStorage.removeItem(key);}catch{}
 });
 if(typeof window!=='undefined')queues.set(key,queue);return queue;
}
export function usePersonalViews(listId:string){
 const {currentUser}=useWorkspace(),qc=useQueryClient(),key=['personal-views',currentUser.id,listId],url=`/api/lists/${listId}/view-preferences`;
 const[queue]=useState(()=>queueFor(`sav3:view-pending:${currentUser.id}:${listId}`,url,patch=>qc.setQueryData<ListViewPreferences>(key,old=>old?applyPreferencePatch(old,patch):old)));
 const snapshot=useSyncExternalStore(queue.subscribe,queue.getSnapshot,()=>emptySnapshot);
 const query=useQuery({queryKey:key,queryFn:async()=>{await queue.flush();const data=await apiGet<ListViewPreferences>(url);queue.prune(new Set(Object.keys(data.views)));return data;},staleTime:Infinity,refetchOnMount:'always',refetchOnWindowFocus:false,refetchOnReconnect:false,retry:1});
 useEffect(()=>{const retry=()=>void queue.flush();window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[queue]);
 useEffect(()=>{if(!snapshot.error)return;const timer=setTimeout(()=>void queue.flush(),5000);return()=>clearTimeout(timer);},[queue,snapshot.error,snapshot.version]);
 const update=useCallback((patch:PreferencePatch)=>{qc.setQueryData<ListViewPreferences>(['personal-views',currentUser.id,listId],old=>old?applyPreferencePatch(old,patch):old);queue.enqueue(patch);},[qc,queue,currentUser.id,listId]);
 const data=query.data?applyPreferencePatch(query.data,snapshot.unsaved):undefined;
 return {data,loading:query.isPending||query.isFetching,error:query.error?.message,saveError:snapshot.error,saving:snapshot.saving,update,retry:()=>{void query.refetch();void queue.flush();}};
}

type Presentation={state:ViewPreference;groupBy:GroupBy;update:(patch:ViewPreference)=>void};
const Context=createContext<Presentation|null>(null);
export function PersonalView({state,groupBy,update,children}:Presentation&{children:React.ReactNode}){return <Context.Provider value={{state,groupBy,update}}>{children}</Context.Provider>;}
export function useCollapsedGroups():[Set<string>,Dispatch<SetStateAction<Set<string>>>]{
 const ctx=useContext(Context),[local,setLocal]=useState(new Set<string>()),prefix=(ctx?.groupBy??'status')+':';
 const current=ctx?new Set(Object.entries(ctx.state.collapsedGroups??{}).filter(([key,v])=>v&&key.startsWith(prefix)).map(([key])=>key.slice(prefix.length))):local;
 return [current,next=>{const value=typeof next==='function'?next(current):next;if(!ctx){setLocal(value);return;}const patch:Record<string,boolean>={};for(const id of new Set([...current,...value]))if(current.has(id)!==value.has(id))patch[prefix+id]=value.has(id);ctx.update({collapsedGroups:patch});}];
}
export function useGroupCollapsed(id:string):[boolean,Dispatch<SetStateAction<boolean>>]{const[groups,setGroups]=useCollapsedGroups(),collapsed=groups.has(id);return[collapsed,next=>{const value=typeof next==='function'?next(collapsed):next;setGroups(old=>{const copy=new Set(old);if(value)copy.add(id);else copy.delete(id);return copy;});}];}
export function useTaskExpanded(id:string):[boolean,Dispatch<SetStateAction<boolean>>]{const ctx=useContext(Context),[local,setLocal]=useState(false),current=ctx?ctx.state.expandedTasks?.[id]??false:local;return[current,next=>{const value=typeof next==='function'?next(current):next;if(ctx)ctx.update({expandedTasks:{[id]:value}});else setLocal(value);}];}
export function useCalendarPosition(){
 const ctx=useContext(Context),[today]=useState(()=>new Date()),[local,setLocal]=useState(today),[localMode,setLocalMode]=useState<'month'|'week'>('month');
 const stored=ctx?.state.calendar?.cursor,cursor=stored?new Date(Number(stored.slice(0,4)),Number(stored.slice(5,7))-1,Number(stored.slice(8,10)),12):local;
 const mode=ctx?.state.calendar?.mode??localMode;
 const setCursor:Dispatch<SetStateAction<Date>>=next=>{const value=typeof next==='function'?next(cursor):next;if(ctx)ctx.update({calendar:{cursor:`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`}});else setLocal(value);};
 return {cursor,setCursor,mode,setMode:(mode:'month'|'week')=>{if(ctx)ctx.update({calendar:{mode}});else setLocalMode(mode);}};
}
