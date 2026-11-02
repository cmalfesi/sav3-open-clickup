# Reduce task-save and list latency

Production requests showed roughly 3 seconds to save tasks and 6–7 seconds to
reload the CPO list. Every save invalidated that complete list, sometimes also
through the initiating user's SSE event. Prisma loaded task relations in
sequential batches of 20 tasks to stay under D1's parameter limit.

Read task scalar rows and relations through a single eight-statement D1 batch,
using joins scoped to the list or saved task rather than large IN parameter
lists. Preserve dates, JSON values, counts, subtasks, dependencies and ordering.
Apply the existing resource authorization projection before returning any data.
List metadata can load concurrently with the task batch. No result cap is added.

Read the authorization graph and grants in a fresh request-scoped D1 batch.
Do not cache permissions across requests. Avoid the owner's redundant account
upsert when the account already has its expected flags.

Apply task edits immediately in list/detail caches and merge the server's saved
record. Failed edits roll back only the affected task; overlapping edits receive
a final server reconciliation. Creation inserts the successful response directly
rather than reloading every task. Recurrence retains its full-list refresh so the
new occurrence is discoverable. Detail activity can refresh separately.

Include an optional per-page client nonce on create/update events. It carries no
authorization and never replaces membership checks. The initiating browser
already reconciles its mutation response and skips that duplicate invalidation;
other browsers and other tabs using the same account retain their event refresh. The existing in-process pub/sub still
does not guarantee delivery across Workers isolates.

Display pending saves and accessible error feedback. Verify parity against
Prisma on real D1-emulated fixtures, restricted access, large lists, successful
and failed mutations, concurrent edits, TypeScript and the production build.
