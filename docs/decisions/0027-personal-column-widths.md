# Personal column widths in List and Table

## Problem and scope

The old List `minmax(260px,1fr)` track inside a `min-w-max` container allowed
intrinsic task-title width to dominate the grid. Table used another flexible
Name track. Neither view offered a resize handle or saved widths.

Use explicit shared pixel tracks for the header, parent tasks and subtasks.
Constrain cell/flex children with `min-width:0`, truncate long text and retain
the full task title as a native tooltip. The view's existing scroll container
handles columns wider than the available screen. Dashboard widget grids are
outside this change.

## Defaults and references

ClickUp documents dragging a List column's header edge:
https://help.clickup.com/hc/en-us/articles/7255389296919-Customize-List-view

Carbon allows column widths to vary by content:
https://v10.carbondesignsystem.com/components/data-table/style/

There is no universal 75-character task-column width. WCAG's 80-character
guidance applies to blocks of text, not a prescribed task-table column size:
https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation

We choose 600 px for Name as a product default, allowing room for task controls
and approximately 75 average Latin glyphs at the current 13 px UI font. Actual
capacity varies with characters, tags and counts; it is not a character limit.

| Data | Initial width (px) |
| --- | ---: |
| Name | 600 |
| Status | 160 |
| Assignee | 130 |
| Priority | 110 |
| Due/start/date field | 130 |
| Text / long text | 240 / 320 |
| Number / money / formula | 130 / 150 / 160 |
| Dropdown / labels | 180 / 220 |
| Checkbox | 80 |
| URL / email / phone | 260 / 240 / 170 |
| Rating / progress | 150 / 160 |

## Interaction and persistence

Reuse native Pointer Events and the existing preference queue. The divider has
a 24 px hit area, keyboard focus, separator semantics and announced min/max/current
width. Pointer capture keeps the drag active across rows; the preview is local
and immediate. Pointer release sends one final preference change. Escape, pointer
cancel and unexpected capture loss discard the temporary width. Left/Right adjusts
10 px, Shift changes the step to 50 px. Home or double click resets to the type's
default. No extra frontend framework is required.

Store `columnWidths` under `UserViewPreference.state`, keyed by stable built-in
IDs or `field:<id>`. Renaming/reordering a field does not move its saved width.
Client patch coalescing merges individual column keys, matching D1's existing
atomic `json_patch`. Existing collapsed groups, expanded tasks, filters and
calendar preferences remain intact. No migration is needed. Guests can change
their own layout through the existing self-preference route, without acquiring
permission to modify fields or tasks.

Payload widths must be finite integers within 64–1600 px, with bounded keys and
map size. Rendering applies tighter per-column minimums and maximums. Reset saves
the numeric default so client merging and SQLite JSON merge have identical results.

## Verification and release

Tests exercise the actual pointer/keyboard event handlers (preview versus single
commit, wrong pointer, bounds, cancel), shared fixed tracks in rendered List/Table
markup including long titles and child rows, type defaults, field identity, patch
merging and invalid widths. D1 tests round-trip widths and concurrent column patches,
verify user/view isolation, guest self-preferences and unchanged shared config.

Managed preview currently serves the login's unstyled SSR HTML, so actual browser
dragging, touch, mobile layout and keyboard interaction remain unverified. Do not
change auth or app code to bypass that preview limitation. Complete typecheck,
unit/D1 suites, build and compiled Worker verification before committing.

This joins pending 0.12.7 on `feat/session-idle-5-days` / draft PR #24. Preserve the
five-day inactivity session changes. Do not merge or deploy without a later request.
