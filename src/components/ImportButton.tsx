"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

const ALLOWED = ".txt,.md,.markdown";

export default function ImportButton() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/documents/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Import failed");
        return;
      }
      const data = await res.json();
      router.push(`/documents/${data.document.id}`);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setUploading(false);
      // Reset so the same file can be re-selected if needed.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end">
      <label
        className={
          "inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 " +
          (uploading ? "pointer-events-none opacity-60" : "")
        }
      >
        <Upload className="h-4 w-4" aria-hidden />
        {uploading ? "Importing…" : "Import .txt / .md"}
        <input
          ref={inputRef}
          onChange={handleFile}
          type="file"
          accept={ALLOWED}
          className="hidden"
        />
      </label>
      <p className="mt-1 text-[10px] text-slate-400">
        Supported: .txt, .md (up to 1 MB)
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
