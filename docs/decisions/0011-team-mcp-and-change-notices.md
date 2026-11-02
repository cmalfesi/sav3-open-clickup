# 0011 Personal integrations and durable collaboration notices

Date: 2026-11-02. Status: implemented for Sites release 8.

The existing `/mcp` uses Sites identity. A verified native identity can resolve an enabled, activated member with the matching verified email; it cannot bootstrap a second owner. Each request reloads current membership, resource grants and private boundaries. MCP tools assert permissions themselves rather than exposing unfiltered workspace queries.

Other MCP HTTP clients can use `/api/integrations/mcp` with an individual Bearer token. Tokens are random, stored only as SHA-256 digests, expire and can be revoked. Read tokens cannot mutate. Tokens do not authorize account, invitation or permission administration. Disabled accounts immediately lose integration access. The token never substitutes administrator rights for resource permissions.

Web and MCP comments share one service. Mention notifications target only enabled recipients with task access and respect preferences. Mentions added to descriptions or edited comments notify only newly mentioned identities. Plain names are not mentions. Notifications are in-app; no email or push delivery is configured.

ChangeEvent records mutation signals durably in D1. The client polls every five seconds while visible and on reconnect/focus. It offers a five-second floating notice and retains a small pending indicator. It does not automatically replace the active task/list cache. Dashboards filter events through their permitted source lists. Local drafts and pending saves block explicit refresh. The process-local SSE is no longer required for collaboration delivery.

Description saves from the web include the previously loaded HTML. A stale description is rejected with a conflict instead of replacing newer text. MCP callers can pass `expected_description` from get_task. The editor retains its draft after failure. Current activity logs record user, time and channel; description, metadata, custom fields and comment edits extend the previous coverage. Imported activity remains hidden from restricted members unless it carries a locally generated safe channel marker.

Change events are not an immutable audit archive. Task activity follows the task lifecycle. The short notification feed shows the latest 200 items; unread counts include all currently visible unread items. A future retention policy can prune ChangeEvent and archive activity separately.
