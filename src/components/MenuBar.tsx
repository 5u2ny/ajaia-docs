"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Google-Docs-style menu bar. Five top-level menus, each opens a
 * dropdown of actions. Actions are delegated to either:
 *   - the TipTap editor (formatting / insert),
 *   - the host callbacks (open share modal, toggle focus, etc.),
 *   - client-side helpers (export markdown, logout).
 *
 * Why hand-rolled instead of a popover lib: we already roll our own
 * palette and bubble; a 40-line menu keeps the bundle tiny and gives
 * us full control over keyboard behavior.
 */

type Props = {
  editor: Editor | null;
  documentId: string;
  documentTitle: string;
  onOpenShare: () => void;
  onToggleFocus: () => void;
  canShare: boolean;
};

export default function MenuBar({
  editor,
  documentId,
  documentTitle,
  onOpenShare,
  onToggleFocus,
  canShare,
}: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click or Escape.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!barRef.current) return;
      if (!barRef.current.contains(e.target as Node)) setOpen(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // --- Action helpers ---

  async function createNewDoc() {
    setOpen(null);
    const r = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (r.ok) {
      const j = (await r.json()) as { document?: { id?: string } };
      if (j.document?.id) router.push(`/documents/${j.document.id}`);
    }
  }

  function triggerImport() {
    setOpen(null);
    // The ImportButton on the dashboard listens for this; going to
    // dashboard gives the reviewer a familiar target.
    window.dispatchEvent(new CustomEvent("ajaia:import-click"));
    router.push("/dashboard");
  }

  async function exportMarkdown() {
    setOpen(null);
    if (!editor) return;
    // Simple TipTap-JSON → Markdown converter covering our supported blocks.
    const md = toMarkdown(editor.getJSON());
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${(documentTitle || "document").replace(/\s+/g, "-")}.md`;
    window.document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    setOpen(null);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  }

  function run(fn: () => void) {
    setOpen(null);
    fn();
  }

  if (!editor) {
    return <div className="h-9 border-b border-slate-200 bg-white" aria-hidden />;
  }

  const m = menuItemClass;

  return (
    <div
      ref={barRef}
      role="menubar"
      aria-label="Application menu"
      className="relative flex items-center gap-0.5 border-b border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700"
    >
      {/* --- File --- */}
      <Trigger
        label="File"
        openId="file"
        open={open}
        setOpen={setOpen}
      />
      {open === "file" && (
        <Menu x={2}>
          <Item onClick={createNewDoc} shortcut="⌘N" cls={m}>
            New document
          </Item>
          <Item onClick={triggerImport} shortcut="" cls={m}>
            Import .txt / .md…
          </Item>
          <Sep />
          <Item onClick={exportMarkdown} shortcut="" cls={m}>
            Download as Markdown
          </Item>
          <Sep />
          {canShare && (
            <Item onClick={() => run(onOpenShare)} shortcut="" cls={m}>
              Share…
            </Item>
          )}
          <Item onClick={() => run(() => router.push("/dashboard"))} shortcut="" cls={m}>
            Back to dashboard
          </Item>
          <Sep />
          <Item onClick={logout} shortcut="" cls={m}>
            Sign out
          </Item>
        </Menu>
      )}

      {/* --- Edit --- */}
      <Trigger label="Edit" openId="edit" open={open} setOpen={setOpen} />
      {open === "edit" && (
        <Menu x={44}>
          <Item
            onClick={() => run(() => editor.chain().focus().undo().run())}
            disabled={!editor.can().undo()}
            shortcut="⌘Z"
            cls={m}
          >
            Undo
          </Item>
          <Item
            onClick={() => run(() => editor.chain().focus().redo().run())}
            disabled={!editor.can().redo()}
            shortcut="⌘⇧Z"
            cls={m}
          >
            Redo
          </Item>
          <Sep />
          <Item
            onClick={() =>
              run(() => editor.chain().focus().selectAll().run())
            }
            shortcut="⌘A"
            cls={m}
          >
            Select all
          </Item>
          <Item
            onClick={() =>
              run(() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              )
            }
            shortcut="⌘\\"
            cls={m}
          >
            Clear formatting
          </Item>
        </Menu>
      )}

      {/* --- Insert --- */}
      <Trigger label="Insert" openId="insert" open={open} setOpen={setOpen} />
      {open === "insert" && (
        <Menu x={86}>
          <Item
            onClick={() =>
              run(() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              )
            }
            shortcut="⌘⌥1"
            cls={m}
          >
            Heading 1
          </Item>
          <Item
            onClick={() =>
              run(() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              )
            }
            shortcut="⌘⌥2"
            cls={m}
          >
            Heading 2
          </Item>
          <Item
            onClick={() =>
              run(() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              )
            }
            shortcut="⌘⌥3"
            cls={m}
          >
            Heading 3
          </Item>
          <Sep />
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleBulletList().run())
            }
            shortcut="⌘⇧8"
            cls={m}
          >
            Bulleted list
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleOrderedList().run())
            }
            shortcut="⌘⇧7"
            cls={m}
          >
            Numbered list
          </Item>
          <Sep />
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleBlockquote().run())
            }
            shortcut=""
            cls={m}
          >
            Blockquote
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleCodeBlock().run())
            }
            shortcut=""
            cls={m}
          >
            Code block
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().setHorizontalRule().run())
            }
            shortcut=""
            cls={m}
          >
            Horizontal rule
          </Item>
          <Sep />
          <Item
            onClick={() => {
              setOpen(null);
              const url = window.prompt("URL to link to:");
              if (url) {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: url })
                  .run();
              }
            }}
            shortcut=""
            cls={m}
          >
            Link…
          </Item>
        </Menu>
      )}

      {/* --- Format --- */}
      <Trigger label="Format" openId="format" open={open} setOpen={setOpen} />
      {open === "format" && (
        <Menu x={134}>
          <Item
            onClick={() => run(() => editor.chain().focus().toggleBold().run())}
            shortcut="⌘B"
            cls={m}
          >
            Bold
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleItalic().run())
            }
            shortcut="⌘I"
            cls={m}
          >
            Italic
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleUnderline().run())
            }
            shortcut="⌘U"
            cls={m}
          >
            Underline
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleStrike().run())
            }
            shortcut=""
            cls={m}
          >
            Strikethrough
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().toggleHighlight().run())
            }
            shortcut=""
            cls={m}
          >
            Highlight
          </Item>
          <Sep />
          <Item
            onClick={() =>
              run(() => editor.chain().focus().setTextAlign("left").run())
            }
            shortcut="⌘⇧L"
            cls={m}
          >
            Align left
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().setTextAlign("center").run())
            }
            shortcut="⌘⇧E"
            cls={m}
          >
            Align center
          </Item>
          <Item
            onClick={() =>
              run(() => editor.chain().focus().setTextAlign("right").run())
            }
            shortcut="⌘⇧R"
            cls={m}
          >
            Align right
          </Item>
          <Sep />
          <Item
            onClick={() =>
              run(() =>
                editor.chain().focus().unsetAllMarks().clearNodes().run()
              )
            }
            shortcut="⌘\\"
            cls={m}
          >
            Clear formatting
          </Item>
        </Menu>
      )}

      {/* --- View --- */}
      <Trigger label="View" openId="view" open={open} setOpen={setOpen} />
      {open === "view" && (
        <Menu x={178}>
          <Item onClick={() => run(onToggleFocus)} shortcut="⇧F" cls={m}>
            Focus mode
          </Item>
          <Item
            onClick={() =>
              run(() => window.dispatchEvent(new CustomEvent("ajaia:open-palette")))
            }
            shortcut="⌘K"
            cls={m}
          >
            Command palette
          </Item>
        </Menu>
      )}

      <span className="ml-2 hidden text-[11px] text-slate-400 sm:inline">
        ⌘K for anything · type / in the editor for blocks
      </span>
      <span className="ml-auto hidden font-mono text-[10px] text-slate-400 md:inline">
        doc·{documentId.slice(0, 6)}
      </span>
    </div>
  );
}

// ---------- internals ----------

const menuItemClass =
  "flex w-full cursor-pointer items-center justify-between gap-6 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

function Trigger({
  label,
  openId,
  open,
  setOpen,
}: {
  label: string;
  openId: string;
  open: string | null;
  setOpen: (v: string | null) => void;
}) {
  const isOpen = open === openId;
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={isOpen}
      onMouseEnter={() => {
        // If *any* menu is open, hovering a sibling switches to it (Docs-like).
        if (open && open !== openId) setOpen(openId);
      }}
      onClick={() => setOpen(isOpen ? null : openId)}
      className={cn(
        "rounded px-2 py-1 font-medium",
        isOpen
          ? "bg-slate-900 text-white"
          : "hover:bg-slate-100"
      )}
    >
      {label}
    </button>
  );
}

function Menu({ x, children }: { x: number; children: React.ReactNode }) {
  return (
    <div
      role="menu"
      className="absolute top-[calc(100%+2px)] z-40 min-w-[220px] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5"
      style={{ left: x }}
    >
      {children}
    </div>
  );
}

function Item({
  onClick,
  disabled,
  shortcut,
  children,
  cls,
}: {
  onClick: () => void;
  disabled?: boolean;
  shortcut: string;
  children: React.ReactNode;
  cls: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cls}
    >
      <span>{children}</span>
      {shortcut && (
        <span className="font-mono text-[10px] text-slate-400">{shortcut}</span>
      )}
    </button>
  );
}

function Sep() {
  return <div className="my-1 h-px bg-slate-100" aria-hidden />;
}

// ---------- tiptap JSON → markdown (scoped to blocks we actually support) ----------

type N = {
  type?: string;
  text?: string;
  marks?: { type: string }[];
  attrs?: { level?: number };
  content?: N[];
};

function toMarkdown(doc: unknown): string {
  const root = doc as N;
  return (root.content || []).map(block).join("\n\n").trim() + "\n";
}

function block(node: N): string {
  switch (node.type) {
    case "paragraph":
      return inline(node);
    case "heading": {
      const lvl = Math.max(1, Math.min(6, node.attrs?.level || 1));
      return `${"#".repeat(lvl)} ${inline(node)}`;
    }
    case "bulletList":
      return (node.content || [])
        .map((li) => `- ${inline(li).replace(/\n/g, "\n  ")}`)
        .join("\n");
    case "orderedList":
      return (node.content || [])
        .map((li, i) => `${i + 1}. ${inline(li).replace(/\n/g, "\n   ")}`)
        .join("\n");
    case "blockquote":
      return (node.content || [])
        .map((c) => `> ${inline(c)}`)
        .join("\n");
    case "codeBlock":
      return "```\n" + (node.content || []).map(inline).join("\n") + "\n```";
    case "horizontalRule":
      return "---";
    case "listItem":
      return (node.content || []).map(block).join("\n");
    default:
      return inline(node);
  }
}

function inline(node: N): string {
  if (node.type === "text") return applyMarks(node.text || "", node.marks);
  return (node.content || []).map(inline).join("");
}

function applyMarks(text: string, marks?: { type: string }[]): string {
  if (!marks?.length) return text;
  let t = text;
  for (const m of marks) {
    if (m.type === "bold") t = `**${t}**`;
    else if (m.type === "italic") t = `*${t}*`;
    else if (m.type === "code") t = "`" + t + "`";
    else if (m.type === "underline") t = `<u>${t}</u>`;
    else if (m.type === "strike") t = `~~${t}~~`;
    else if (m.type === "highlight") t = `==${t}==`;
  }
  return t;
}
