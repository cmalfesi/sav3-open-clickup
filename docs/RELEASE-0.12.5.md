# 0.12.5 — Task editing and checklist responsibilities

Prepared for deployment review. Production remains on 0.12.4 until deployment is requested after the prior notice.

- Different persistent avatar colors per existing user and unused colors for newly invited users; uploaded profile photos remain visible.
- Delete controls on nested subtask rows, using recoverable trash and existing permissions.
- One optional responsible user for each checklist item, with eligible-user selection, unassignment and Inbox assignment notifications.
- Immediate checklist row updates, visible pending feedback, disabled repeat submissions and rollback on rejected writes.
- Task, subtask, checklist item and comment composers retain their draft until saving succeeds.
- Global foreground write indicator above dialogs, with a slow-request explanation, confirmation and persistent error feedback.
- Checklist writes use the returned entity instead of reloading the full task and list.
- Fix parent deletion when a descendant is already in trash; separate restore batches are preserved.

## Deployment

Apply additive D1 migration `0012_fancy_microchip.sql` with the normal Sites deployment. It adds a nullable checklist item assignee and assigns colors to existing users. No account/session invalidation, password change or access expansion is part of this release.

Checklists and assignments are included in existing workspace backups. Earlier backups lacking the nullable column remain compatible. A code rollback can retain the added column, but older code will not expose the new responsibility control.

## Verification limits

Automated checks and compiled route tests are recorded in the PR. Local managed preview is missing CSS/client JavaScript, so visual, mobile, keyboard and touch validation of the new controls is pending. Production latency has not been measured; the confirmed optimization is fewer reload requests and immediate optimistic checklist rendering.
