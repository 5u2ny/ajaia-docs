import Link from "next/link";
import { timeAgo } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  plainTextPreview: string;
  updatedAt: string | Date;
  badge?: { label: string; tone: "owned" | "shared" };
  sharedBy?: string;
};

export default function DocumentCard({
  id,
  title,
  plainTextPreview,
  updatedAt,
  badge,
  sharedBy,
}: Props) {
  return (
    <Link
      href={`/documents/${id}`}
      className="group block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-700">
          {title || "Untitled document"}
        </h3>
        {badge && (
          <span
            className={
              badge.tone === "owned"
                ? "shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700"
                : "shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-700"
            }
          >
            {badge.label}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-xs text-slate-500">
        {plainTextPreview || (
          <span className="italic text-slate-400">No content yet</span>
        )}
      </p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
        <span>Updated {timeAgo(updatedAt)}</span>
        {sharedBy && <span className="truncate">by {sharedBy}</span>}
      </div>
    </Link>
  );
}
