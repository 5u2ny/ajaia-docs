"use client";

import { useState } from "react";
import { X, UserPlus, Trash2 } from "lucide-react";

export type Collaborator = {
  userId: string;
  name: string;
  email: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  documentId: string;
  owner: { id: string; name: string; email: string };
  initialCollaborators: Collaborator[];
};

export default function ShareModal({
  open,
  onClose,
  documentId,
  owner,
  initialCollaborators,
}: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not share");
        return;
      }
      // Update local list (dedupe by userId)
      setCollaborators((prev) => {
        if (prev.some((c) => c.userId === body.share.userId)) return prev;
        return [
          ...prev,
          {
            userId: body.share.userId,
            name: body.share.name,
            email: body.share.email,
          },
        ];
      });
      setEmail("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(target: Collaborator) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/share?email=${encodeURIComponent(
          target.email
        )}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Could not remove");
        return;
      }
      setCollaborators((prev) =>
        prev.filter((c) => c.userId !== target.userId)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="share-title" className="text-lg font-semibold text-slate-900">
              Share this document
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Enter a demo user&apos;s email to grant edit access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleAdd} className="mt-5 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@demo.app"
            required
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Share
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-600">
            {error}
          </p>
        )}

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Access
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-100">
            <li className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-900">{owner.name}</p>
                <p className="text-xs text-slate-500">{owner.email}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                Owner
              </span>
            </li>
            {collaborators.length === 0 && (
              <li className="px-3 py-3 text-xs italic text-slate-400">
                No one else has access yet.
              </li>
            )}
            {collaborators.map((c) => (
              <li
                key={c.userId}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700">
                    Editor
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(c)}
                    aria-label={`Remove access for ${c.email}`}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
