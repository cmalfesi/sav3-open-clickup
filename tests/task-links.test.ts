import {describe,it,expect,vi} from 'vitest';
import {taskPath,taskLink,safeAppReturnTo,copyTaskText} from '@/lib/task-links';
describe('shareable task links',()=>{
 it('builds canonical links for tasks and subtasks without copying current filters or tokens',()=>{
  expect(taskPath('list','subtask')).toBe('/l/list?task=subtask');
  expect(taskLink('https://workspace.test','other list','task&view=private#token')).toBe('https://workspace.test/l/other%20list?task=task%26view%3Dprivate%23token');
 });
 it('keeps a safe task destination through login and excludes external/auth/API destinations',()=>{
  expect(safeAppReturnTo('/l/list?task=subtask&view=table#secret')).toBe('/l/list?task=subtask&view=table');
  for(const unsafe of [undefined,null,['/home'],'https://evil.test','//evil.test','/\\evil.test','/login?return_to=//evil.test','/signin-with-chatgpt','/api/auth/login','/callback','javascript:alert(1)','/l/list\n?task=x','/l/'+'x'.repeat(4096)])expect(safeAppReturnTo(unsafe)).toBe('/home');
 });
 it('reports clipboard success only after a successful write and handles denied/unavailable APIs',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined);
  expect(await copyTaskText('https://workspace.test/l/l?task=t',{writeText})).toBe(true);expect(writeText).toHaveBeenCalledExactlyOnceWith('https://workspace.test/l/l?task=t');
  expect(await copyTaskText('t',{writeText:vi.fn().mockRejectedValue(new Error('Permission denied'))})).toBe(false);
  expect(await copyTaskText('t')).toBe(false);
 });
});
