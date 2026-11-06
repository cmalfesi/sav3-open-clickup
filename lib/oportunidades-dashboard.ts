import type { Actor } from './access-context';
import { dashboardSchema, type DashboardCard } from './dashboard-model';
import { createDashboard } from './dashboard-service';

const LIST_ID = '901328299490';
const NAME = 'Dashboard Oportunidades';
const IDS = {
  id: 'sav3-dashboard-oportunidades',
  viewId: 'sav3-view-dashboard-oportunidades',
};
const LEGACY_FIELD = LIST_ID + '__969266e8-243d-4d3c-bb74-88281ffa2d2a';
const DEAL_FIELD = LIST_ID + '__452ed6a6-dffa-4838-afe0-44fc5db42bb7';

export async function prepareOportunidadesDashboard(db: D1Database, actor: Actor) {
  if (actor.role !== 'OWNER' || actor.kind !== 'native' || !actor.access.visibleList(LIST_ID)) return null;

  if(await db.prepare("SELECT 1 FROM TrashEntity WHERE kind='DASHBOARD' AND entityId=?").bind(IDS.id).first())return null;
  const exists = () => db.prepare('SELECT id FROM Dashboard WHERE id=?').bind(IDS.id).first();
  if (await exists()) return IDS;
  const deleted = await db.prepare("SELECT 1 FROM AccessAudit WHERE action='dashboard.delete' AND targetId=? LIMIT 1")
    .bind(IDS.id).first();
  if (deleted) return null;

  const [statuses, options] = await db.batch([
    db.prepare('SELECT id,name FROM Status WHERE listId=?').bind(LIST_ID),
    db.prepare('SELECT id,customFieldId FROM CustomFieldOption WHERE customFieldId IN (?,?)')
      .bind(LEGACY_FIELD, DEAL_FIELD),
  ]);
  const stageIds = new Map(
    (statuses.results as { id: string; name: string }[]).map(row => [row.name.trim().toLowerCase(), row.id]),
  );
  const stages = (names: string[]) => names.map(name => {
    const id = stageIds.get(name);
    if (!id) throw new Error('Falta el estado de Oportunidades: ' + name);
    return id;
  });
  const contact = ['backlog', 'contacted'];
  const progress = ['discovery + interes inicia', 'oportunidad validada', 'business case', 'propuesta'];
  const hot = ['negotiation'];
  const won = ['won'];
  const lost = ['lost', 'descartado'];
  const pipeline = [...contact, ...progress, ...hot, 'on hold', ...won];
  const statusChart = [...stages([...pipeline, ...lost]), ...(stageIds.has('b2c') ? stages(['b2c']) : [])];

  const kpi = (id: string, title: string, names: string[], slot: number) => ({
    id, title, type: 'kpi', filter: { statuses: stages(names) },
    layout: { x: slot % 3 * 4, y: Math.floor(slot / 3) * 2, w: 4, h: 2 },
  });
  const chart = (
    id: string, title: string, type: DashboardCard['type'], groupBy: string,
    slot: number, filter = {},
  ) => ({
    id, title, type, groupBy, filter,
    layout: { x: slot % 2 * 6, y: 4 + Math.floor(slot / 2) * 5, w: 6, h: 5 },
  });
  const withValue = (fieldId: string) => {
    const values = (options.results as { id: string; customFieldId: string }[])
      .filter(row => row.customFieldId === fieldId).map(row => row.id);
    if (!values.length) throw new Error('Faltan opciones del campo ' + fieldId);
    return { custom: [{ fieldId, values }] };
  };

  const config = dashboardSchema.parse({
    sources: [LIST_ID],
    autoRefresh: true,
    cards: [
      kpi('a-contactar', 'A contactar', contact, 0),
      kpi('en-progreso', 'En progreso', progress, 1),
      kpi('hot', 'HOT', hot, 2),
      kpi('won', 'WON', won, 3),
      kpi('pipeline-total', 'Pipeline Total', pipeline, 4),
      kpi('lost', 'Lost', lost, 5),
      chart('estado', 'Oportunidades por Estado', 'bar', 'status', 0, { statuses: statusChart }),
      chart('persona', 'Tareas por Persona', 'pie', 'assignee', 1),
      chart('estado-legacy', 'Por Estado oportunidad (Legacy)', 'bar', 'custom:' + LEGACY_FIELD, 2, withValue(LEGACY_FIELD)),
      chart('etapa-deal', 'Por Estado del Deal', 'bar', 'custom:' + DEAL_FIELD, 3, withValue(DEAL_FIELD)),
      chart('prioridad', 'Priority Breakdown', 'pie', 'priority', 4, {
        priorities: ['URGENT', 'HIGH', 'NORMAL', 'LOW'],
      }),
      chart('actividad', 'Latest Activity', 'activity', 'status', 5),
    ],
  });

  try {
    await createDashboard(db, actor, NAME, config, LIST_ID, IDS);
  } catch (error) {
    // A concurrent preparation may already have committed the whole dashboard.
    if (!(await exists())) throw error;
  }
  return IDS;
}
