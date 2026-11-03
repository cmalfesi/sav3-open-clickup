# Personal presentation preferences

Previously filter/sort/group changes patched shared View.config while collapsed groups and expanded tasks were component-local. Store presentation in UserViewPreference(userId, viewId) and the last active tab in UserListPreference(userId, listId). Authorize the current session against the list and view on every read/write; never accept a target user ID from the client. Guests may change their own presentation; this is not a content edit and grants no resource permissions. Integration tokens cannot manage these preferences.

Use the legacy shared config as an initial fallback, with validation/defaults. Explicit view URLs take priority over the user's last selected tab. Group keys include the current grouping dimension to separate status/assignee/priority collapse states. Remount view content when switching tabs so selections, pagination and transient editors do not leak between views. Calendar position uses a local calendar date, avoiding UTC shifts. Dashboard document configuration remains shared and explicitly saved.

PATCH merges preference JSON atomically in D1; individual group and task changes preserve unrelated keys. The client serializes/coalesces writes, sends keepalive requests and journals unacknowledged changes under a user/list-specific browser key. A failed write remains pending for automatic/explicit retry; obsolete saved view IDs are pruned after a current server read. Server-confirmed values live in D1, not only local storage. Existing shared View.config is never overwritten by personal autosave.

When a sort is active, List/Board preserve the resulting task order instead of immediately re-sorting it by manual task position. List drag-to-reorder remains available when no explicit sort is active.
