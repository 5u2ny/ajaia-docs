"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function NewDocumentButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleClick() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to create document");
        return;
      }
      const data = await res.json();
      router.push(`/documents/${data.document.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={creating}
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
    >
      <Plus className="h-4 w-4" aria-hidden />
      {creating ? "Creating…" : "New document"}
    </button>
  );
}
