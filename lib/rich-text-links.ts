import DOMPurify from "dompurify";
import { find } from "linkifyjs";

const linkRel = "noopener noreferrer nofollow";
const linkProtocols = new Set(["https:", "http:", "mailto:", "tel:", "sms:", "ftp:"]);

export function isRichTextLink(href: string) {
  if (!href.trim()) return false;
  try {
    return linkProtocols.has(new URL(href, "https://example.invalid").protocol);
  } catch {
    return false;
  }
}

export function linkifyRichText(html: string) {
  const root = document.createElement("div");
  root.appendChild(DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: true,
  }));

  for (const anchor of root.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (!isRichTextLink(anchor.getAttribute("href") ?? "")) {
      anchor.removeAttribute("href");
      continue;
    }
    anchor.target = "_blank";
    anchor.rel = linkRel;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    if (!text.parentElement?.closest("a, pre, code, style, textarea, [data-type='mention']")) {
      textNodes.push(text);
    }
  }

  for (const text of textNodes) {
    const links = find(text.data, "url", { defaultProtocol: "https" })
      .filter(link => isRichTextLink(link.href));
    if (!links.length) continue;

    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const { start, end, href, value } of links) {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.target = "_blank";
      anchor.rel = linkRel;
      anchor.textContent = value;
      fragment.append(text.data.slice(offset, start), anchor);
      offset = end;
    }
    fragment.append(text.data.slice(offset));
    text.replaceWith(fragment);
  }
  return root.innerHTML;
}
