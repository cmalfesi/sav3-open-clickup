/** Wall time counts sleep; monotonic time prevents a clock rollback appearing as input. */
export type ActivityStamp={wallMs:number;monotonicMs:number};
export function activityIdleMs(last:ActivityStamp|null,wallNow:number,monotonicNow:number):number{
 if(!last)return 86400000;
 return Math.min(86400000,Math.max(0,Math.floor(Math.max(wallNow-last.wallMs,monotonicNow-last.monotonicMs))));
}
