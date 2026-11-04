import { expect, it } from "vitest";
import { normalizeTaskSearch, searchTaskRows } from "@/lib/view-task-search";
import { calculateCard, cardSchema, emptyDashboard, type DashboardData, type DashboardTask } from "@/lib/dashboard-model";

it("searches only supplied rows, ignores accents, and preserves matched subtask context", () => {
  const rows = [
    { name: "Oferta", subtasks: [{ name: "Revisión técnica" }, { name: "Otro" }] },
    { name: "Reunión comercial", subtasks: [] },
  ];
  const query = normalizeTaskSearch("  REVISION  ");
  expect(searchTaskRows(rows, query, true)).toEqual([{ name: "Oferta", subtasks: [{ name: "Revisión técnica" }] }]);
  expect(searchTaskRows(rows, query, false)).toEqual([]);
  expect(searchTaskRows(rows, "", true)).toBe(rows);
});

it("intersects dashboard title search with source, dashboard and card filters", () => {
  function task(id: string, name: string, listId = "a", statusId = "active", priority = "HIGH"): DashboardTask {
    return { id, name, listId, parentId: null, statusId, statusName: statusId, statusColor: "#000000",
      statusType: "ACTIVE", priority, createdAt: "2026-01-01", dueDate: null, completedAt: null, archived: 0,
      timeEstimate: null, assignees: [], tags: [], fields: {} };
  }
  const data: DashboardData = { tasks: [
    task("1", "Reunión"), task("2", "Reunión", "b"), task("3", "Reunión", "a", "done"),
    task("4", "Otra"), task("5", "Reunión", "a", "active", "LOW"),
  ], lists: [], statuses: [], members: [], tags: [], fields: [], activities: [], refreshedAt: "" };
  const config = emptyDashboard(["a"]);
  config.filter.statuses = ["active"];
  const card = cardSchema.parse({ id: "k", title: "KPI", type: "kpi", filter: { priorities: ["HIGH"] } });
  const result = calculateCard(config, card, data, normalizeTaskSearch("reunion"));
  expect(result.value).toBe(1);
  expect(result.tasks.map(t => t.id)).toEqual(["1"]);
  expect(calculateCard(config, card, data).value).toBe(2);
});
