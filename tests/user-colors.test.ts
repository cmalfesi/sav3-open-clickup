import {describe,it,expect} from 'vitest';
import {userColors,availableUserColor} from '@/lib/user-colors';
describe('persistent user colors',()=>{
 it('keeps allocating distinct backgrounds after exhausting the base palette',()=>{
  const used:string[]=[];
  for(let i=0;i<400;i++){const color=availableUserColor(used);expect(used).not.toContain(color);used.push(color);}
  expect(used.slice(0,userColors.length)).toEqual(userColors);
 });
});
