/**
 * Tiny class-name joiner. `clsx` turns `cn("a", cond && "b")` into
 * a clean space-separated string and drops falsy values.
 */
import { clsx, type ClassValue } from "clsx";

export function cn(...classes: ClassValue[]) {
  return clsx(classes);
}

/** "2 minutes ago", "3 days ago", etc. Used for document cards. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/**
 * Walks a TipTap JSON document and returns plain text, good enough for
 * a dashboard preview. Stops collecting at ~300 chars.
 */
export function extractPlainText(tiptapJson: unknown, maxLen = 300): string {
  let text = "";
  function walk(node: unknown): void {
    if (text.length > maxLen) return;
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") {
      text += n.text;
    }
    if (n.type === "hardBreak" || n.type === "paragraph" || n.type === "heading") {
      // Treat block boundaries as spaces so preview doesn't run words together.
      if (text.length > 0 && !text.endsWith(" ")) text += " ";
    }
    if (Array.isArray(n.content)) {
      for (const child of n.content) walk(child);
    }
  }
  walk(tiptapJson);
  return text.trim().slice(0, maxLen);
}
