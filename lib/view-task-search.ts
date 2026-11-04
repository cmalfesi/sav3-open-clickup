export function normalizeTaskSearch(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function matchesTaskTitle(name: string, query: string) {
  return normalizeTaskSearch(name).includes(query);
}

export function searchTaskRows<T extends { name: string; subtasks: { name: string }[] }>(
  tasks: T[], query: string, includeSubtasks: boolean,
): T[] {
  if (!query) return tasks;
  return tasks.flatMap(task => {
    const matched = matchesTaskTitle(task.name, query);
    if (!includeSubtasks) return matched ? [task] : [];
    const subtasks = task.subtasks.filter(subtask => matchesTaskTitle(subtask.name, query));
    return matched || subtasks.length ? [{ ...task, subtasks }] : [];
  });
}
