"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { useCallback, useEffect, useRef, useId, useMemo } from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Heading2,
  Quote,
} from "lucide-react";
import { markDraft } from "@/lib/drafts";
import { cn } from "@/lib/utils";
import { isRichTextLink, linkifyRichText } from "@/lib/rich-text-links";
import { createMentionSuggestion, type MentionItem } from "@/lib/mention-suggestion";

function openEditorLink(event: MouseEvent | KeyboardEvent) {
  const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
  if (!link || !isRichTextLink(link.href)) return false;
  event.preventDefault();
  window.open(link.href, "_blank", "noopener,noreferrer");
  return true;
}

export function RichEditor({
  content,
  onChange,
  onBlur,
  placeholder,
  className,
  toolbar = true,
  autoFocus = false,
  mentions,
}: {
  content: string;
  onChange?: (html: string) => void;
  onBlur?: (html: string) => void | Promise<unknown>;
  placeholder?: string;
  className?: string;
  toolbar?: boolean;
  autoFocus?: boolean;
  mentions?: MentionItem[];
}) {
  // ref so the mention suggestion (created once) always reads the latest list;
  // synced in an effect — the suggestion only reads it when the user types "@".
  const draftId=useId(),dirty=useRef(false),baseline=useRef(content);
  const normalize=(s:string)=>s==='<p></p>'?'':s;
  useEffect(()=>()=>markDraft(draftId,false),[draftId]);
  const mentionsRef = useRef<MentionItem[]>(mentions ?? []);
  useEffect(() => {
    mentionsRef.current = mentions ?? [];
  }, [mentions]);

  const preparedContent = useMemo(() => typeof document === "undefined" ? content : linkifyRichText(content), [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          defaultProtocol: "https",
          openOnClick: false,
          HTMLAttributes: { tabindex: "0" },
          isAllowedUri: (url, { defaultValidate }) => defaultValidate(url) && isRichTextLink(url),
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
      ...(mentions
        ? [
            Mention.configure({
              HTMLAttributes: { class: "mention" },
              suggestion: createMentionSuggestion(() => mentionsRef.current),
            }),
          ]
        : []),
    ],
    content: preparedContent,
    immediatelyRender: false,
    autofocus: autoFocus,
    editorProps: {
      attributes: { class: cn("rich min-h-[60px] px-3 py-2 outline-none", className) },
      handleDOMEvents: {
        click: (_view, event) => openEditorLink(event),
        keydown: (_view, event) => event.key === "Enter" && openEditorLink(event),
      },
    },
    onUpdate: ({ editor }) => { dirty.current=normalize(editor.getHTML())!==normalize(baseline.current);markDraft(draftId,dirty.current);onChange?.(editor.getHTML()); },
    onBlur: ({ editor }) => {
      if (!dirty.current || !onBlur) return;
      const draft = editor.getHTML();
      const html = linkifyRichText(draft);
      void Promise.resolve(onBlur(html)).then(() => {
        if (editor.getHTML() !== draft) return;
        if (html !== draft && !editor.isFocused) editor.commands.setContent(html, { emitUpdate: false });
        baseline.current = editor.getHTML();
        dirty.current = false;
        markDraft(draftId, false);
      }).catch(() => { /* Keep the draft when saving fails. */ });
    },
  });

  // keep external content in sync when switching tasks
  useEffect(() => {
    if (editor && !dirty.current) {
      if (preparedContent !== editor.getHTML()) {
        editor.commands.setContent(preparedContent, { emitUpdate: false });
      }
      baseline.current = editor.getHTML();
    }
  }, [editor, preparedContent]);

  if (!editor) return <div className="min-h-[60px] px-3 py-2 text-[13px] text-cu-text-tertiary">…</div>;

  return (
    <div className="rounded-lg border border-cu-border focus-within:border-cu-purple">
      {toolbar && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const btn = (active: boolean) =>
    cn(
      "flex h-7 w-7 items-center justify-center rounded hover:bg-cu-hover",
      active ? "bg-cu-purple-light text-cu-purple-dark" : "text-cu-text-secondary",
    );
  return (
    <div className="flex items-center gap-0.5 border-b border-cu-border px-1.5 py-1">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive("bold"))}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive("italic"))}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive("strike"))}>
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-cu-border" />
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btn(editor.isActive("heading", { level: 2 }))}>
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive("bulletList"))}>
        <List className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive("orderedList"))}>
        <ListOrdered className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive("blockquote"))}>
        <Quote className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btn(editor.isActive("codeBlock"))}>
        <Code className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** Static renderer for stored HTML. */
export function RichText({ html, className }: { html: string; className?: string }) {
  const renderContent = useCallback((element: HTMLDivElement | null) => {
    if (element) element.innerHTML = linkifyRichText(html);
  }, [html]);
  return <div ref={renderContent} className={cn("rich", className)} />;
}
