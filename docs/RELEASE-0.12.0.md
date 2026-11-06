# SAV3 Open ClickUp 0.12.0

Date: 2026-11-05. Rechecked against published app 0.11.1 / Sites 21.

## Existing capabilities preserved

The Custom Field Manager, Space/List inheritance, editable dropdown options, invitations and chosen passwords, role/resource access, Inbox mentions, change notices, configurable dashboards, the Opportunities dashboard, view deletion, clickable URLs, branding and personal view persistence were already implemented. They were not missing modules.

## Completed workflows

| Area | Delivered behavior |
| --- | --- |
| Fields | Typed defaults for new tasks, required fields for native status transitions, calculated arithmetic fields, admin-only and per-person read/edit permissions, loss-checked type conversion and merge previews with revisions. Field permissions never grant task access. Existing incomplete tasks remain editable; required values are checked before a status transition. |
| Views | Create List, Table, Board, Calendar, Gantt and Dashboard views; duplicate normal views; rename and save a shared starting configuration. Personal overrides remain independent. Actions share one context menu. |
| Filtering | Native statuses, due-date range, missing due dates, typed custom conditions, custom grouping and responsible selection. Filters within a criterion use OR; separate criteria use AND. |
| Search | Titles, descriptions and visible field content, accent-insensitive matching and pagination after access checks. |
| Bulk | Status, priority, responsibility, tags through API, due date, archive and custom field edits. Results report per-task failures. Deletion uses the trash. |
| Templates | Task templates include assignees, fields, relative dates, estimates and immediate subtasks. Admins can capture and apply Space/List structure, workflows, normal views and shared field placements. Structure templates intentionally start without operational tasks. |
| Trash | Tasks and descendants, or dashboards and their definitions, can be recovered. Dashboard deletion hides its list tabs and preserves configuration and grants for restoration. Permanent purging is not enabled. |
| Recovery | Consistent D1 snapshot; streamed download with attachments, workspace logos and local avatars; per-table/file SHA-256 checksums; local file validation; restore into an empty isolated database and bucket. Credentials and sessions are excluded. Restored accounts, reminders, automations and email schedules stay disabled. |
| Audit | Admin search, pagination and CSV over administrative events and task activity. |
| Follow-up | Personal task reminders, Inbox snooze, a reminder center and a rules editor. Status, overdue and inactivity conditions support notifying assignees, adding an assignee or changing status. Simulation, deduplication, current permission checks and bounded retries are recorded. |
| Historical reporting | Native status and dropdown histories with explicit initial coverage; completed-interval medians, open intervals and cohort entry/arrival calculations. Initial imported points have unknown prior duration. No pre-backup history is fabricated. |
| Reporting | Dashboard aggregate CSV, browser print/PDF, transition CSV and personal daily/weekly email report schedules. |
| Integrations | Versioned `/api/v1/` aliases, paginated task/content operations, expanded MCP fields, idempotent task writes and signed webhook notifications with retry history. |
| Identity | Transactional invitation and password recovery email, one-use reset links and revocation of previous sessions/tokens; optional Google Workspace sign-in after explicit account linking. |

## Runtime activation and limits

- Transactional email requires `RESEND_API_KEY` and a verified `MAIL_FROM`. No provider credentials were present in the existing Site. Configuring the flow is separate from proving delivery to a real mailbox.
- Google requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_WORKSPACE_DOMAIN` and the exact deployed `/api/auth/google/callback` redirect URI. Existing invited-password access remains available. Users link Google from an authenticated account with the same verified email. No role is inferred from a Google domain.
- The Worker declares a five-minute Cron Trigger and a scheduled handler. Verify an actual `OperationSetting.lastJobRun` update in the deployed environment before promising unattended delivery. On hosting that does not install Cron Triggers, connect an external scheduler to authenticated `POST /api/jobs/run` using `SAV3_JOB_SECRET`. Browser polling is not a substitute.
- Rules evaluate up to 1,000 tasks per list per run and 100 configured rules. The UI states this cap. Report delivery requires configured email.
- Historical reporting does not recover activity that was absent from the original export. Business definitions for the reproduced Opportunities cards still require the team's validation.
- Type conversions refuse incompatible values. Merging refuses conflicting populated destinations or live dashboard/view/formula references that would become invalid. Shared field references must be updated first.
- Native task status is the validation boundary for required fields. Arbitrary custom dropdowns are configurable data fields, not a second mandatory workflow engine.
- Print/PDF uses the browser's print dialog. It is not an unattended PDF renderer.
- Recovery is a separate-environment operation, not an overwrite button in production. Use `node --import tsx scripts/restore-workspace.ts /absolute/backup.json /absolute/empty-recovery-directory`. Rebind the restored environment's owner identity through the operator setup before granting access. Never point recovery at the live D1 database or R2 bucket.
- Webhook payloads contain event/resource IDs. Consumers fetch content through their own authorized API connection. Verify `X-SAV3-Signature` as HMAC-SHA256 over `timestamp + '.' + raw body`, reject old timestamps and deduplicate event IDs.
- Keep idempotency keys unique per user and logical write. Reusing a key with different content is rejected. An uncertain in-flight result must be inspected before creating a new key.

## Verification record

See the PR for final commands and outcomes. Automated D1 tests include access failures, inherited fields, defaults/required validation, safe transformations, reminders/rules, replay protection, trash recovery, checksums and restoration into a second database. Google tests use signed test tokens and mocked keys; email tests use a mocked provider. These do not constitute real Google/provider activation.

Authenticated browser, mobile and physical touch verification are separate from API and model tests. Any unperformed checks must be reported in the release handoff.

## Rollback

Preserve the previous Sites version. New schemas are additive, but older server code does not enforce new field-level privacy and may not understand Formula fields. Do not roll back to pre-0.12 server code while the new field permissions/types are active. Prefer a forward fix or restrict nonadmin access before an operator-reviewed rollback.
