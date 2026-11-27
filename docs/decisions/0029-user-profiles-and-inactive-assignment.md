# User profiles and inactive assignment directory

Status: Accepted (2026-11-27). Implementation prepared in 0.12.8; production
publication requires the user's later authorization.

User identity, workspace membership, authorization and assignment are separate.
A user may belong to the team and receive work with AccountAccess.enabled=0.
Password login, native linked identity, sessions and integration tokens still
require enabled access. Assignment never creates credentials, resource grants,
sessions or notifications for disabled recipients.

Keep the existing single User.name field, labelled “Nombre y apellido”. Do not
infer surname boundaries or introduce an unnecessary profile schema change.
PATCH /api/team/users accepts partial profile/access updates. Changing only the
name preserves grants, invitations and sessions. Permission edits preserve the
existing enabled flag unless explicitly revoked, and cannot enable a disabled
account: activation requires a valid invitation. Owner/self roles and admin
hierarchy remain protected; protected accounts can edit their own display name.
Only OWNER can appoint or manage another ADMIN.

The new POST creates a named workspace member without credentials, invitation or
email. Inviting a person also stages disabled membership immediately, reusing
existing identity and assignments. Pending invitation policy remains a snapshot:
permission changes revoke unaccepted links rather than leaving a stale privilege
snapshot valid. Profile/no-op edits keep them valid. Migration 0013 backfills
valid legacy invitations idempotently, preserving existing membership/access.
Imported references without membership join explicitly through Editar usuario;
they are never silently duplicated or activated.

Workspace members are included in assignment selectors even while disabled,
with loginEnabled metadata and a “Sin acceso” hint. Checklist candidates allow
inactive workspace members for planning, while active candidates retain the
existing task-read requirement. Automation assignment targets use workspace
membership; automation executors and notification recipients still require an
active authorized identity. Existing task, subtask, bulk, template and people
selectors retain their normal assignment model. No new assignable entity type
is introduced.

The administration form locks duplicate submissions and invalidates directory,
list, task and checklist-candidate caches. Profile changes affect the account
revision so an active user's own profile refreshes through the existing presence
monitor without logging out.

Validation: 224 tests across 38 files, typecheck, production build and isolated
compiled Worker routes. Tests cover manual creation, invitations/activation,
partial edits, role hierarchy, no accidental enablement, legacy backfill,
inactive directory/checklist/automation assignments and notification exclusion.
Browser visual/mobile/touch/focus QA is pending: the managed preview renders an
unstyled login page and does not provide a usable administration session.
