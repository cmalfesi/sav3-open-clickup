import type { CSSProperties } from 'react';
import type { DashboardCard, DashboardFilter } from './dashboard-model';

export function filterCount(filter: DashboardFilter) {
 return [filter.statuses.length, filter.priorities.length, filter.assignees.length, filter.tags.length,
  ...filter.custom.map(c=>c.values.length), filter.dateFrom || filter.dateTo, !filter.includeSubtasks, filter.includeArchived].filter(Boolean).length;
}

// Keep chosen surfaces readable in both themes. A null background inherits the theme.
export function cardSurfaceStyle(background: DashboardCard['background']): CSSProperties {
 if (!background) return {};
 const rgb=background.slice(1).match(/../g)!.map(c=>parseInt(c,16));
 const linear=rgb.map(c=>{const s=c/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});
 const luminance=linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
 const foreground=luminance>0.179?'#000000':'#ffffff';
 return {
  backgroundColor:background,color:foreground,
  '--cu-panel':background,'--cu-text':foreground,'--cu-text-secondary':foreground,
  '--cu-text-tertiary':foreground,'--cu-purple':foreground,'--cu-purple-dark':foreground,
  '--cu-border':`color-mix(in srgb, ${foreground} 25%, ${background})`,
  '--cu-hover':`color-mix(in srgb, ${foreground} 8%, ${background})`,
 } as CSSProperties;
}

export function duplicateCard(card: DashboardCard, cards: DashboardCard[], id: string): DashboardCard {
 // Copy nested filters too, so editing the copy cannot affect the original.
 return {...structuredClone(card),id,title:(card.title.slice(0,112)+' (copia)'),
  layout:{...card.layout,x:0,y:cards.reduce((end,c)=>Math.max(end,c.layout.y+c.layout.h),0)}};
}
