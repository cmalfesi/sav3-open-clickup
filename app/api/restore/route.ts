import { env } from "cloudflare:workers";
import { requireRole } from "@/lib/permissions";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import plan from "@/lib/restore-plan.json";

const ID = 'backup-2026-10-30';
async function state() {
  if (!env.DB) throw new Error('Database binding unavailable');
  return env.DB.prepare('SELECT cursor, ownerKey, complete FROM RestoreState WHERE id = ?').bind(ID).first<{cursor:number;ownerKey:string|null;complete:number}>();
}
export async function GET() {
  await requireRole("ADMIN");
  const s=await state();
  return Response.json({cursor:s?.cursor??0,total:plan.operations.length,complete:!!s?.complete,report:plan.report});
}
export async function POST() {
  const user = await getChatGPTUser();
  if (!user || !env.DB) return Response.json({error:'Sign in with ChatGPT is required.'},{status:401});
  await env.DB.prepare('INSERT OR IGNORE INTO RestoreState (id, cursor, ownerKey, complete) VALUES (?,0,?,0)').bind(ID,user.userId).run();
  const s=await state();
  if(s?.ownerKey!==user.userId)return Response.json({error:'Owner access required.'},{status:403});
  if(s.complete)return Response.json({cursor:s.cursor,total:plan.operations.length,complete:true});
  const cursor=s.cursor;
  const chunk=plan.operations.slice(cursor,cursor+60);
  const writes=chunk.map(op=>env.DB!.prepare(op.sql).bind(...op.params));
  const next=cursor+chunk.length;
  writes.push(env.DB.prepare('UPDATE RestoreState SET cursor = ?, complete = ? WHERE id = ? AND cursor = ?').bind(next,next>=plan.operations.length?1:0,ID,cursor));
  await env.DB.batch(writes);
  return Response.json({cursor:next,total:plan.operations.length,complete:next>=plan.operations.length});
}
