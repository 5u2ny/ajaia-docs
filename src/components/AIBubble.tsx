"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles,
  ArrowDownToLine,
  ArrowUpFromLine,
  SpellCheck,
  RefreshCw,
  FileText,
  Languages,
  Loader2,
} from "lucide-react";

/**
 * Inline AI bubble — appears above any non-empty text selection inside the
 * editor. Click an action to hit the stubbed /api/ai/rewrite endpoint and
 * replace the selection with the result.
 *
 * Why hand-rolled instead of `@tiptap/extension-bubble-menu`:
 *   - Avoid adding a dependency late in the assignment timeline
 *   - We need the same bubble regardless of how the selection was made
 *     (mouse drag, shift-arrow, double-click) — easier with the native
 *     Selection API
 *   - Positioning wants the caret rect, not a TipTap view coord, so we
 *     read `window.getSelection().getRangeAt(0).getBoundingClientRect()`
 */

type Action =
  | "shorten"
  | "expand"
  | "grammar"
  | "rewrite"
  | "summarize"
  | "translate";

type Props = {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLElement>;
};

const QUICK: { id: Action; label: string; icon: React.ReactNode }[] = [
  { id: "shorten", label: "Shorter", icon: <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden /> },
  { id: "rewrite", label: "Rewrite", icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden /> },
];

const ALL: { id: Action; label: string; icon: React.ReactNode }[] = [
  { id: "shorten", label: "Make shorter", icon: <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden /> },
  { id: "expand", label: "Expand", icon: <ArrowUpFromLine className="h-3.5 w-3.5" aria-hidden /> },
  { id: "grammar", label: "Fix grammar", icon: <SpellCheck className="h-3.5 w-3.5" aria-hidden /> },
  { id: "rewrite", label: "Rewrite", icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden /> },
  { id: "summarize", label: "Summarize", icon: <FileText className="h-3.5 w-3.5" aria-hidden /> },
  { id: "translate", label: "Translate (ES)", icon: <Languages className="h-3.5 w-3.5" aria-hidden /> },
];

export default function AIBubble({ editor, containerRef }: Props) {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTextRef = useRef<string>("");

  // Recompute visibility + position whenever the selection changes.
  useEffect(() => {
    if (!editor) return;

    function update() {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) {
        setVisible(false);
        setExpanded(false);
        return;
      }

      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!sel || sel.rangeCount === 0) {
        setVisible(false);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setVisible(false);
        return;
      }

      const container = containerRef.current;
      if (!container) return;
      const parent = container.getBoundingClientRect();

      // Store the selected plain text; send this to the API.
      const text = editor.state.doc.textBetween(from, to, "\n");
      lastTextRef.current = text;

      setPos({
        top: rect.top - parent.top - 44,
        left: rect.left - parent.left + rect.width / 2 - 80,
      });
      setVisible(true);
    }

    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor, containerRef]);

  async function run(action: Action) {
    if (!editor) return;
    const text = lastTextRef.current;
    if (!text.trim()) return;

    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `AI failed (${res.status})`);
      }
      const { result } = (await res.json()) as { result: string };
      // Replace the current selection with the result.
      editor.chain().focus().insertContent(result).run();
      setVisible(false);
      setExpanded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI error");
    } finally {
      setBusy(null);
    }
  }

  if (!visible) return null;

  return (
    <div
      role="toolbar"
      aria-label="AI actions"
      className="absolute z-30 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-1 shadow-lg ring-1 ring-black/5"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => {
        // Prevent the editor from losing selection when clicking bubble.
        e.preventDefault();
      }}
    >
      {!expanded ? (
        <>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Ask AI
          </button>
          <span className="h-3 w-px bg-slate-200" aria-hidden />
          {QUICK.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={busy !== null}
              onClick={() => run(a.id)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {busy === a.id ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                a.icon
              )}
              {a.label}
            </button>
          ))}
        </>
      ) : (
        <div className="flex flex-col">
          <div className="flex flex-wrap items-center gap-1 px-1 py-0.5">
            {ALL.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy !== null}
                onClick={() => run(a.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                {busy === a.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  a.icon
                )}
                {a.label}
              </button>
            ))}
          </div>
          {error && (
            <div className="px-2 pb-1 text-[10px] text-rose-600">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
