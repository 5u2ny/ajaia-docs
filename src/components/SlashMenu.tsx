"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
} from "lucide-react";

/**
 * Notion-style slash menu.
 *
 * We avoid adding @tiptap/suggestion as a dependency (the assignment is
 * explicit about keeping scope tight). Instead we intercept `/` via
 * TipTap's `editorProps.handleKeyDown`, measure the caret with a DOM
 * Range, and render a positioned menu that filters as the user types.
 *
 * Why this pattern:
 *   - No extra npm install (fewer moving parts, faster review)
 *   - Works with TipTap's existing command chain so "H2" etc. still
 *     participate in undo/redo normally
 *   - Keyboard nav (↑ ↓ Enter Esc) matches what power users expect
 */

type Item = {
  id: string;
  title: string;
  hint: string;
  keywords: string[];
  icon: React.ReactNode;
  run: (editor: Editor) => void;
};

const ITEMS: Item[] = [
  {
    id: "h1",
    title: "Heading 1",
    hint: "Top-level title",
    keywords: ["h1", "heading", "title"],
    icon: <Heading1 className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    title: "Heading 2",
    hint: "Section heading",
    keywords: ["h2", "heading", "section"],
    icon: <Heading2 className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    title: "Heading 3",
    hint: "Sub-section",
    keywords: ["h3", "heading", "sub"],
    icon: <Heading3 className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "p",
    title: "Paragraph",
    hint: "Body text",
    keywords: ["p", "paragraph", "text", "body"],
    icon: <Pilcrow className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: "ul",
    title: "Bulleted list",
    hint: "Unordered items",
    keywords: ["ul", "bullet", "list"],
    icon: <List className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ol",
    title: "Numbered list",
    hint: "Ordered steps",
    keywords: ["ol", "number", "list", "ordered"],
    icon: <ListOrdered className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "quote",
    title: "Quote",
    hint: "Callout block",
    keywords: ["quote", "blockquote", "callout"],
    icon: <Quote className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "hr",
    title: "Divider",
    hint: "Horizontal rule",
    keywords: ["hr", "divider", "rule", "line"],
    icon: <Minus className="h-4 w-4" aria-hidden />,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

export type SlashMenuHandle = {
  open: (position: { top: number; left: number }) => void;
  close: () => void;
  isOpen: () => boolean;
  /** returns true if handled (arrow/enter/esc while open) */
  handleKey: (key: string) => boolean;
  setQuery: (q: string) => void;
};

type Props = {
  editor: Editor | null;
  onHandleRef?: (handle: SlashMenuHandle) => void;
};

export default function SlashMenu({ editor, onHandleRef }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ITEMS;
    return ITEMS.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  // Expose imperative handle so DocumentEditor can drive it from keydown events.
  const handleRef = useRef<SlashMenuHandle>({
    open: (p) => {
      setPos(p);
      setQuery("");
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
    setQuery: (q) => setQuery(q),
    handleKey: (key) => {
      if (!open) return false;
      if (key === "Escape") {
        setOpen(false);
        return true;
      }
      if (key === "ArrowDown") {
        setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
        return true;
      }
      if (key === "ArrowUp") {
        setActive((a) =>
          filtered.length ? (a - 1 + filtered.length) % filtered.length : 0
        );
        return true;
      }
      if (key === "Enter") {
        const item = filtered[active];
        if (item && editor) {
          // Remove the typed `/query` before applying the command so the menu
          // input doesn't leak into the document.
          const len = query.length + 1; // +1 for the slash itself
          editor.chain().focus().deleteRange({
            from: editor.state.selection.from - len,
            to: editor.state.selection.from,
          }).run();
          item.run(editor);
        }
        setOpen(false);
        return true;
      }
      return false;
    },
  });

  // Keep the handle in sync on every render so the latest state is used.
  handleRef.current = {
    open: (p) => {
      setPos(p);
      setQuery("");
      setOpen(true);
    },
    close: () => setOpen(false),
    isOpen: () => open,
    setQuery: (q) => setQuery(q),
    handleKey: (key) => {
      if (!open) return false;
      if (key === "Escape") {
        setOpen(false);
        return true;
      }
      if (key === "ArrowDown") {
        setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
        return true;
      }
      if (key === "ArrowUp") {
        setActive((a) =>
          filtered.length ? (a - 1 + filtered.length) % filtered.length : 0
        );
        return true;
      }
      if (key === "Enter") {
        const item = filtered[active];
        if (item && editor) {
          const len = query.length + 1;
          editor
            .chain()
            .focus()
            .deleteRange({
              from: editor.state.selection.from - len,
              to: editor.state.selection.from,
            })
            .run();
          item.run(editor);
        }
        setOpen(false);
        return true;
      }
      return false;
    },
  };

  useEffect(() => {
    onHandleRef?.(handleRef.current);
  }, [onHandleRef, open, query, active, filtered]);

  if (!open) return null;

  return (
    <div
      role="listbox"
      aria-label="Slash commands"
      className="fixed z-40 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {filtered.length === 0 ? "No matches" : `Blocks · ${filtered.length}`}
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {filtered.map((item, i) => (
          <li
            key={item.id}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => {
              // Use mousedown so TipTap doesn't lose focus before we run the command.
              e.preventDefault();
              if (!editor) return;
              const len = query.length + 1;
              editor
                .chain()
                .focus()
                .deleteRange({
                  from: editor.state.selection.from - len,
                  to: editor.state.selection.from,
                })
                .run();
              item.run(editor);
              setOpen(false);
            }}
            className={
              "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm " +
              (i === active ? "bg-slate-100" : "hover:bg-slate-50")
            }
          >
            <span className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600">
              {item.icon}
            </span>
            <span className="flex-1">
              <span className="block font-medium text-slate-900">
                {item.title}
              </span>
              <span className="block text-[11px] text-slate-500">
                {item.hint}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
