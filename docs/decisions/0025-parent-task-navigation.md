# Navigate from a subtask to its parent

Date: 2026-11-16
Release: 0.12.6

Task detail now projects the immediate parent as `{id,name,listId}`. The server removes that projection when the current actor cannot read the parent; direct child sharing must not expose the parent's title. Root tasks return `parent: null`. A subtask with an inaccessible/deleted parent shows a neutral unavailable label without a link.

The task card places a persistent parent link below its header. Normal activation reuses the open card; the real URL also supports direct navigation and modifier/new-tab clicks. At any nesting depth, each parent has its own upward link. The main task body is keyed by task ID so cached parent/child navigation cannot reuse the previous task's local title or editor state.

Dashboard task navigation now stores an ID and list ID, rather than requiring the destination to exist in the current report result. Filters limit the chart/result, not navigation to an otherwise authorized relative. Detail requests still enforce existing task ACLs; this adds no permissions or hierarchy mutations.

Verification: parent/root projections and child-only access in isolated D1; real compiled Worker response at nested depth; parent link rendering, destination, unavailable state and normal/modifier activation. Browser visual, keyboard and mobile QA remains pending because the managed preview served HTML without styles/client scripts on the previous attempt.

List rows also indent child status icons to the parent's title start, accounting for the optional drag-handle slot while preserving the other grid columns. Each expanded child group ends with a purple **Add Subtask** row. It reuses the guarded inline composer, supplies the actual `parentId` and the parent's status, and keeps the independent group-level **Add Task** action for root tasks. The row menu can start the first subtask for a task without children. Guest users do not see the new create controls. No existing task is moved or reparented by this UI change.
