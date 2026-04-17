"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
  Code,
  Code2,
  Minus,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
  Undo2,
  Redo2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { editor: Editor | null };

/**
 * Google-Docs-style ribbon.
 *
 * The ribbon is organized into clusters separated by dividers:
 *   [Undo/Redo] | [Style picker] | [B I U S Highlight] | [Align L/C/R]
 *   | [Bulleted / Numbered] | [Quote / Inline-code / Code-block / HR]
 *   | [Link] [Clear formatting]
 *
 * Each button calls `editor.chain().focus().toggleX().run()` — TipTap's
 * chain pattern composes commands and is how you trigger formatting.
 */
export default function EditorToolbar({ editor }: Props) {
  if (!editor) return <div className="h-11" aria-hidden />;

  const can = editor.can();

  return (
    <div className="flex flex-wrap items-center gap-1 border-y border-slate-200 bg-white/95 px-2 py-2 backdrop-blur">
      {/* Undo / Redo */}
      <Btn
        label="Undo (⌘Z)"
        icon={<Undo2 className="h-4 w-4" />}
        disabled={!can.undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <Btn
        label="Redo (⌘⇧Z)"
        icon={<Redo2 className="h-4 w-4" />}
        disabled={!can.redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <Divider />

      {/* Paragraph / Heading dropdown */}
      <StylePicker editor={editor} />
      <Divider />

      {/* Marks */}
      <Btn
        label="Bold (⌘B)"
        icon={<Bold className="h-4 w-4" />}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <Btn
        label="Italic (⌘I)"
        icon={<Italic className="h-4 w-4" />}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <Btn
        label="Underline (⌘U)"
        icon={<Underline className="h-4 w-4" />}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <Btn
        label="Strikethrough"
        icon={<Strikethrough className="h-4 w-4" />}
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <Btn
        label="Highlight"
        icon={<Highlighter className="h-4 w-4" />}
        active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      />
      <Divider />

      {/* Alignment */}
      <Btn
        label="Align left (⌘⇧L)"
        icon={<AlignLeft className="h-4 w-4" />}
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <Btn
        label="Align center (⌘⇧E)"
        icon={<AlignCenter className="h-4 w-4" />}
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <Btn
        label="Align right (⌘⇧R)"
        icon={<AlignRight className="h-4 w-4" />}
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <Divider />

      {/* Lists */}
      <Btn
        label="Bulleted list"
        icon={<List className="h-4 w-4" />}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <Btn
        label="Numbered list"
        icon={<ListOrdered className="h-4 w-4" />}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <Divider />

      {/* Blocks */}
      <Btn
        label="Blockquote"
        icon={<Quote className="h-4 w-4" />}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <Btn
        label="Inline code"
        icon={<Code className="h-4 w-4" />}
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
      <Btn
        label="Code block"
        icon={<Code2 className="h-4 w-4" />}
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <Btn
        label="Horizontal rule"
        icon={<Minus className="h-4 w-4" />}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
      <Divider />

      {/* Link + clear */}
      <Btn
        label="Link"
        icon={<LinkIcon className="h-4 w-4" />}
        active={editor.isActive("link")}
        onClick={() => promptForLink(editor)}
      />
      <Btn
        label="Clear formatting"
        icon={<Eraser className="h-4 w-4" />}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      />
    </div>
  );
}

/* ----------------------------- Style picker ----------------------------- */

function StylePicker({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const currentLabel = editor.isActive("heading", { level: 1 })
    ? "Heading 1"
    : editor.isActive("heading", { level: 2 })
    ? "Heading 2"
    : editor.isActive("heading", { level: 3 })
    ? "Heading 3"
    : "Normal text";

  const items: Array<{
    label: string;
    active: boolean;
    className: string;
    run: () => void;
  }> = [
    {
      label: "Normal text",
      active: editor.isActive("paragraph") && !editor.isActive("heading"),
      className: "text-sm text-slate-700",
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      label: "Heading 1",
      active: editor.isActive("heading", { level: 1 }),
      className: "text-2xl font-bold text-slate-900",
      run: () =>
        editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      label: "Heading 2",
      active: editor.isActive("heading", { level: 2 }),
      className: "text-xl font-semibold text-slate-900",
      run: () =>
        editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Heading 3",
      active: editor.isActive("heading", { level: 3 }),
      className: "text-base font-semibold text-slate-900",
      run: () =>
        editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-transparent px-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
      >
        <span className="min-w-[84px] text-left">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                item.run();
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-slate-100",
                item.active && "bg-slate-50"
              )}
            >
              <span className={item.className}>{item.label}</span>
              {item.active && (
                <span className="text-[10px] text-slate-400">●</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Link prompt ------------------------------ */

function promptForLink(editor: Editor) {
  // If a link is already active under the caret, clicking the button
  // unlinks. Otherwise we prompt for a URL.
  if (editor.isActive("link")) {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  if (typeof window === "undefined") return;
  const previous = (editor.getAttributes("link").href as string) || "";
  const url = window.prompt("Enter URL", previous || "https://");
  if (url === null) return; // user cancelled
  const trimmed = url.trim();
  if (trimmed === "") {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    return;
  }
  // Basic safety: only allow http(s) / mailto schemes.
  const safe = /^(https?:\/\/|mailto:)/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
}

/* ------------------------------ Primitives ------------------------------ */

function Btn({
  label,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100",
        active && "bg-slate-900 text-white hover:bg-slate-800",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {icon}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden />;
}
