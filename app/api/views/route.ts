import {z} from 'zod';
import {getD1} from '@/lib/db';
import {actor} from '@/lib/access-context';
import {requireRole} from '@/lib/permissions';
import {readJson,route} from '@/lib/api-helpers';
import {createListView} from '@/lib/list-view-service';
import {personalViewStateSchema} from '@/lib/view-preference-model';
export const POST=route(async(req)=>{await requireRole('MEMBER');const input=await readJson(req,z.object({listId:z.string().min(1),name:z.string().trim().min(1).max(100),type:z.enum(['LIST','TABLE','BOARD','CALENDAR','GANTT']),config:personalViewStateSchema.optional(),duplicateId:z.string().optional()}));return Response.json(await createListView(getD1(),actor(),input));});
