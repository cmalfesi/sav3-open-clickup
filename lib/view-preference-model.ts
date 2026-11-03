import { z } from 'zod';
import type { ViewState } from './view-state';

const ids=z.array(z.string().min(1).max(220)).max(200);
export const personalViewStateSchema=z.object({
 filters:z.object({priorities:z.array(z.enum(['URGENT','HIGH','NORMAL','LOW'])).max(4),assignees:ids,tags:ids}),
 sort:z.object({field:z.enum(['priority','dueDate','name','created']).nullable(),dir:z.enum(['asc','desc'])}),
 groupBy:z.enum(['status','assignee','priority','none']),
});
const flags=z.record(z.string().min(1).max(400),z.boolean());
export const viewPreferenceSchema=z.object({
 viewState:personalViewStateSchema.optional(),collapsedGroups:flags.optional(),expandedTasks:flags.optional(),
 calendar:z.object({mode:z.enum(['month','week']).optional(),cursor:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).optional(),
}).strict();
export type ViewPreference=z.infer<typeof viewPreferenceSchema>;
export const preferencePatchSchema=z.object({
 views:z.record(z.string().min(1).max(200),viewPreferenceSchema).refine(v=>Object.keys(v).length<=30).default({}),
 activeViewId:z.string().min(1).max(200).optional(),
}).strict();
export type PreferencePatch=z.infer<typeof preferencePatchSchema>;
export type ListViewPreferences={activeViewId:string|null;views:Record<string,ViewPreference>};
export function mergePreference(a:ViewPreference={},b:ViewPreference={}):ViewPreference {
 return {...a,...b,
  ...(a.collapsedGroups||b.collapsedGroups?{collapsedGroups:{...a.collapsedGroups,...b.collapsedGroups}}:{}),
  ...(a.expandedTasks||b.expandedTasks?{expandedTasks:{...a.expandedTasks,...b.expandedTasks}}:{}),
  ...(a.calendar||b.calendar?{calendar:{...a.calendar,...b.calendar}}:{}),
 };
}
export function mergePreferencePatch(a:PreferencePatch,b:PreferencePatch):PreferencePatch {
 const views={...a.views};for(const[id,p]of Object.entries(b.views))views[id]=mergePreference(views[id],p);
 return {...a,...b,views};
}
export function applyPreferencePatch(data:ListViewPreferences,patch:PreferencePatch):ListViewPreferences {
 return {activeViewId:patch.activeViewId??data.activeViewId,views:mergePreferencePatch({views:data.views},patch).views};
}
export function viewStateFromConfig(config:unknown):ViewState {
 const c=(config&&typeof config==='object'?config:{}) as Partial<ViewState>;
 const parsed=personalViewStateSchema.safeParse({filters:{priorities:c.filters?.priorities??[],assignees:c.filters?.assignees??[],tags:c.filters?.tags??[]},sort:{field:c.sort?.field??null,dir:c.sort?.dir??'asc'},groupBy:c.groupBy??'status'});
 return parsed.success?parsed.data:{filters:{priorities:[],assignees:[],tags:[]},sort:{field:null,dir:'asc'},groupBy:'status'};
}
