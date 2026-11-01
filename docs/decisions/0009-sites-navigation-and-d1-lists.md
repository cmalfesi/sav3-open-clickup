# Sites navigation and bounded D1 reads

Status: Accepted

The private deployment reproduced two failures: clicking a list left Home on
screen with `navigateClientSide`/prefetch TypeErrors, and the largest imported
list returned HTTP 500 while reading task relations through Prisma/D1.

Use native anchors and document navigation for cross-page actions in this
deployment. Task dialogs and view tabs remain local React interactions. This
preserves authenticated requests, keyboard activation, browser history and
opening links in new tabs, at the cost of a full page load between lists.

Read tasks with relations in pages of 20 and retrieve dependency edges through
list-scoped relations instead of unbounded ID arrays. Return the entire list;
this is a query batching strategy, not a display cap.

Verify the published navigation and large lists in a signed-in browser. A
successful MCP workspace query does not validate these UI paths.
