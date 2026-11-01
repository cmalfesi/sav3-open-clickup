# 0011 — Invitation accounts and resource authorization

User direction supersedes the previous owner-only authentication decision:
keep the public entry, preserve native owner recovery, and add local invited
accounts. No Google SSO dependency is introduced.

AccountAccess is a separate opt-in control plane so imported User rows cannot
log in merely because they exist. Native bootstrap is tied to the recorded
RestoreState ownerKey. Passwords use the existing salted scrypt implementation.
Local cookies carry random 256-bit secrets; Session stores SHA-256 digests only,
with HttpOnly, Secure on HTTPS, SameSite=Lax and a twelve-hour expiration.
Credential endpoints enforce same-origin POST and durable D1 attempt counters.

Invitation secrets are hashed at rest and placed in a URL fragment rather than a
query string. The activation UI removes the fragment after reading it. D1 batch
claims the invitation with an acceptance nonce, and every activation write is
conditional on that nonce; concurrent redemption cannot overwrite the winner.
Invitations bind immutable email, role, scope and resource grants for seven days.
No automatic email delivery is claimed: no transactional provider is configured.

Authorization uses request-scoped AsyncLocalStorage before Vinext dispatch.
Roles cap permissions; explicit NONE/VIEW/COMMENT/EDIT grants override inherited
permissions along space/list/task/subtask paths. ResourcePolicy cuts inheritance.
Admins and owner bypass resource restrictions. Unknown API families fail closed.
Guards also resolve indirect comment/checklist/attachment/time/dependency paths,
validate destination resources and prevent unauthorized cascade changes.
Queries filter navigation, task detail, subtasks, dependencies, search, my work,
notifications and dashboard aggregates. Imported documents, global templates,
backup reports and MCP are administrator-only until each has a scoped model.

Schema additions use append-only Drizzle migrations and raw D1 queries, leaving
existing Prisma business entities and the restored dataset intact. Local QA
fixtures are confined to the local emulator. Never add a production test login
bypass, seed password, activation token, or private backup data to client assets.
