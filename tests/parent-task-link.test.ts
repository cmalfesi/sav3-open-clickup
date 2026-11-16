import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
import {ParentTaskLink} from '@/components/task/parent-task-link';

const parent={id:'parent',listId:'list',name:'Reunión de equipo'};
describe('parent task navigation',()=>{
  it('shows a named parent link with a usable URL, including a direct-open fallback',()=>{
    const html=renderToStaticMarkup(createElement(ParentTaskLink,{parentId:'parent',parent}));
    expect(html).toContain('Tarea padre:');expect(html).toContain('Reunión de equipo');
    expect(html).toContain('href="/l/list?task=parent"');expect(html).toContain('aria-label="Volver a la tarea padre: Reunión de equipo"');
  });
  it('does not invent a parent for root tasks or expose an inaccessible parent',()=>{
    expect(renderToStaticMarkup(createElement(ParentTaskLink,{parentId:null,parent:null}))).toBe('');
    const hidden=renderToStaticMarkup(createElement(ParentTaskLink,{parentId:'private-parent',parent:null}));
    expect(hidden).toContain('Tarea padre no disponible');expect(hidden).not.toContain('href=');expect(hidden).not.toContain('private-parent');
  });
  it('opens the parent in the existing card, while allowing modifier clicks to use the link',()=>{
    const navigate=vi.fn(),preventDefault=vi.fn();
    const tree=ParentTaskLink({parentId:parent.id,parent,onOpenTask:navigate})!;
    // Exercise the real link handler without a simulated browser implementation.
    const child=tree.props.children;
    const event={button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,preventDefault};
    child.props.onClick(event);expect(navigate).toHaveBeenCalledWith('parent','list');expect(preventDefault).toHaveBeenCalledOnce();
    navigate.mockClear();preventDefault.mockClear();child.props.onClick({...event,ctrlKey:true});
    expect(navigate).not.toHaveBeenCalled();expect(preventDefault).not.toHaveBeenCalled();
  });
});
