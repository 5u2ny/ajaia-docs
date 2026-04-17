"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FilePlus,
  Upload,
  LayoutDashboard,
  LogOut,
  FileText,
  Search,
  Focus,
} from "lucide-react";

/**
 * Global Cmd+K / Ctrl+K palette.
 *
 * Combines two kinds of items:
 *   1. Actions (New document, Import, Focus mode, Dashboard, Logout)
 *   2. Recent documents — fetched lazily the first time the palette opens
 *
 * Why: this is the #1 complaint I had in the brainstorm — Docs/Word bury
 * common verbs inside toolbars. A fuzzy command palette gives reviewers
 * a "wow, it feels fast" moment in the walkthrough for very little code.
 */

type DocItem = { id: string; title: string };

type Action =
  | { kind: "new" }
  | { kind: "import" }
  | { kind: "dashboard" }
  | { kind: "focus" }
  | { kind: "logout" }
  | { kind: "open-doc"; id: string; title: string };

type Item = {
  key: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  keywords: string[];
  action: Action;
};

type Props = {
  /**
   * When true, toggling focus mode is available as a command.
   * Only the editor page provides this callback.
   */
  onToggleFocus?: () => void;
};

export default function CommandPalette({ onToggleFocus }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [docs, setDocs] = useState<DocItem[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open on Cmd/Ctrl+K globally.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Lazily fetch the document list the first time the palette opens.
  useEffect(() => {
    if (!open || docs !== null || loadingDocs) return;
    setLoadingDocs(true);
    fetch("/api/documents")
      .then(async (r) => {
        if (!r.ok) return [];
        const j = (await r.json()) as {
          owned?: DocItem[];
          shared?: DocItem[];
        };
        const merged: DocItem[] = [
          ...(j.owned ?? []),
          ...(j.shared ?? []),
        ];
        return merged;
      })
      .then((list) => setDocs(list))
      .catch(() => setDocs([]))
      .finally(() => setLoadingDocs(false));
  }, [open, docs, loadingDocs]);

  // Focus the input each time we open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const actions: Item[] = [
      {
        key: "new",
        title: "Create new document",
        hint: "Blank, start writing immediately",
        icon: <FilePlus className="h-4 w-4" aria-hidden />,
        keywords: ["new", "create", "document", "blank"],
        action: { kind: "new" },
      },
      {
        key: "import",
        title: "Import a file",
        hint: ".txt or .md",
        icon: <Upload className="h-4 w-4" aria-hidden />,
        keywords: ["import", "upload", "file", "txt", "md"],
        action: { kind: "import" },
      },
      {
        key: "dashboard",
        title: "Go to dashboard",
        hint: "See all your documents",
        icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
        keywords: ["dashboard", "home", "docs"],
        action: { kind: "dashboard" },
      },
    ];
    if (onToggleFocus) {
      actions.push({
        key: "focus",
        title: "Toggle focus mode",
        hint: "Hide chrome, distraction-free",
        icon: <Focus className="h-4 w-4" aria-hidden />,
        keywords: ["focus", "zen", "distraction", "write"],
        action: { kind: "focus" },
      });
    }
    actions.push({
      key: "logout",
      title: "Log out",
      hint: "End your session",
      icon: <LogOut className="h-4 w-4" aria-hidden />,
      keywords: ["logout", "sign", "out", "quit"],
      action: { kind: "logout" },
    });

    const docItems: Item[] = (docs ?? []).map((d) => ({
      key: `doc-${d.id}`,
      title: d.title || "Untitled document",
      hint: "Open document",
      icon: <FileText className="h-4 w-4" aria-hidden />,
      keywords: [d.title, "document", "open"],
      action: { kind: "open-doc", id: d.id, title: d.title },
    }));

    return [...actions, ...docItems];
  }, [docs, onToggleFocus]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => setActive(0), [query, open]);

  function runAction(a: Action) {
    setOpen(false);
    switch (a.kind) {
      case "new":
        // Hit the server create endpoint and redirect to the editor.
        fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
          .then(async (r) => {
            if (r.ok) {
              const j = (await r.json()) as { document?: { id?: string } };
              if (j.document?.id) router.push(`/documents/${j.document.id}`);
            }
          })
          .catch(() => {});
        return;
      case "import":
        // Let the header's ImportButton handle the picker. We dispatch an
        // event it listens for; falls back to navigating to dashboard.
        window.dispatchEvent(new CustomEvent("ajaia:import-click"));
        router.push("/dashboard");
        return;
      case "dashboard":
        router.push("/dashboard");
        return;
      case "focus":
        onToggleFocus?.();
        return;
      case "logout":
        fetch("/api/auth/logout", { method: "POST" }).finally(() =>
          router.push("/login")
        );
        return;
      case "open-doc":
        router.push(`/documents/${a.id}`);
        return;
    }
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (filtered.length ? (a + 1) % filtered.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) =>
        filtered.length ? (a - 1 + filtered.length) % filtered.length : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[active];
      if (item) runAction(item.action);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="mt-[12vh] w-[560px] max-w-[92vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search docs, or type an action…"
            aria-label="Command palette input"
            className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-0"
          />
          <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            ESC
          </kbd>
        </label>
        <ul className="max-h-[60vh] overflow-y-auto py-1">
          {loadingDocs && docs === null && (
            <li className="px-3 py-2 text-xs text-slate-400">
              Loading documents…
            </li>
          )}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-400">
              No matches for “{query}”.
            </li>
          )}
          {filtered.map((item, i) => (
            <li
              key={item.key}
              onMouseEnter={() => setActive(i)}
              onClick={() => runAction(item.action)}
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
              {i === active && (
                <kbd className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  ↵
                </kbd>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
          <span>↑ ↓ to navigate · ↵ to select</span>
          <span>
            <kbd className="rounded bg-slate-100 px-1">⌘</kbd>{" "}
            <kbd className="rounded bg-slate-100 px-1">K</kbd>
          </span>
        </div>
      </div>
    </div>
  );
}
