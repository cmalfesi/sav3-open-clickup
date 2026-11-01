# Sites experiment

This private fork uses Vinext, Prisma's SQLite/D1 adapter, Sites-owned ChatGPT identity and R2 uploads. The original upstream repository remains intact in a separate checkout. This intentionally changes the upstream single-Postgres deployment assumption to meet the user's request for a Sites trial.

The restore is an idempotent, resumable seed plan outside schema migrations. Only the first authenticated Site owner may initiate or use this private copy. Imported user identities are reference records with GUEST membership; no passwords, sessions or impersonation entrypoints are restored.

Task descriptions and historical comments are escaped into safe HTML paragraphs. Source IDs are retained. Supported per-list views are mapped; advanced filters and non-list views are recorded as gaps. Task types use a custom dropdown. Recurrence rules are not activated during import. Original ACLs, dashboard widgets and unretrieved content cannot be inferred.

The trial is isolated from ClickUp and does not write back. No claim of production parity or tested multi-user operation is made.
