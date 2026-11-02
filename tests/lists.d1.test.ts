import { Access,withActor,type Actor, type Grant } from "@/lib/access-context";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "@/lib/generated/prisma/client";

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null, db: null as D1Database | null }));
vi.mock("@/lib/generated/prisma/internal/query_compiler_fast_bg.wasm?module", async () => {
  const { readFileSync } = await import("node:fs");
  return { default: new WebAssembly.Module(readFileSync("lib/generated/prisma/internal/query_compiler_fast_bg.wasm")) };
});
vi.mock("@/lib/db", () => ({
  getD1: () => holder.db!,
  prisma: new Proxy({}, { get: (_target, key) => Reflect.get(holder.client!, key) }),
}));
import { createTask, updateTask } from "@/lib/tasks";
import { readTaskRelations } from "@/lib/list-task-reader";
import { getListData,getTaskDetail,getWorkspaceTree,taskInclude } from "@/lib/queries";

// Use Wrangler's own D1 emulator rather than mocking Prisma query results.
const require = createRequire(import.meta.url);
const { Miniflare } = require(require.resolve("miniflare", {
  paths: [require.resolve("wrangler")],
}));
let emulator: InstanceType<typeof Miniflare>;

beforeAll(async () => {
  emulator = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response('ok'); } }",
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "test-lists" },
  });
  const db = await emulator.getD1Database("DB");
  holder.db = db;
  const schema = readFileSync("drizzle/0000_soft_butterfly.sql", "utf8");
  for (const sql of schema.split("--> statement-breakpoint")) {
    if (sql.trim()) await db.prepare(sql).run();
  }
  holder.client = new PrismaClient({ adapter: new PrismaD1(db) });
  const p = holder.client;
  await p.workspace.create({ data: { id: "test-workspace", name: "Test" } });
  await p.space.create({ data: { id: "test-space", workspaceId: "test-workspace", name: "Test" } });
  await p.list.create({ data: { id: "test-list", spaceId: "test-space", name: "Large list" } });
  await p.status.create({ data: { id: "test-status", listId: "test-list", name: "Open", type: "NOT_STARTED" } });
  for (let i = 0; i < 130; i++) {
    await p.task.create({ data: { id: `task-${i}`, name: `Task ${i}`, listId: "test-list", statusId: "test-status", position: i } });
  }
  await p.user.create({data:{id:"relation-user",email:"relation@example.com",name:"Relation User"}});
  await p.taskAssignee.create({data:{taskId:"task-0",userId:"relation-user"}});
  await p.tag.create({data:{id:"tag",spaceId:"test-space",name:"Tag"}});
  await p.taskTag.create({data:{taskId:"task-0",tagId:"tag"}});
  await p.customField.create({data:{id:"field",listId:"test-list",name:"Field",type:"TEXT"}});
  await p.customFieldValue.create({data:{taskId:"task-0",customFieldId:"field",value:["one",2,false]}});
  await p.comment.create({data:{taskId:"task-0",userId:"relation-user",body:"Comment"}});
  await p.checklist.create({data:{taskId:"task-0",name:"Checklist"}});
  await p.task.update({where:{id:"task-0"},data:{dueDate:new Date("2026-11-20T12:00:00Z")}});
  await p.task.create({data:{id:"private-sub",name:"Hidden subtask",listId:"test-list",statusId:"test-status",parentId:"task-0"}});
  await p.taskDependency.create({ data: { blockerId: "task-0", blockedId: "task-129" } });
}, 30_000);

afterAll(async () => {
  await holder.client?.$disconnect();
  await emulator?.dispose();
});

