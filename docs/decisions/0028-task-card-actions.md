# Task card actions and safe share links

The task's Expand button had no handler. Add an in-place modal/full-area toggle;
keep the task content mounted so changing size cannot discard editor drafts.
Escape restores the centered window before the next Escape closes it. This is
an application layout toggle, not the browser Fullscreen API.

Centralize task URLs in `lib/task-links.ts`: copy `/l/<list>?task=<id>` using the
task's actual List, never `window.location.href`. Links work independently of a
dashboard's filters and support subtasks. Native new-tab links retain modifier
clicks. Clipboard failures use a selectable-text dialog instead of a false
success toast or deprecated clipboard API fallback.

Shared links must survive login. The Worker includes a validated relative
`return_to`; password login and the owner ChatGPT sign-in retain it. Only known
app routes can be return destinations. External, protocol-relative, control
character and auth/API targets fall back to Home. Authentication and resource
authorization remain mandatory; no public task access or permission mutation is
introduced.

Expand the existing task menu by reusing existing reminders, dependencies,
Custom Field Manager, duplicate/move/template services, archive and recoverable
trash. Calculate `menuPermissions` in the detail response, including List-level
rights, administrative template access and descendant edit checks. Server
authorization remains authoritative on every mutation, including stale UI state.
Do not offer moves of deep task trees because the current endpoint only migrates
direct children. The evaluation records this limitation rather than presenting
full ClickUp parity. No schema migration or new dependency is needed.

Menu actions opening another focus scope run after menu close autofocus, so the
menu cannot steal focus from a dialog, reminder or section. Mutation confirmations
retain errors and block duplicate submission. Read-only users can copy links and
consult fields/dependencies without receiving write commands.

The detailed feature audit and next-stage recommendations are in
`docs/product/task-card-menu-evaluation.md`. Do not add placeholder menu commands
for features that do not work. Preserve the pending session and column changes
in 0.12.7 / draft PR #24; no production deployment is requested.

Validation includes unit/event, D1 and compiled Worker tests. The managed preview
currently serves unstyled SSR HTML; visual, mobile, touch and browser keyboard/focus
QA remains pending and must be reported honestly.
