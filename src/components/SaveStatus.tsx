"use client";

import { Check, CloudOff, Loader2 } from "lucide-react";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  state: SaveState;
  lastSavedAt?: Date | null;
  errorMessage?: string | null;
};

export default function SaveStatus({ state, lastSavedAt, errorMessage }: Props) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-rose-600"
        title={errorMessage || ""}
      >
        <CloudOff className="h-3 w-3" aria-hidden />
        Save failed — retrying
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    const t = lastSavedAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check className="h-3 w-3" aria-hidden />
        Saved at {t}
      </span>
    );
  }
  return <span className="text-xs text-slate-400">Not saved yet</span>;
}
