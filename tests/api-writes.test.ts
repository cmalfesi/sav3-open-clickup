import {afterEach,describe,expect,it,vi} from 'vitest';
import {apiSend} from '@/lib/api';
import {writeSnapshot,dismissWriteError} from '@/lib/write-status';
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
afterEach(()=>{vi.unstubAllGlobals();dismissWriteError();});
describe('write feedback and repeated submissions',()=>{
 it('coalesces identical pending creates but allows the next intentional create',async()=>{
  const response=deferred<Response>(),fetcher=vi.fn().mockReturnValueOnce(response.promise).mockResolvedValueOnce(Response.json({id:'second'}));vi.stubGlobal('fetch',fetcher);
  const a=apiSend('/api/tasks/t/checklists','POST',{}),b=apiSend('/api/tasks/t/checklists','POST',{});
  expect(a).toBe(b);expect(fetcher).toHaveBeenCalledTimes(1);expect(writeSnapshot().pending).toBe(1);
  response.resolve(Response.json({id:'first'}));expect(await a).toEqual({id:'first'});expect(await b).toEqual({id:'first'});expect(writeSnapshot().pending).toBe(0);
  expect(await apiSend('/api/tasks/t/checklists','POST',{})).toEqual({id:'second'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('preserves distinct edits and keeps status busy until every write settles',async()=>{
  const responses=[deferred<Response>(),deferred<Response>(),deferred<Response>()];let index=0;const fetcher=vi.fn(()=>responses[index++].promise);vi.stubGlobal('fetch',fetcher);
  const a=apiSend('/api/tasks/t','PATCH',{name:'A'}),b=apiSend('/api/tasks/t','PATCH',{name:'B'}),c=apiSend('/api/tasks/t','PATCH',{name:'A'});
  expect(fetcher).toHaveBeenCalledTimes(3);expect(writeSnapshot().pending).toBe(3);
  responses[0].resolve(Response.json({ok:true}));await a;expect(writeSnapshot().pending).toBe(2);
  responses[1].resolve(Response.json({ok:true}));responses[2].resolve(Response.json({ok:true}));await Promise.all([b,c]);expect(writeSnapshot().pending).toBe(0);
 });
 it('keeps failures visible, releases the pending guard and never retries an uncertain create',async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(Response.json({id:'checked-and-retried'}));vi.stubGlobal('fetch',fetcher);
  await expect(apiSend('/api/tasks','POST',{name:'Test'})).rejects.toThrow('resultado no está confirmado');
  expect(fetcher).toHaveBeenCalledTimes(1);expect(writeSnapshot().pending).toBe(0);expect(writeSnapshot().error).toContain('verificá el contenido');
  await apiSend('/api/tasks','POST',{name:'Test'});expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('does not show background presence as a save',async()=>{
  const response=deferred<Response>();vi.stubGlobal('fetch',vi.fn(()=>response.promise));
  const p=apiSend('/api/presence','POST',{});expect(writeSnapshot().pending).toBe(0);response.resolve(Response.json({ok:true}));await p;
 });
});
