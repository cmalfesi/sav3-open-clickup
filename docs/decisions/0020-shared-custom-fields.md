# Shared Custom Fields and location inheritance

The field ID identifies one definition and its options across all of its locations.
`CustomFieldLocation` attaches it to Spaces or Lists. A Space placement applies to
current and future Lists, including Lists in folders. The original nullable
`CustomField.listId` remains readable for imported and older definitions.
An edit stores all explicit placements and keeps option IDs and task values.
A removed placement preserves task values for later reattachment.

The schema migration rebuilds the original field table to allow a missing List
and changes its List reference to SET NULL. It temporarily preserves both child
tables and restores their rows and indexes with foreign keys enabled. A regression
test starts with imported fields, options and values before applying the migration.
No imported definitions are replaced with guessed metadata.

Field revisions reject concurrent edits. A database trigger prevents deleting an
option referenced by any task value. Value writes validate the current options
within their SQL statement, so a concurrent option removal cannot introduce a
new dangling selection. Member edits require EDIT on every explicit List location.
Space configuration requires an administrator. Guest access stays read-only.

Dashboards operate on task fields from source Lists. Their toolbar opens the same
manager with their sources as context. Field configuration applies to those Lists
or their parent Space. Charts and filters use the same field IDs and options.
The initial manager supports the thirteen existing field types, descriptions,
option labels/colors/order, shared locations and search. Type conversion,
per-field privacy, required/default values, formulas, merges and field deletion
are outside this change.

The three-dot accumulation came from duplicate sibling keys in the view toolbar.
The view-options button and task-search control now have distinct key prefixes.
Browser QA switches repeatedly among List, Table, Board and Calendar.

## Product references

- https://help.clickup.com/hc/en-us/articles/13066263096727-Intro-to-Custom-Field-Manager
- https://help.clickup.com/hc/en-us/articles/6303561371543-Edit-Custom-Fields
- https://help.clickup.com/hc/en-us/articles/6303481086487-Create-Custom-Fields
- https://help.clickup.com/hc/en-us/articles/6303499162647-Custom-Field-types
