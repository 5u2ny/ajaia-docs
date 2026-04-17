"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent, JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TipTapLink from "@tiptap/extension-link";
import CharacterCount from "@tiptap/extension-character-count";
import { ArrowLeft, Share2, Focus, Command } from "lucide-react";
import TopBar from "./TopBar";
import MenuBar from "./MenuBar";
import EditorToolbar from "./EditorToolbar";
import SaveStatus, { type SaveState } from "./SaveStatus";
import ShareModal, { type Collaborator } from "./ShareModal";
import SlashMenu, { type SlashMenuHandle } from "./SlashMenu";
import AIBubble from "./AIBubble";
import Outline from "./Outline";
import CommandPalette from "./CommandPalette";
import { extractPlainText } from "@/lib/utils";

type Props = {
  session: { userId: string; email: string; name: string };
  document: {
    id: string;
    title: string;
    contentJson: JSONContent;
    owner: { id: string; name: string; email: string };
    shares: Collaborator[];
  };
  isOwner: boolean;
};

const AUTOSAVE_DEBOUNCE_MS = 1000;

export default function DocumentEditor({ session, document, isOwner }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(document.title);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  // Track the latest content/title via refs so the save function always sees
  // the newest values even when debounced or retried.
  const latestContent = useRef<JSONContent>(document.contentJson);
  const latestTitle = useRef<string>(document.title);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlight = useRef<boolean>(false);
  const pendingSave = useRef<boolean>(false);

  // SlashMenu imperative handle — we drive it from TipTap's keydown.
  const slashHandleRef = useRef<SlashMenuHandle | null>(null);
  const slashActiveRef = useRef<{ startPos: number; query: string } | null>(null);

  // Container ref for positioning the AI bubble relative to the editor.
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing… (tip: type / for blocks, ⌘K for commands)",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
      Highlight.configure({ multicolor: false }),
      TipTapLink.configure({
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          rel: "noopener noreferrer nofollow",
          target: "_blank",
          class: "tiptap-link",
        },
      }),
      CharacterCount.configure({}),
    ],
    content: document.contentJson,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap prose-none",
        spellCheck: "true",
      },
      handleKeyDown(view, event) {
        // --- Slash-menu hotkey interception ---
        // When the menu is already open, forward arrow/enter/escape to it.
        if (slashHandleRef.current?.isOpen()) {
          if (slashHandleRef.current.handleKey(event.key)) {
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      latestContent.current = editor.getJSON();
      scheduleSave();
      updateWordCount(editor.getText());
      maybeUpdateSlashQuery(editor);
    },
    onSelectionUpdate() {
      // If the caret moves outside the slash range, close the menu.
      if (slashActiveRef.current && editor) {
        const { from } = editor.state.selection;
        if (from < slashActiveRef.current.startPos) {
          slashActiveRef.current = null;
          slashHandleRef.current?.close();
        }
      }
    },
  });

  // Open the slash menu when the user types "/" at the start of a word.
  useEffect(() => {
    if (!editor) return;
    function onKeyUp(event: KeyboardEvent) {
      if (!editor) return;
      if (event.key === "/" && !slashHandleRef.current?.isOpen()) {
        const sel = typeof window !== "undefined" ? window.getSelection() : null;
        if (!sel || sel.rangeCount === 0) return;
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        // Check the char before the caret is actually "/" — avoids false positives
        // inside existing text runs.
        const { from } = editor.state.selection;
        const prev = editor.state.doc.textBetween(Math.max(0, from - 1), from);
        if (prev !== "/") return;
        slashActiveRef.current = { startPos: from, query: "" };
        slashHandleRef.current?.open({
          top: rect.bottom + 6,
          left: rect.left,
        });
      }
    }
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener("keyup", onKeyUp);
    return () => dom.removeEventListener("keyup", onKeyUp);
  }, [editor]);

  function maybeUpdateSlashQuery(ed: NonNullable<typeof editor>) {
    if (!slashActiveRef.current || !slashHandleRef.current?.isOpen()) return;
    const { startPos } = slashActiveRef.current;
    const { from } = ed.state.selection;
    if (from < startPos) {
      slashActiveRef.current = null;
      slashHandleRef.current.close();
      return;
    }
    // Text after the "/" — we stored startPos AFTER the slash got typed.
    const q = ed.state.doc.textBetween(startPos, from);
    slashActiveRef.current.query = q;
    slashHandleRef.current.setQuery(q);
  }

  function updateWordCount(text: string) {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
  }

  // Seed word count from initial content once the editor mounts.
  useEffect(() => {
    if (editor) updateWordCount(editor.getText());
  }, [editor]);

  const saveNow = useCallback(async () => {
    if (saveInFlight.current) {
      pendingSave.current = true;
      return;
    }
    saveInFlight.current = true;
    setSaveState("saving");
    setSaveError(null);

    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: latestTitle.current.trim() || "Untitled document",
          contentJson: latestContent.current,
          plainTextPreview: extractPlainText(latestContent.current),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      setSaveState("saved");
      setLastSavedAt(new Date());
      router.refresh();
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "Unknown error");
      scheduleSave(3000);
    } finally {
      saveInFlight.current = false;
      if (pendingSave.current) {
        pendingSave.current = false;
        saveNow();
      }
    }
  }, [document.id, router]);

  const scheduleSave = useCallback(
    (delayMs: number = AUTOSAVE_DEBOUNCE_MS) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveNow();
      }, delayMs);
    },
    [saveNow]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setTitle(value);
    latestTitle.current = value;
    scheduleSave();
  }

  function handleTitleBlur() {
    if (!title.trim()) {
      setTitle("Untitled document");
      latestTitle.current = "Untitled document";
      scheduleSave(0);
    }
  }

  // F toggles focus mode — standard iA Writer convention. We ignore it while
  // the user is actively typing in the editor or title input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F" && (e.shiftKey) && !e.metaKey && !e.ctrlKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
        e.preventDefault();
        setFocusMode((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sync focus mode onto body so globals.css can react.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const cls = "focus-mode";
    if (focusMode) window.document.body.classList.add(cls);
    else window.document.body.classList.remove(cls);
    return () => {
      window.document.body.classList.remove(cls);
    };
  }, [focusMode]);

  const badge = useMemo(
    () => (
      <span
        className={
          isOwner
            ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700"
            : "rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700"
        }
      >
        {isOwner ? "Owner" : `Shared by ${document.owner.name}`}
      </span>
    ),
    [isOwner, document.owner.name]
  );

  const readingMin = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className={focusMode ? "editor-page is-focus" : "editor-page"}>
      <div className="app-chrome">
        <TopBar userName={session.name} userEmail={session.email}>
          <span className="text-slate-300">/</span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Dashboard
          </Link>
        </TopBar>
        <div className="menubar-sticky">
          <MenuBar
            editor={editor}
            documentId={document.id}
            documentTitle={title}
            onOpenShare={() => setShareOpen(true)}
            onToggleFocus={() => setFocusMode((v) => !v)}
            canShare={isOwner}
          />
        </div>
      </div>

      <main className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <Outline editor={editor} initialContent={document.contentJson} />

        <section className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">{badge}</div>
            <div className="flex items-center gap-3">
              <SaveStatus
                state={saveState}
                lastSavedAt={lastSavedAt}
                errorMessage={saveError}
              />
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                title="Toggle focus mode (shift+F)"
                aria-pressed={focusMode}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Focus className="h-3.5 w-3.5" aria-hidden />
                {focusMode ? "Exit focus" : "Focus"}
              </button>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden />
                  Share
                </button>
              )}
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            aria-label="Document title"
            className="mt-4 w-full border-none bg-transparent text-3xl font-bold tracking-tight text-slate-900 placeholder-slate-300 outline-none focus:ring-0"
            placeholder="Untitled document"
          />

          <div className="mt-4">
            <div className="toolbar-sticky">
              <EditorToolbar editor={editor} />
            </div>

            <div
              ref={editorContainerRef}
              className="relative mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <EditorContent editor={editor} />
              <AIBubble editor={editor} containerRef={editorContainerRef} />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                {wordCount.toLocaleString()} word{wordCount === 1 ? "" : "s"} ·{" "}
                {readingMin} min read
              </span>
              <span className="inline-flex items-center gap-1">
                <Command className="h-3 w-3" aria-hidden />
                <kbd className="rounded bg-slate-100 px-1">⌘ K</kbd> commands ·{" "}
                <kbd className="rounded bg-slate-100 px-1">/</kbd> blocks ·{" "}
                <kbd className="rounded bg-slate-100 px-1">Shift F</kbd> focus
              </span>
            </div>
          </div>
        </section>
      </main>

      <SlashMenu
        editor={editor}
        onHandleRef={(h) => (slashHandleRef.current = h)}
      />
      <CommandPalette onToggleFocus={() => setFocusMode((v) => !v)} />

      {isOwner && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          documentId={document.id}
          owner={document.owner}
          initialCollaborators={document.shares}
        />
      )}
    </div>
  );
}
