/* For recorder-based export, follow wall-clock time instead of capped animation deltas. */
export function advanceTimeline({current,lastTimestamp,timestamp,anchor,recording,duration}){
  const end=Math.max(0,Number(duration)||0);
  if(recording&&Number.isFinite(anchor))return Math.min(end,Math.max(0,(timestamp-anchor)/1000));
  const dt=Math.max(0,Math.min(.12,(timestamp-(lastTimestamp||timestamp))/1000));
  return Math.min(end,Math.max(0,current+dt));
}
