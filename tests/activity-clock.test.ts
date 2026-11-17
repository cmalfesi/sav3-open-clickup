import {describe,it,expect} from 'vitest';
import {activityIdleMs} from '@/lib/activity-clock';
describe('browser inactivity across sleep and clock changes',()=>{
 const stamp={wallMs:100000,monotonicMs:1000};
 it('measures ordinary input age and treats an unseen background tab as idle',()=>{
  expect(activityIdleMs(stamp,160000,61000)).toBe(60000);expect(activityIdleMs(null,100000,1000)).toBe(86400000);
 });
 it('counts sleep even when the monotonic clock barely advanced',()=>{
  expect(activityIdleMs(stamp,stamp.wallMs+4*86400000,1020)).toBe(86400000);
 });
 it('does not turn a backwards system clock into recent activity',()=>{
  expect(activityIdleMs(stamp,1,181001)).toBe(180001);
 });
});
