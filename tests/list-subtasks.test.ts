import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,it,expect,vi} from 'vitest';
import {WorkspaceProvider} from '@/components/workspace-context';
import {ListView} from '@/components/views/list-view';
import type {Bootstrap} from '@/lib/hooks';
import type {ListData} from '@/lib/queries';
vi.mock('@/components/views/personal-view',()=>({useGroupCollapsed:()=>[false,()=>{}],useTaskExpanded:()=>[true,()=>{}],useColumnWidths:()=>({widths:{},setWidth:()=>{}})}));
const status={id:'open',listId:'l',name:'Open',type:'NOT_STARTED',color:'#87909e',position:0,wipLimit:null};
const sub={id:'child',listId:'l',parentId:'parent',name:'Child meeting',statusId:'open',status,assignees:[]};
const task={id:'parent',listId:'l',parentId:null,name:'Weekly meeting',statusId:'open',status,assignees:[],tags:[],priority:null,dueDate:null,customFieldValues:[],subtasks:[sub],_count:{subtasks:1,comments:0,checklists:0}};
function render(role:'MEMBER'|'GUEST'){
 const client=new QueryClient();
 const workspace={currentUser:{id:'u',name:'User'},workspace:{members:[]},authorization:{role,admin:false}} as unknown as Bootstrap;
 const data={list:{id:'l',statuses:[status],customFields:[],views:[]},tasks:[task],dependencies:[]} as unknown as ListData;
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},WorkspaceProvider({data:workspace,children:createElement(ListView,{data,onOpenTask:()=>{},sorting:true})})));
 client.clear();return html;
}
describe('expanded subtask list',()=>{
 it('places Add Subtask after the child rows, distinct from the root Add Task action',()=>{
  const html=render('MEMBER');
  expect(html).toContain('Child meeting');expect(html).toContain('Add Subtask');expect(html).toContain('Add Task');
  expect(html.indexOf('aria-label="Add Subtask"')).toBeGreaterThan(html.indexOf('Child meeting'));
 });
 it('does not expose the new subtask composer to read-only guests',()=>{
  const html=render('GUEST');expect(html).toContain('Child meeting');expect(html).not.toContain('Add Subtask');
 });
});
