# Task editing feedback, checklist assignment and nested deletion

Date: 2026-11-16
Release: 0.12.5

## Problem

Checklist writes used direct API calls without pending state. Repeated clicks created multiple checklists; each accepted change reloaded both task detail and list. The shell's React Query pending label was hidden behind task dialogs and missed direct API writes. Nested child tasks had no delete action in their parent dialog. Imported assignees often shared one avatar color.

## Decisions

- Persist distinct avatar backgrounds on `User.color`, with a one-time deterministic allocation for existing users and allocation from unused colors on invitation creation. Names/initials and existing uploaded photos remain the identity labels; color is supplemental. No profile, role or authentication data is reset. User-selected profile colors can still override the assigned background.
- Add nullable `ChecklistItem.assigneeId` with a User foreign key and `ON DELETE SET NULL`. One responsible user per item, including explicit unassignment. Only enabled workspace members with task read access can be selected. Assignment does not grant access. Existing assigned notification preferences and Inbox apply.
- Keep task detail as the checklist cache source of truth. Optimistically add/edit/remove checklist rows, replace temporary identities with the server response, and roll back rejected writes. Cancel an outstanding task read before editing, preserve unrelated task properties, and do not refetch task/list after each checklist write. Mark detail stale without immediate fetch; the next opening retrieves activity and concurrent server state.
- Serialize checklist writes within the mounted editor with an immediate ref guard; disable destructive/assignment controls during the write. Checklist/new subtask/comment/list task composers retain input until acceptance, and preserve it after failure. Pending temporary checklists cannot accept an item before they have a real ID.
- `apiSend` reports foreground writes to a browser-local external store. A fixed status above dialogs shows saving, a slower-request message after eight seconds, success, or a persistent dismissible error. React Query mutations additionally cover multipart uploads. Background presence is excluded. No fabricated percentage, automatic reload, or automatic retry of an uncertain POST.
- Coalesce identical concurrent POST/DELETE API calls into one in-flight promise. This is duplicate-click protection within one browser, not durable idempotency across reloads, devices, connection failures or sequential user actions. PATCH/PUT are not coalesced, so A → B → A remains three distinct edits. Existing server API idempotency remains available to API clients.
- Add a separate, keyboard-accessible delete button at the end of each subtask row at any depth. Use the existing trash route and descendant authorization, optimistic removal and rollback. Already-trashed descendants stay in their original restore batch when a parent is later trashed.

## Performance and limits

An individual checklist change no longer triggers the extra full task and list GETs. Its local row appears/changes before the write responds and stays visible while pending. This reduces requests and perceived latency; it does not establish a production network/server latency percentile. Permissions remain freshly evaluated per request. No broad authorization cache or deferred durable writes were introduced.

The common API status covers JSON mutations; React Query covers multipart task/profile uploads. Existing branding forms retain their own pending feedback. Network failure can leave an accepted server write uncertain, so the message asks users to inspect content before resubmitting rather than promise exactly-once delivery.

## Verification

Isolated D1 tests cover assignment persistence, eligibility, invalid/disabled users, unassignment, read-only rejection, and existing user color migration. Delayed-promise tests cover duplicate in-flight creates, independent edits, failure status, optimistic checklist rows/rollback, and absence of task/list refetch. The compiled Worker smoke covers actual route serialization, assignment notifications, anonymous/guest denial, nested child trash and parent deletion after a child was already trashed.

Managed preview currently serves HTML without CSS/client JavaScript. Browser interaction, keyboard, touch, mobile and visual validation of the changed task controls remain pending; do not claim they were performed. Production is unchanged until the requested deployment notice/review.
