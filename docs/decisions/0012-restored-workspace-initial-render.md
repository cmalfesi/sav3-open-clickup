# Render completed workspaces without the import screen

The client import gate started at zero on every full page navigation, even when
RestoreState already marked the import complete. This briefly hid the workspace
behind an inaccurate trial/import screen until another request finished.

Read the existing completion flag in the dynamic server layout and pass it to the
gate as its initial state. Completed workspaces render the application immediately
and skip client import requests. Incomplete imports retain the original flow.
Use workspace wording rather than suggesting that saved edits are disposable.

This change does not write RestoreState, rerun completed imports, or alter any
account, resource permission, task, dashboard, or attachment.
