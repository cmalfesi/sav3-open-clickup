# Compact KPI sizing

Keep existing 12-column saved coordinates and row height; allow 1–3 units of vertical height only for KPI cards. This avoids moving or rescaling existing dashboards. Non-KPI cards retain a four-unit minimum through both schema validation and grid constraints; switching a micro KPI to another card type raises its height to four units.

The saved font size defaults to 36px for old cards and accepts 16–128px. CSS size-container units cap the visible figure to its available width and height without global resize listeners. A long result may render below the requested size, with a 12px floor; the full result is retained in accessible text/tooltip. Dense cards hide secondary metadata visually while preserving it for assistive technology. Font size and compact layout travel with duplication and configuration history.
