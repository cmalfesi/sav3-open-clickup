import { describe, expect, it } from "vitest";
import { isRichTextLink } from "@/lib/rich-text-links";

describe("rich text link destinations", () => {
  it.each(["https://example.com/a?q=1#intro", "http://localhost:3000", "/l/example", "mailto:a@example.com"])(
    "accepts %s",
    (href) => expect(isRichTextLink(href)).toBe(true),
  );

  it.each(["", "javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,hello", "https://["])(
    "rejects %s",
    (href) => expect(isRichTextLink(href)).toBe(false),
  );
});