const nodes=[{id:"test-space",type:"SPACE" as const},{id:"test-list",type:"LIST" as const,parentId:"test-space",parentType:"SPACE" as const},...Array.from({length:130},(_,i)=>({id:`task-${i}`,type:"TASK" as const,listId:"test-list",parentId:"test-list",parentType:"LIST" as const})),{id:"private-sub",type:"TASK" as const,listId:"test-list",parentId:"task-0",parentType:"TASK" as const}];
function member(grants:Grant[]):Actor {return {user:{id:"test",name:"Test",email:"test@example.com",color:"#000000",avatarUrl:null},role:"MEMBER",workspaceId:"test-workspace",kind:"local",access:new Access("MEMBER",false,nodes,grants)};}
describe("large lists on D1", () => {
  it("preserves relations on create/update and returns archived tasks after a successful write",async()=>{
    const a={...member([]),role:"OWNER" as const,access:new Access("OWNER",true,nodes,[])};
    await withActor(a,async()=>{
      const created=await createTask({listId:"test-list",name:"Temporary mutation test",createdById:"relation-user",assigneeIds:["relation-user"]});
      expect(created.assignees[0].user.name).toBe("Relation User");
      const saved=await updateTask(created.id,{priority:"HIGH",archived:true},"relation-user");
      expect(saved.priority).toBe("HIGH");expect(saved.archived).toBe(true);
      expect(saved.assignees[0].user.email).toBe("relation@example.com");
      expect(await holder.client!.activity.count({where:{taskId:created.id}})).toBe(2);
      await holder.client!.task.delete({where:{id:created.id}});
    });
  });
  it("matches Prisma relations in a single D1 batch",async()=>{
    const batch=vi.fn((statements:D1PreparedStatement[])=>holder.db!.batch(statements));
    const database={prepare:(sql:string)=>holder.db!.prepare(sql),batch} as unknown as D1Database;
    const actual=await readTaskRelations(database,"task-0");
    expect(batch).toHaveBeenCalledTimes(1);
    const expected=await holder.client!.task.findUniqueOrThrow({where:{id:"task-0"},include:taskInclude});
    expect(actual).toEqual(expected);
  });

  it("projects only a directly shared task, including search/navigation counts and dependencies",async()=>{
    const a=member([{resourceType:"TASK",resourceId:"task-0",level:"VIEW"},{resourceType:"TASK",resourceId:"private-sub",level:"NONE"}]);
    await withActor(a,async()=>{const list=await getListData("test-list");expect(list?.tasks.map(t=>t.id)).toEqual(["task-0"]);expect(list?.tasks[0].subtasks).toEqual([]);expect(list?.dependencies).toEqual([]);const task=await getTaskDetail("task-0");expect(task?.subtasks).toEqual([]);expect(task?.blocking).toEqual([]);expect(task?._count.subtasks).toBe(0);const tree=await getWorkspaceTree();expect(tree?.spaces[0].lists[0]._count.tasks).toBe(1);await expect(getTaskDetail("task-129")).rejects.toMatchObject({status:403});});
  });
  it("makes a directly shared subtask discoverable without revealing its parent or siblings",async()=>{
    await withActor(member([{resourceType:"TASK",resourceId:"private-sub",level:"VIEW"}]),async()=>{const list=await getListData("test-list");expect(list?.tasks.map(t=>t.id)).toEqual(["private-sub"]);expect(await getListData("other-list")).toBeNull();});
  });
  it("returns all 130 tasks, their relations and dependencies", async () => {
    const result = await withActor({user:{id:"test",name:"Test",email:"test@example.com",color:"#000000",avatarUrl:null},role:"OWNER",workspaceId:"test-workspace",kind:"native",access:new Access("OWNER",true,[{id:"test-list",type:"LIST"},...Array.from({length:130},(_,i)=>({id:`task-${i}`,type:"TASK" as const,listId:"test-list"}))],[])} satisfies Actor,()=>getListData("test-list"));
    expect(result?.tasks).toHaveLength(130);
    expect(result?.tasks[0].status.name).toBe("Open");
    const reference=await holder.client!.task.findUniqueOrThrow({where:{id:"task-0"},include:taskInclude});
    // The owner fixture intentionally has no access node for the hidden child.
    expect(result?.tasks[0]).toEqual({...reference,subtasks:[],_count:{...reference._count,subtasks:0}});
    expect(result?.tasks[0].customFieldValues[0].value).toEqual(["one",2,false]);
    expect(result?.tasks[129].id).toBe("task-129");
    expect(result?.dependencies).toEqual([
      expect.objectContaining({ blockerId: "task-0", blockedId: "task-129" }),
    ]);
  });
});
