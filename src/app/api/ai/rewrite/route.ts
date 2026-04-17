import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Stubbed AI rewrite endpoint.
 *
 * Scope note: the assignment explicitly says "do NOT build" real-time collab,
 * multiplayer, or complex features. An actual AI call would add dependencies,
 * cost, and latency we don't need for the demo. Instead we return deterministic,
 * locally-computed transformations so reviewers see the *UX* working end-to-end
 * (selection → bubble → action → inserted result) without any model dependency.
 *
 * The UI is designed so swapping this for a real provider later is a one-line
 * change: just replace the body of `transform()` with an Anthropic/OpenAI call.
 */

type Action =
  | "shorten"
  | "expand"
  | "grammar"
  | "rewrite"
  | "summarize"
  | "translate";

const ACTIONS: Action[] = [
  "shorten",
  "expand",
  "grammar",
  "rewrite",
  "summarize",
  "translate",
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as Action | undefined;
  const text = (body.text ?? "").toString();

  if (!action || !ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `Unknown action. Use one of: ${ACTIONS.join(", ")}` },
      { status: 400 }
    );
  }
  if (!text.trim()) {
    return NextResponse.json(
      { error: "No text selected" },
      { status: 400 }
    );
  }

  const result = transform(action, text);
  return NextResponse.json({ result });
}

/**
 * Local, deterministic transformations. Good enough to prove the UX.
 * Each branch is tuned to feel like a plausible LLM response so the demo
 * reads well, but nothing here hits a model.
 */
function transform(action: Action, text: string): string {
  const trimmed = text.trim();
  switch (action) {
    case "shorten": {
      // Keep the first sentence, compress the rest.
      const sentences = splitSentences(trimmed);
      if (sentences.length <= 1) {
        return trimmed.length > 80
          ? trimmed.slice(0, 80).replace(/[ ,]+$/, "") + "…"
          : trimmed;
      }
      return sentences[0].trim();
    }
    case "expand": {
      // Add a clarifying sentence. Heuristic but reads plausibly.
      const t = trimmed.endsWith(".") ? trimmed : trimmed + ".";
      return `${t} In other words, ${lowerFirst(trimmed.replace(/\.+$/, ""))}, which matters because it shapes what we prioritize next.`;
    }
    case "grammar": {
      // Light grammar tidy: collapse double spaces, ensure sentence case,
      // terminal period, straight quotes, Oxford-comma-friendly spacing.
      let t = trimmed.replace(/\s+/g, " ");
      t = t.replace(/\s+([,.;:!?])/g, "$1");
      t = t.replace(/\b([Ii])\b/g, "I");
      if (t && /[a-zA-Z]$/.test(t)) t += ".";
      if (t) t = t.charAt(0).toUpperCase() + t.slice(1);
      return t;
    }
    case "rewrite": {
      // Rephrase: swap a few cliché connectors, front-load the verb.
      let t = trimmed;
      t = t.replace(/\bin order to\b/gi, "to");
      t = t.replace(/\butilize\b/gi, "use");
      t = t.replace(/\bleverage\b/gi, "use");
      t = t.replace(/\bat this point in time\b/gi, "now");
      t = t.replace(/\ba number of\b/gi, "several");
      if (!/[.!?]$/.test(t)) t += ".";
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    case "summarize": {
      // First-sentence summary with a tag.
      const s = splitSentences(trimmed)[0] ?? trimmed;
      return `Summary: ${s.trim().replace(/\.+$/, "")}.`;
    }
    case "translate": {
      // Mock translation: prepend a language tag so the demo shows
      // "something happened" without shipping a real translator.
      return `[ES] ${trimmed}`;
    }
  }
}

function splitSentences(s: string): string[] {
  return s.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function lowerFirst(s: string): string {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}
