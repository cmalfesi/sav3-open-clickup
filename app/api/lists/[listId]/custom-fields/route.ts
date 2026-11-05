import { z } from 'zod';
import { actor } from '@/lib/access-context';
import { prisma, getD1 } from '@/lib/db';
import { requireRole } from '@/lib/permissions';
import { ApiError, readJson, route } from '@/lib/api-helpers';
import { fieldSchema } from '@/lib/custom-field-model';
import { saveCustomField } from '@/lib/custom-field-service';

type Ctx = { params: Promise<{ listId: string }> };
const colors = ['#3d8df5', '#2ecd6f', '#ff7800', '#fd71af', '#9b59b6', '#f50000'];
export const POST = route(async (req, { params }: Ctx) => {
  const { listId } = await params;
  await requireRole('MEMBER');
  const input = await readJson(req, z.object({ name: z.string(), type: z.string(), options: z.array(z.string()).max(500).optional() }));
  const parsed = fieldSchema.safeParse({ ...input, locations: [{ type: 'LIST', id: listId }], options: (input.options ?? []).filter(o => o.trim()).map((label, i) => ({ label, color: colors[i % colors.length] })) });
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Campo inválido.");
  const saved = await saveCustomField(getD1(), actor(), parsed.data);
  return Response.json(await prisma.customField.findUnique({ where: { id: saved.id }, include: { options: { orderBy: { position: 'asc' } } } }), { status: 201 });
});
