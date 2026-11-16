import {QueryClient,MutationObserver} from '@tanstack/react-query';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {apiSend} from '@/lib/api';
import {checklistMutationOptions} from '@/lib/checklist-cache';
import type {TaskDetail} from '@/lib/queries';
vi.mock('@/lib/api',()=>({apiSend:vi.fn()}));
const user={id:'u',name:'Ana',email:'ana@example.test',color:'#18705c',avatarUrl:null};
const item={id:'i',checklistId:'c',name:'Review',position:0,resolved:false,assigneeId:null,assignee:null};
const checklist={id:'c',taskId:'t',name:'Checklist',position:0,items:[item]};
function setup(){const qc=new QueryClient({defaultOptions:{mutations:{retry:false}}});qc.setQueryData(['task','t'],{id:'t',name:'Task',checklists:[checklist],_count:{checklists:1}});return {qc,read:()=>qc.getQueryData<TaskDetail>(['task','t'])!,edit:()=>new MutationObserver(qc,checklistMutationOptions(qc,'t','l'))};}
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
beforeEach(()=>vi.clearAllMocks());
describe('checklists without a task/list reload',()=>{
 it('keeps a new item visible while saving and replaces its temporary identity',async()=>{
  const {read,edit,qc}=setup(),reply=deferred<unknown>();vi.mocked(apiSend).mockReturnValueOnce(reply.promise);const invalidation=vi.spyOn(qc,'invalidateQueries');
  const saved=edit().mutate({kind:'addItem',checklistId:'c',name:'New item'});
  await vi.waitFor(()=>expect(read().checklists[0].items.map(i=>i.name)).toEqual(['Review','New item']));
  reply.resolve({...item,id:'new',name:'New item'});await saved;
  expect(read().checklists[0].items[1].id).toBe('new');expect(invalidation).toHaveBeenCalledWith({queryKey:['task','t'],refetchType:'none'});
  expect(invalidation.mock.calls.some(([options])=>options?.queryKey?.[0]==='list')).toBe(false);
 });
 it('rolls back an assignment failure without reverting a concurrent task title',async()=>{
  const {read,edit,qc}=setup(),reply=deferred<unknown>();vi.mocked(apiSend).mockReturnValueOnce(reply.promise);
  const saved=edit().mutate({kind:'editItem',checklistId:'c',itemId:'i',patch:{assigneeId:'u'},assignee:user}).catch(()=>{});
  await vi.waitFor(()=>expect(read().checklists[0].items[0].assignee?.id).toBe('u'));
  qc.setQueryData<TaskDetail>(['task','t'],old=>({...old!,name:'Another edit'}));reply.reject(new Error('No access'));await saved;
  expect(read().checklists[0].items[0].assigneeId).toBeNull();expect(read().name).toBe('Another edit');
 });
 it('updates completion immediately and accepts the authoritative assigned item',async()=>{
  const {read,edit}=setup(),reply=deferred<unknown>();vi.mocked(apiSend).mockReturnValueOnce(reply.promise);
  const saved=edit().mutate({kind:'editItem',checklistId:'c',itemId:'i',patch:{resolved:true}});
  await vi.waitFor(()=>expect(read().checklists[0].items[0].resolved).toBe(true));reply.resolve({...item,resolved:true,assigneeId:'u',assignee:user});await saved;
  expect(read().checklists[0].items[0].assignee?.name).toBe('Ana');
 });
 it('restores a failed checklist deletion',async()=>{
  const {read,edit}=setup(),reply=deferred<unknown>();vi.mocked(apiSend).mockReturnValueOnce(reply.promise);
  const saved=edit().mutate({kind:'removeChecklist',checklistId:'c'}).catch(()=>{});
  await vi.waitFor(()=>expect(read().checklists).toEqual([]));reply.reject(new Error('Rejected'));await saved;expect(read().checklists).toEqual([checklist]);expect(read()._count.checklists).toBe(1);
 });
});
