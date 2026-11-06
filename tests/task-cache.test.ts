import { QueryClient, MutationObserver } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiGet, apiSend } from "@/lib/api";
import { taskUpdateOptions, putSavedTask } from "@/lib/task-cache";
import type { ListData, TaskWithRelations, TaskDetail } from "@/lib/queries";
vi.mock("@/lib/api",()=>({apiGet:vi.fn(),apiSend:vi.fn()}));

const open={id:"open",listId:"l",name:"Open",color:"#000",type:"NOT_STARTED",position:0,wipLimit:null} as const;
const done={...open,id:"done",name:"Done",type:"DONE"} as const;
function task(id="t"):TaskWithRelations {return {id,listId:"l",statusId:"open",parentId:null,name:id,
  description:null,priority:"LOW",position:0,startDate:null,dueDate:null,timeEstimate:null,recurrence:null,
  createdById:null,createdAt:new Date(),updatedAt:new Date(),completedAt:null,archived:false,status:open,
  assignees:[],tags:[],customFieldValues:[],subtasks:[],_count:{comments:0,subtasks:0,checklists:0}};}
function setup() {
  const qc=new QueryClient({defaultOptions:{mutations:{retry:false}}});
  const original=task();
  qc.setQueryData(["list","l"],{list:{id:"l",name:"List",spaceId:"s",folderId:null,color:null,icon:null,position:0,createdAt:new Date(),space:{id:"s",name:"Space",color:"#000",icon:null},folder:null,customFields:[],views:[],statuses:[open,done]},tasks:[original,task("other")],dependencies:[],deletableViewIds:[],canCreateView:true,manageableViewIds:[]} as ListData);
  qc.setQueryData(["task","t"],{...original,list:{id:"l",statuses:[open,done]},activities:[],watchers:[]} as unknown as TaskDetail);
  return {qc,original,read:()=>qc.getQueryData<ListData>(["list","l"])!,edit:()=>new MutationObserver(qc,taskUpdateOptions(qc,"l"))};
}
function deferred<T>() {let resolve!:(x:T)=>void;let reject!:(e:Error)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

beforeEach(()=>vi.clearAllMocks());
describe("task changes without a full list reload",()=>{
  it("updates status label and detail before the server responds, then uses the saved task",async()=>{
    const {qc,original,read,edit}=setup();const save=deferred<TaskWithRelations>();vi.mocked(apiSend).mockReturnValueOnce(save.promise);
    const invalidate=vi.spyOn(qc,"invalidateQueries");
    const promise=edit().mutate({taskId:"t",patch:{statusId:"done"}});
    await vi.waitFor(()=>expect(read().tasks[0].status.name).toBe("Done"));
    expect(qc.getQueryData<TaskDetail>(["task","t"])?.status.name).toBe("Done");
    save.resolve({...original,statusId:"done",status:done});await promise;
    expect(read().tasks[0].statusId).toBe("done");
    expect(invalidate.mock.calls.some(([v])=>v?.queryKey?.[0]==="list")).toBe(false);
  });
  it("rolls back a rejected change without reverting another task",async()=>{
    const {qc,read,edit}=setup();const save=deferred<TaskWithRelations>();vi.mocked(apiSend).mockReturnValueOnce(save.promise);
    const promise=edit().mutate({taskId:"t",patch:{priority:"HIGH"}}).catch(e=>e);
    await vi.waitFor(()=>expect(read().tasks[0].priority).toBe("HIGH"));
    putSavedTask(qc,"l",{...task("other"),name:"Another saved edit"});
    save.reject(new Error("Forbidden"));await promise;
    expect(read().tasks[0].priority).toBe("LOW");expect(read().tasks[1].name).toBe("Another saved edit");
  });
  it("reconciles overlapping edits with the final server record",async()=>{
    const {original,read,edit}=setup();const first=deferred<TaskWithRelations>(),second=deferred<TaskWithRelations>();
    vi.mocked(apiSend).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const a=edit().mutate({taskId:"t",patch:{priority:"HIGH"}});
    await vi.waitFor(()=>expect(read().tasks[0].priority).toBe("HIGH"));
    const b=edit().mutate({taskId:"t",patch:{priority:"URGENT"}});
    await vi.waitFor(()=>expect(read().tasks[0].priority).toBe("URGENT"));
    first.resolve({...original,priority:"HIGH"});await a;
    expect(read().tasks[0].priority).toBe("URGENT");
    vi.mocked(apiGet).mockResolvedValueOnce({...original,priority:"URGENT"});
    second.resolve({...original,priority:"URGENT"});await b;
    expect(read().tasks[0].priority).toBe("URGENT");expect(apiGet).toHaveBeenCalledTimes(1);
  });
  it("inserts a newly saved task and subtask without downloading the list",()=>{
    const {qc,read}=setup();putSavedTask(qc,"l",{...task("new"),position:200});
    expect(read().tasks.map(t=>t.id)).toEqual(["t","other","new"]);
    putSavedTask(qc,"l",{...task("sub"),parentId:"t"});
    expect(read().tasks[0].subtasks.map(t=>t.id)).toEqual(["sub"]);
    expect(read().tasks[0]._count.subtasks).toBe(1);
  });
});
