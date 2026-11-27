import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {tagAppearance} from '@/lib/tag-appearance';
import {TaskTagSummary} from '@/components/views/task-tag-summary';
import {TagChip} from '@/components/ui/primitives';
import type {TaskWithRelations} from '@/lib/queries';
const names=['flex-operator-wallet','pipeline','sav3','tier-a','ultima-milla-flex'];
function tags(count:number){return names.slice(0,count).map((name,i)=>({tagId:String(i),tag:{id:String(i),name,color:'#656f7d'}})) as TaskWithRelations['tags'];}
describe('compact task tags',()=>{
 it('keeps configured colors and chooses a legible foreground for light/dark fills',()=>{
   expect(tagAppearance('Configured','#8a2be2')).toEqual({backgroundColor:'#8a2be2',color:'#ffffff'});
   expect(tagAppearance('Light','#fff')).toEqual({backgroundColor:'#ffffff',color:'#000000'});
   expect(tagAppearance('Dark','#000000')).toEqual({backgroundColor:'#000000',color:'#ffffff'});
 });
 it('uses stable colors for imported placeholders without changing the tag data',()=>{
   const source=tags(5),before=JSON.stringify(source),colors=source.map(t=>tagAppearance(t.tag.name,t.tag.color));
   expect(new Set(colors.map(c=>c.backgroundColor)).size).toBeGreaterThan(1);
   expect(tagAppearance(' PIPELINE ','#656F7D')).toEqual(tagAppearance('pipeline','#656f7d'));
   expect(JSON.stringify(source)).toBe(before);
   for(const c of colors){expect(c.backgroundColor).toMatch(/^#[0-9a-f]{6}$/);expect(c.backgroundColor).not.toBe('#656f7d');}
 });
 it('provides accessible contrast for every generated color and handles invalid colors safely',()=>{
   for(let i=0;i<100;i++){
     const result=tagAppearance(String(i),'invalid');
     const rgb=[1,3,5].map(n=>parseInt(result.backgroundColor.slice(n,n+2),16)/255).map(c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4);
     const l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
     const contrast=result.color==='#ffffff'?1.05/(l+.05):(l+.05)/.05;
     expect(contrast).toBeGreaterThanOrEqual(4.5);
   }
 });
 it('renders only two preview chips and counts all remaining tags, with full names discoverable',()=>{
   const html=renderToStaticMarkup(createElement(TaskTagSummary,{tags:tags(5)}));
   expect(html).toContain('>+3<');expect(html).toContain('Ver las 5 etiquetas de la tarea');
   expect(html).toContain('title="flex-operator-wallet"');expect(html).toContain('title="pipeline"');
   expect((html.match(/style=/g)||[]).length).toBe(2);
   expect(html).toContain('sav3\ntier-a\nultima-milla-flex');
 });
 it('does not invent an overflow count for empty, one or two tags',()=>{
   expect(renderToStaticMarkup(createElement(TaskTagSummary,{tags:[]}))).toBe('');
   for(const count of [1,2])expect(renderToStaticMarkup(createElement(TaskTagSummary,{tags:tags(count)}))).not.toMatch(/>\+\d+</);
 });
 it('escapes user-controlled names in chips while retaining the full label',()=>{
   const html=renderToStaticMarkup(createElement(TagChip,{name:'A <script> & "quote"',color:'#ff9800'}));
   expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain('title="A &lt;script&gt; &amp; &quot;quote&quot;"');
 });
});
