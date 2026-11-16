import {NextResponse} from 'next/server';
import {requireUser} from '@/lib/auth';
import {route} from '@/lib/api-helpers';
import {checklistAssignees} from '@/lib/checklists';
export const GET=route(async(_req,{params}:{params:Promise<{taskId:string}>})=>{
 await requireUser();return NextResponse.json(await checklistAssignees((await params).taskId));
});
