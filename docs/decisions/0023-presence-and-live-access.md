# Live permission updates and web presence

Date: 2026-11-11. App 0.12.4.

The owner authorized the deferred change to preserve sessions on permission edits, and an owner-only presence view. Disabling an account, resetting its password and normal expiry still invalidate local access. Each request continues to load fresh grants, policies and role.

The bootstrap and same-origin web heartbeat return an opaque authorization revision. The browser refreshes navigation and query data when it changes; drafts delay content refresh while current-resource denial clears cached queries and sends the user to Home immediately. No page reload or sign-out is required for a normal permission edit. Existing tabs must load the new release once to acquire this monitor. Resource edits remain subject to the server's current authorization regardless of client revision.

Presence uses a 30-second heartbeat per browser tab and server timestamps. Active means a recent visible tab with interaction within two minutes; idle means fresh signals without that activity; offline means no signal for 90 seconds or no valid local session; unknown means no retained client signal (never observed or older than the seven-day retention). Disabled accounts are labeled separately. Browser suspension and network failure can delay signals; this is approximate presence, not productivity or attention measurement. API/MCP calls do not create web presence.

Only OWNER can read names, emails, last signal and last activity. Each writer records its authenticated identity; no page URLs, typed text, mouse coordinates, IP addresses or device fingerprints are stored. Session references are hashes already used by the session table, never bearer credentials, and are not returned in the overview. Multi-tab aggregation prevents a background tab from overriding an active one. Records older than seven days are removed during heartbeat processing. Presence is ephemeral and deliberately excluded from portable backups.

Verification must include same-cookie grant/role changes, account revocation, owner-only reads, anonymous/token/cross-origin rejection, stale/background/multiple-tab states and compiled Worker HTTP behavior. Private authenticated browser/mobile checks remain separate.
