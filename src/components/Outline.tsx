"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";

/**
 * Heading outline sidebar.
 *
 * Walks the TipTap JSON tree, collects every heading node, and renders
 * a clickable list with indentation per level. Clicking scrolls the
 * matching heading into view (we use DOM text matching rather than node
 * IDs because TipTap doesn't assign stable IDs to headings by default).
 *
 * This is the cheapest way to give long documents a sense of structure —
 * the thing both Docs and Word users complain is buried in a menu.
 */

type Heading = {
  level: 1 | 2 | 3;
  text: string;
  index: number; // nth heading in the document — used for DOM lookup
};

type Props = {
  editor: Editor | null;
  initialContent: JSONContent;
};

export default function Outline({ editor, initialContent }: Props) {
  const [headings, setHeadings] = useState<Heading[]>(() =>
    extractHeadings(initialContent)
  );

  useEffect(() => {
    if (!editor) return;

    function update() {
      if (!editor) return;
      setHeadings(extractHeadings(editor.getJSON()));
    }

    editor.on("update", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("update", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  function scrollTo(h: Heading) {
    if (typeof document === "undefined") return;
    // The editor lives in .tiptap; grab the Nth heading of matching tag.
    const root = document.querySelector(".tiptap");
    if (!root) return;
    const tag = `h${h.level}`;
    const all = root.querySelectorAll(tag);
    const el = all[h.index] as HTMLElement | undefined;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // Briefly flash the heading so the user sees where we landed.
      el.classList.add("outline-jump-flash");
      setTimeout(() => el.classList.remove("outline-jump-flash"), 1200);
    }
  }

  return (
    <aside className="outline-sidebar sticky top-20 hidden w-52 shrink-0 lg:block">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Outline
      </div>
      <nav className="mt-2 border-l border-slate-200 pl-2">
        {headings.length === 0 ? (
          <p className="text-xs text-slate-400">
            No headings yet. Type <kbd className="rounded bg-slate-100 px-1">/</kbd>{" "}
            to insert one.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {headings.map((h, i) => (
              <li key={`${h.level}-${h.index}-${i}`}>
                <button
                  type="button"
                  onClick={() => scrollTo(h)}
                  className={
                    "block w-full truncate rounded px-1 py-0.5 text-left text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 " +
                    (h.level === 1
                      ? "font-semibold"
                      : h.level === 2
                      ? "pl-3"
                      : "pl-5 text-slate-500")
                  }
                  title={h.text}
                >
                  {h.text || <span className="italic text-slate-400">untitled</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}

function extractHeadings(doc: JSONContent | undefined): Heading[] {
  const out: Heading[] = [];
  if (!doc) return out;
  // Per-level counters so Outline.scrollTo can find the correct h1/h2/h3 DOM node.
  const counters = { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>;

  function walk(node: JSONContent | undefined): void {
    if (!node) return;
    if (node.type === "heading") {
      const level = (node.attrs?.level ?? 1) as number;
      if (level === 1 || level === 2 || level === 3) {
        const text = collectText(node);
        out.push({ level, text, index: counters[level] });
        counters[level] += 1;
      }
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c as JSONContent);
    }
  }

  walk(doc);
  return out;
}

function collectText(node: JSONContent): string {
  let s = "";
  function walk(n: JSONContent | undefined) {
    if (!n) return;
    if (n.type === "text" && typeof n.text === "string") s += n.text;
    if (Array.isArray(n.content)) {
      for (const c of n.content) walk(c as JSONContent);
    }
  }
  walk(node);
  return s.trim();
}
