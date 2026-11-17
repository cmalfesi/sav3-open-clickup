import {createElement,type PointerEvent,type KeyboardEvent} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {describe,it,expect,vi} from 'vitest';
import {taskColumns,columnLayout,columnWidth} from '@/lib/column-widths';
import {columnResizeHandlers} from '@/components/views/resizable-columns';
import {ListView} from '@/components/views/list-view';
import {TableView} from '@/components/views/table-view';
import {PersonalView} from '@/components/views/personal-view';
import {WorkspaceProvider} from '@/components/workspace-context';
import type {Bootstrap} from '@/lib/hooks';
import type {ListData} from '@/lib/queries';
import type {ViewPreference} from '@/lib/view-preference-model';

const fields=[{id:'text',name:'Contacto',type:'TEXT'},{id:'money',name:'Monto',type:'MONEY'},{id:'check',name:'Aprobado',type:'CHECKBOX'}];
const name=taskColumns('LIST',[])[0];
function resize(){
 const drag={current:null} as Parameters<typeof columnResizeHandlers>[3];
 const layout={preview:vi.fn(),commit:vi.fn(),cancel:vi.fn()};
 const target={focus:vi.fn(),setPointerCapture:vi.fn(),releasePointerCapture:vi.fn()};
 const event=(x:number,extra:Record<string,unknown>={})=>({button:0,pointerId:1,clientX:x,currentTarget:target,preventDefault:vi.fn(),stopPropagation:vi.fn(),...extra}) as unknown as PointerEvent<HTMLDivElement>;
 const key=(key:string,shiftKey=false)=>({key,shiftKey,preventDefault:vi.fn(),stopPropagation:vi.fn()}) as unknown as KeyboardEvent<HTMLDivElement>;
 return {handlers:columnResizeHandlers(name,600,layout,drag),layout,target,event,key};
}
describe('column resizing',()=>{
 it('previews mouse/touch-sized deltas immediately and persists once on release, without click propagation',()=>{
  const {handlers:h,layout,target,event}=resize();const down=event(600);
  h.onPointerDown!(down);expect(down.preventDefault).toHaveBeenCalled();expect(down.stopPropagation).toHaveBeenCalled();expect(target.setPointerCapture).toHaveBeenCalledWith(1);
  h.onPointerMove!(event(650));h.onPointerMove!(event(700));expect(layout.preview).toHaveBeenLastCalledWith('name',700);expect(layout.commit).not.toHaveBeenCalled();
  h.onPointerUp!(event(720));h.onLostPointerCapture!(event(720));h.onPointerUp!(event(720));
  expect(layout.commit).toHaveBeenCalledExactlyOnceWith('name',720);expect(layout.cancel).not.toHaveBeenCalled();expect(target.releasePointerCapture).toHaveBeenCalledWith(1);
 });
 it('ignores secondary buttons and other pointers, clamps extremes, and cancels without saving',()=>{
  const {handlers:h,layout,event}=resize();h.onPointerDown!(event(600,{button:2}));h.onPointerMove!(event(800));expect(layout.preview).not.toHaveBeenCalled();
  h.onPointerDown!(event(600));h.onPointerMove!(event(800,{pointerId:2}));expect(layout.preview).not.toHaveBeenCalled();
  h.onPointerMove!(event(-1000));expect(layout.preview).toHaveBeenLastCalledWith('name',240);
  h.onPointerMove!(event(9000));expect(layout.preview).toHaveBeenLastCalledWith('name',1600);
  h.onPointerCancel!(event(9000));h.onPointerUp!(event(9000));expect(layout.commit).not.toHaveBeenCalled();expect(layout.cancel).toHaveBeenCalledOnce();
 });
 it('supports keyboard steps, reset and Escape cancellation during a drag',()=>{
  const {handlers:h,layout,event,key}=resize();h.onKeyDown!(key('ArrowLeft'));expect(layout.commit).toHaveBeenLastCalledWith('name',590);
  h.onKeyDown!(key('ArrowRight',true));expect(layout.commit).toHaveBeenLastCalledWith('name',650);
  h.onKeyDown!(key('Home'));expect(layout.commit).toHaveBeenLastCalledWith('name',600);
  layout.commit.mockClear();h.onPointerDown!(event(600));h.onPointerMove!(event(900));h.onKeyDown!(key('Escape'));h.onPointerUp!(event(900));expect(layout.commit).not.toHaveBeenCalled();expect(layout.cancel).toHaveBeenCalledOnce();
 });
 it('keeps widths attached to field identity across rename/reordering and uses data-type defaults',()=>{
  const columns=taskColumns('LIST',fields);expect(columns.map(c=>c.width)).toEqual([600,130,130,110,240,150,80]);
  const widths={'field:text':310,'field:money':200,name:500};
  const reordered=taskColumns('TABLE',[fields[1],{...fields[0],name:'Otro nombre'},fields[2]]);
  expect(columnLayout(reordered,widths).template).toBe('500px 160px 130px 110px 130px 130px 200px 310px 80px 44px');
  expect(columnWidth(name,NaN)).toBe(600);expect(columnWidth(name,10)).toBe(240);
 });
});

const status={id:'open',listId:'l',name:'Open',type:'NOT_STARTED',color:'#87909e',position:0,wipLimit:null};
const title='Título muy extenso '.repeat(100);
const task={id:'parent',listId:'l',parentId:null,name:title,statusId:'open',status,assignees:[],tags:[],priority:null,dueDate:null,startDate:null,customFieldValues:[],subtasks:[{id:'child',name:title,status,assignees:[]}],_count:{subtasks:1,comments:0,checklists:0}};
function markup(view:'LIST'|'TABLE',state:ViewPreference={}){
 const client=new QueryClient();
 const workspace={currentUser:{id:'u',name:'User'},workspace:{members:[]},authorization:{role:'MEMBER',admin:false}} as unknown as Bootstrap;
 const data={list:{id:'l',statuses:[status],customFields:[],views:[]},tasks:[task],dependencies:[]} as unknown as ListData;
 const child=view==='LIST'?createElement(ListView,{data,onOpenTask:()=>{},sorting:true}):createElement(TableView,{data,onOpenTask:()=>{}});
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},WorkspaceProvider({data:workspace,children:PersonalView({state:{expandedTasks:{parent:true},...state},groupBy:'status',update:()=>{},children:child})})));
 client.clear();return html;
}
describe('task column rendering',()=>{
 it.each(['LIST','TABLE'] as const)('%s applies the same fixed widths to headers, tasks and children despite long titles',view=>{
  const html=markup(view,{columnWidths:{name:450,assignee:200}});
  const tracks=[...html.matchAll(/grid-template-columns:([^";]+)/g)].map(m=>m[1]);
  expect(tracks.length).toBe(view==='LIST'?3:2);expect(new Set(tracks).size).toBe(1);
  expect(tracks[0]).toMatch(/^450px /);expect(tracks[0]).not.toContain('fr');expect(html).toContain('title="'+title+'"');
  expect(html).toContain('aria-label="Ajustar ancho de Name"');expect(html).toContain('aria-valuenow="450"');expect(html).toContain('aria-orientation="vertical"');
 });
});
