import { z } from 'zod';
import { actor } from '@/lib/access-context';
import { getD1 } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { readJson, route } from '@/lib/api-helpers';
import { saveCustomFieldValue } from '@/lib/custom-field-service';

type Ctx = { params: Promise<{ taskId: string; fieldId: string }> };
export const PUT = route(async (req, { params }: Ctx) => {
  const { taskId, fieldId } = await params;
  await requireRole('MEMBER');
  const { value } = await readJson(req, z.object({ value: z.unknown() }));
  return Response.json(await saveCustomFieldValue(getD1(), actor(), taskId, fieldId, value));
});
