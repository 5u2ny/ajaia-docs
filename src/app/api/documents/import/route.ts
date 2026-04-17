import { NextResponse } from "next/server";
import { requireSession, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marked } from "marked";
import { extractPlainText } from "@/lib/utils";

/**
 * POST /api/documents/import — accepts a multipart upload of a .txt or .md
 * file and creates a new editable document from its contents.
 *
 * Why only .txt and .md?
 *   The scope section of the brief calls for one "product relevant" upload
 *   flow and explicitly suggests these two. Supporting .docx would mean
 *   pulling in a heavy parser (mammoth.js) and handling format quirks —
 *   outside the 4–6 hour budget.
 *
 * Import pipeline:
 *   .txt → split on newlines, each non-empty line becomes a paragraph.
 *   .md  → parse to HTML via `marked`, then HTML → TipTap JSON via a small
 *          recursive walker. We do not pull in a full DOM, so we use a
 *          lightweight regex-based converter for the subset of Markdown
 *          we care about (paragraphs, headings, bold, italic, lists).
 */
const MAX_BYTES = 1 * 1024 * 1024; // 1 MB cap
const ALLOWED_EXTENSIONS = [".txt", ".md", ".markdown"];

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Upload a file under the field name 'file'" },
        { status: 400 }
      );
    }

    const name = (file.name || "upload").toLowerCase();
    const ext = name.substring(name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Only ${ALLOWED_EXTENSIONS.join(", ")} files are supported.` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }

    const text = await file.text();

    // Title defaults to filename (without extension); fall back to "Imported document".
    const derivedTitle =
      file.name.replace(/\.(txt|md|markdown)$/i, "").trim() ||
      "Imported document";

    // Turn the file contents into a TipTap JSON doc.
    const contentJson =
      ext === ".txt" ? txtToTiptap(text) : mdToTiptap(text);
    const plainTextPreview = extractPlainText(contentJson);

    const doc = await prisma.document.create({
      data: {
        title: derivedTitle.slice(0, 200),
        contentJson: JSON.stringify(contentJson),
        plainTextPreview,
        ownerId: session.userId,
      },
      select: { id: true, title: true },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Failed to import file" },
      { status: 500 }
    );
  }
}

// --- TipTap conversion helpers -------------------------------------------

type TTNode = {
  type: string;
  content?: TTNode[];
  text?: string;
  marks?: { type: string }[];
  attrs?: Record<string, unknown>;
};

function txtToTiptap(text: string): TTNode {
  const lines = text.split(/\r?\n/);
  const content: TTNode[] = [];
  for (const line of lines) {
    if (line.trim() === "") {
      content.push({ type: "paragraph" });
    } else {
      content.push({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      });
    }
  }
  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

/**
 * Markdown → TipTap. `marked` gives us tokens; we map them to TipTap nodes.
 * Covers paragraphs, headings (1–3), bold, italic, strikethrough, inline code,
 * bullet/ordered lists, blockquote, and code blocks. Anything exotic gets
 * flattened to plain text so import doesn't blow up.
 */
function mdToTiptap(md: string): TTNode {
  const tokens = marked.lexer(md);
  const content: TTNode[] = [];

  for (const tok of tokens) {
    const node = tokenToNode(tok);
    if (node) content.push(...(Array.isArray(node) ? node : [node]));
  }

  if (content.length === 0) content.push({ type: "paragraph" });
  return { type: "doc", content };
}

function tokenToNode(tok: unknown): TTNode | TTNode[] | null {
  const t = tok as { type?: string };
  switch (t.type) {
    case "heading": {
      const h = tok as { depth: number; text: string };
      return {
        type: "heading",
        attrs: { level: Math.min(Math.max(h.depth, 1), 3) },
        content: inlineToNodes(h.text),
      };
    }
    case "paragraph": {
      const p = tok as { text: string };
      return {
        type: "paragraph",
        content: inlineToNodes(p.text),
      };
    }
    case "list": {
      const l = tok as {
        ordered: boolean;
        items: { text: string }[];
      };
      return {
        type: l.ordered ? "orderedList" : "bulletList",
        content: l.items.map((item) => ({
          type: "listItem",
          content: [
            { type: "paragraph", content: inlineToNodes(item.text) },
          ],
        })),
      };
    }
    case "blockquote": {
      const bq = tok as { text: string };
      return {
        type: "blockquote",
        content: [
          { type: "paragraph", content: inlineToNodes(bq.text) },
        ],
      };
    }
    case "code": {
      const c = tok as { text: string };
      return {
        type: "codeBlock",
        content: [{ type: "text", text: c.text }],
      };
    }
    case "space":
      return null;
    default: {
      const anyTok = tok as { text?: string; raw?: string };
      const text = anyTok.text ?? anyTok.raw ?? "";
      if (!text.trim()) return null;
      return {
        type: "paragraph",
        content: [{ type: "text", text }],
      };
    }
  }
}

/**
 * Handles inline formatting within a block: **bold**, *italic*, `code`,
 * ~~strike~~. Anything that doesn't match falls through as plain text.
 */
function inlineToNodes(input: string): TTNode[] {
  if (!input) return [];
  const result: TTNode[] = [];
  // Ordered: bold/italic compound, bold, italic, code, strike.
  const pattern =
    /(\*\*\*([^*]+)\*\*\*)|(\*\*([^*]+)\*\*)|(__([^_]+)__)|(\*([^*]+)\*)|(_([^_]+)_)|(`([^`]+)`)|(~~([^~]+)~~)/g;

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(input)) !== null) {
    if (m.index > last) {
      result.push({ type: "text", text: input.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      // ***both***
      result.push({
        type: "text",
        text: m[2],
        marks: [{ type: "bold" }, { type: "italic" }],
      });
    } else if (m[4] !== undefined || m[6] !== undefined) {
      // **bold** or __bold__
      result.push({
        type: "text",
        text: m[4] ?? m[6],
        marks: [{ type: "bold" }],
      });
    } else if (m[8] !== undefined || m[10] !== undefined) {
      // *italic* or _italic_
      result.push({
        type: "text",
        text: m[8] ?? m[10],
        marks: [{ type: "italic" }],
      });
    } else if (m[12] !== undefined) {
      // `code`
      result.push({
        type: "text",
        text: m[12],
        marks: [{ type: "code" }],
      });
    } else if (m[14] !== undefined) {
      // ~~strike~~
      result.push({
        type: "text",
        text: m[14],
        marks: [{ type: "strike" }],
      });
    }
    last = m.index + m[0].length;
  }
  if (last < input.length) {
    result.push({ type: "text", text: input.slice(last) });
  }
  return result.length ? result : [{ type: "text", text: input }];
}
