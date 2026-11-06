import {actor} from '@/lib/access-context';
import {getD1} from '@/lib/db';
import {route} from '@/lib/api-helpers';
import {searchWorkspace} from '@/lib/search-service';
export const GET=route(async(req)=>{const p=new URL(req.url).searchParams;const offset=Math.max(0,Math.min(100000,Math.floor(Number(p.get('offset')))||0));return Response.json(await searchWorkspace(getD1(),actor(),p.get('q')??'',offset,25,p.get('listId')??undefined));});
