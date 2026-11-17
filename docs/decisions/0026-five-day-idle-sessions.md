# Five-day inactivity window for application browser sessions

Date: 2026-11-17
Prepared release: 0.12.7
Branch: feat/session-idle-5-days
Status: implemented for review; not merged or deployed

## Problem and policy

A fixed twelve-hour database expiry and cookie Max-Age forced daily sign-in. The requested policy is five days after the most recent activity, renewed with use, rather than five days after initial login.

`lib/session-policy.ts` centralizes the 432,000-second window and the existing secure cookie format. Password login, invitation activation, password change and Google-backed application sessions use this duration. Existing still-valid twelve-hour sessions can renew on their next active browser signal. Expired sessions cannot be revived. Native ChatGPT identity/provider sessions and API/MCP token expirations remain outside this cookie policy.

## Activity versus automatic traffic

The existing presence endpoint already receives tab visibility and elapsed time since input. Only an authenticated same-origin POST for a local session, from a visible tab reporting input within two minutes, can renew it. The deadline is **server receipt time minus reported idle duration plus five days**. Repeated heartbeats with no newer input therefore do not move the deadline, even within the two-minute recent-activity interval. Hidden tabs, idle tabs, GET polling, notifications, dashboard auto-refresh and API tokens do not renew sessions.

The client uses a monotonic input clock, considers initial visible app opening and tab/window activation as use, and observes trusted pointer, keyboard, touch and scrolling events. The clock survives permission-revision effect restarts so a background permission update is not mistaken for user input. Signals use the existing 30-second heartbeat; the last interaction can be up to one interval behind when a browser closes/suspends before sending it. Reading a stationary page without any interaction does not keep it alive indefinitely.

## Renewal, concurrency and revocation

Renewal updates only the matching existing `Session` row, with a future current expiry, enabled account and workspace membership. Its conditional UPDATE cannot reduce an already later expiry. It cannot recreate a logged-out/deleted session, renew a disabled account, renew another user's session, or act on a mismatched cookie. The random browser token is preserved so parallel tabs do not invalidate each other; each browser/device session is independent.

The response refreshes the HttpOnly, Secure-on-HTTPS, SameSite=Lax, Path=/ cookie as well as the database deadline. The cookie's Max-Age is five days from the renewal response, so it can survive the short reported idle interval beyond the server deadline. The server always rejects an expired row, even if a cookie is still present. Browser privacy settings or explicit cookie deletion can require earlier sign-in.

Fresh permissions are still loaded for every request. Role/grant changes retain the session; logout, account disabling, password resets and existing credential revocation paths keep their semantics. No schema migration, broad session backfill, privilege changes or production writes are needed for this branch.

## Verification and release boundary

Isolated D1 tests advance the clock across several days: persistent login and cookie flags, renewal from an existing twelve-hour session, use beyond initial five days, exact idle expiry, no renewal from background/idle signals or ordinary reads, independent device sessions, stale/older signals, deleted/disabled/expired sessions, mismatched cookies, invalid activity and same-origin checks. Activation asserts the same five-day cookie duration.

The compiled Worker smoke exercises actual login and presence HTTP headers, renewal of a shortened legacy deadline, unchanged expiry for a hidden tab, and 401 without renewal for an expired cookie.

This work must stay on the new GitHub branch/PR. Do not merge or publish a Sites version until the user separately requests deployment. An eventual deployment should ask active users to load the new browser bundle; there is no mass logout or session resurrection.
