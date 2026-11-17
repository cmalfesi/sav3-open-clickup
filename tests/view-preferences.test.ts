import{describe,it,expect}from'vitest';
import{ViewPreferenceQueue}from'@/lib/view-preference-queue';
import{mergePreferencePatch,viewStateFromConfig,preferencePatchSchema,type PreferencePatch}from'@/lib/view-preference-model';
describe('personal view state',()=>{
 it('coalesces widths by column without dropping other widths or presentation state',()=>{
  const merged=mergePreferencePatch({views:{v:{columnWidths:{name:450,assignee:120},collapsedGroups:{backlog:true}}}},{views:{v:{columnWidths:{name:600,'field:deal':200}}}});
  expect(merged.views.v).toEqual({columnWidths:{name:600,assignee:120,'field:deal':200},collapsedGroups:{backlog:true}});
  for(const width of [-1,63,1601,Infinity,1.5,'600',null])expect(preferencePatchSchema.safeParse({views:{v:{columnWidths:{name:width}}}}).success).toBe(false);
 });
 it('merges toggles without clearing other groups, preserves explicit expansion and seeds legacy settings',()=>{const merged=mergePreferencePatch({views:{v:{collapsedGroups:{'status:backlog':true},expandedTasks:{parent:true}}}},{views:{v:{collapsedGroups:{'status:backlog':false,'priority:HIGH':true}}}});expect(merged.views.v).toEqual({collapsedGroups:{'status:backlog':false,'priority:HIGH':true},expandedTasks:{parent:true}});expect(viewStateFromConfig({groupBy:'priority'}).groupBy).toBe('priority');expect(preferencePatchSchema.safeParse({userId:'someone',views:{}}).success).toBe(false);});
 it('serializes rapid writes across views and journals the latest state until acknowledged',async()=>{
  const sent:PreferencePatch[]=[],journals:PreferencePatch[]=[];let release:()=>void=()=>{};
  const q=new ViewPreferenceQueue({views:{}},async p=>{sent.push(p);if(sent.length===1)await new Promise<void>(r=>release=r);},p=>journals.push(p));
  q.enqueue({views:{a:{collapsedGroups:{'status:backlog':true}}}});await Promise.resolve();
  q.enqueue({views:{a:{collapsedGroups:{'status:backlog':false}},b:{calendar:{mode:'week'}}},activeViewId:'b'});
  expect(sent).toHaveLength(1);expect(journals.at(-1)!.views.a.collapsedGroups!['status:backlog']).toBe(false);
  release();await q.flush();expect(sent).toHaveLength(2);expect(sent[1].views.a.collapsedGroups!['status:backlog']).toBe(false);expect(sent[1].views.b.calendar!.mode).toBe('week');expect(q.getSnapshot().unsaved).toEqual({views:{}});
 });
 it('keeps failed writes and can retry without losing a subsequent change',async()=>{let fail=true;const q=new ViewPreferenceQueue({views:{}},async()=>{if(fail)throw new Error('offline');},()=>{});q.enqueue({views:{a:{collapsedGroups:{backlog:true}}}});await q.flush();expect(q.getSnapshot().error).toBe('offline');expect(q.getSnapshot().unsaved.views.a.collapsedGroups!.backlog).toBe(true);fail=false;q.enqueue({views:{a:{expandedTasks:{parent:true}}}});await q.flush();expect(q.getSnapshot().error).toBe('');expect(q.getSnapshot().unsaved).toEqual({views:{}});});
});
