# Compact task tags and explicit overflow

Status: Accepted (2026-11-27).

Tags were allowed to flex-shrink and wrap at hyphens inside the List's capped
name-cell area. Long labels became tall gray bubbles and expanded whole rows.
The user's ClickUp reference shows two truncated chips followed by +N.

Give the shared chip a bounded width, no wrapping and ellipsis. List uses a
24 px button containing at most two 16 px chips plus the exact remaining count.
Keep its width bounded relative to Name; resizing columns must not widen rows
or change row height. Avoid per-row observers or offscreen measurements for a
small fixed summary. All tags remain reachable in a Radix popover through mouse,
keyboard and touch-compatible click targets; preserve Escape/focus behavior and
stop event propagation so consulting tags cannot open a task accidentally.

The backup's tags all used the neutral #656f7d import placeholder. Map only this
placeholder (and invalid color input) to a deterministic name-based palette for
presentation. Other configured hex colors stay authoritative. Never overwrite
stored colors or claim these generated colors exactly reproduce the original
ClickUp colors. Use the same display mapping in list, Board, task chips and picker
indicators, with a foreground chosen for WCAG AA text contrast. A later Tag
Manager can replace fallback colors with explicitly configured values.

No database/API/auth changes or new dependencies. Tests cover counts, empty and
small sets, label escaping, deterministic fallback, configured colors and text
contrast. Browser QA uses actual ListView and production CSS in a disposable
local fixture, not a production auth bypass or fake backend.
