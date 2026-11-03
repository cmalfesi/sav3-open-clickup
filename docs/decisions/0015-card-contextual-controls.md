# Contextual card actions and stable menu anchors

Card controls use the existing Radix dropdown primitive. Hover/focus visibility uses opacity, preserving a measurable anchor. Open menus keep their trigger visible even when Radix makes the page noninteractive, and keyboard/touch controls remain available. Apply the same rule to sidebar hierarchy actions: hiding triggers with display:none causes their popper reference rectangle to collapse while the menu is open.

Card background is nullable JSON configuration, backward compatible without a D1 migration. Arbitrary CSS is rejected; only six-digit hex is accepted. Background-specific text/border/hover tokens are scoped to the card, leaving portal menus on the application theme. Custom backgrounds choose black or white text using relative luminance; the KPI value follows that foreground. The chosen chart color is retained for charts and when the default background is used.

Configuration mutations still use the current edit/draft/save flow, server authorization and revision conflict checks. Viewing filters grants no editing permission. Local UI verification uses bundled real components and isolated synthetic API fixtures, without weakening application authentication or adding a public test route.
