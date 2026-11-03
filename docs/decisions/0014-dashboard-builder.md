# 0014 Configurable dashboard editor

Date: 2026-11-02. Status: implemented for release 9.

Dashboards start empty. Users add KPI, bar, pie, line, task table and activity cards. Recharts renders the charts; React Grid Layout handles a persisted 12-column layout and resizing. The legacy wrapper is used deliberately for its stable flat props on the existing React/Vinext stack. Keyboard controls offer ordering and size changes; small screens stack cards.

The same editor is available through the dashboards hub and a DASHBOARD list view linked by dashboardId. A dashboard's location is independent of its data sources. New dashboards are private to the creator and administrators; sharing the dashboard never grants access to underlying tasks. Configuration write permissions and sharing authority are distinct. Creators and administrators manage sharing; members with EDIT can edit configuration, while guests remain read-only. Hidden dashboards are omitted from list view tabs.

D1 stores schema-validated configuration, optimistic revision and attributed configuration history. Updates use a compare-and-swap and a write nonce in one batch so stale or concurrent submissions cannot overwrite the winning revision. Legacy summary dashboards acquire a definition on first save. Archiving is reversible.

Task data is filtered by each request's fresh resource permissions before returning it to the browser. One authorized dataset powers every card. A shared pure engine calculates metrics and drill-down task sets, preserving zero versus missing numeric values, unique-task KPI denominators, explicit empty groups and intersection of dashboard/card filters. Source changes take effect upon saving; the editor explains when preview data still reflects the saved source set.

Multiple assignees or tags can place a task in multiple groups; this is explained in the UI. Pie charts allow counts and sums; negative values require a bar chart. Date-based lines group current tasks by recorded dates; they do not fabricate historical pipeline transitions. Tables show up to 100 tasks and activity cards up to 50 events from the most recent 200 authorized events in the loaded dataset. Drill-down has the full filtered task set. Up to 40 cards are supported per panel.

Refresh is manual by default. Users may enable a 30-second interval. Editing pauses automatic refresh, and explicit refresh of other-user changes respects the shared draft registry. Individual card refreshes retain independent snapshots and timestamps. Configuration history displays the latest 50 revisions. Current layout and card definitions are backed by Git and Sites versions; private imported task data remains outside the public GitHub export.
