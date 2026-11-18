import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect,vi} from 'vitest';
import {TaskExpandButton,taskWindowClass} from '@/components/task/task-window';
describe('task window expansion',()=>{
 it('connects expand and restore to the toggle with accessible state',()=>{
  const onToggle=vi.fn(),normal=TaskExpandButton({expanded:false,onToggle}),expanded=TaskExpandButton({expanded:true,onToggle});
  normal.props.onClick();expanded.props.onClick();expect(onToggle).toHaveBeenCalledTimes(2);
  expect(renderToStaticMarkup(normal)).toContain('aria-label="Ampliar tarea"');expect(renderToStaticMarkup(normal)).toContain('aria-pressed="false"');
  expect(renderToStaticMarkup(expanded)).toContain('aria-label="Restaurar tamaño de la tarea"');expect(renderToStaticMarkup(expanded)).toContain('aria-pressed="true"');
 });
 it('uses distinct full viewport and centered layouts',()=>{
  expect(taskWindowClass(true)).toContain('inset-0 h-[100dvh] w-full');expect(taskWindowClass(true)).not.toContain('translate');
  expect(taskWindowClass(false)).toContain('h-[88dvh]');expect(taskWindowClass(false)).toContain('-translate-x-1/2');
 });
});
