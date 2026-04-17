import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import TopBar from "@/components/TopBar";
import DocumentCard from "@/components/DocumentCard";
import NewDocumentButton from "@/components/NewDocumentButton";
import ImportButton from "@/components/ImportButton";
import CommandPalette from "@/components/CommandPalette";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Ajaia Docs" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fetch owned + shared documents in parallel for a fast first paint.
  const [owned, shared] = await Promise.all([
    prisma.document.findMany({
      where: { ownerId: session.userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        plainTextPreview: true,
        updatedAt: true,
      },
    }),
    prisma.documentShare.findMany({
      where: { userId: session.userId },
      orderBy: { document: { updatedAt: "desc" } },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            plainTextPreview: true,
            updatedAt: true,
            owner: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <CommandPalette />
      <TopBar userName={session.name} userEmail={session.email} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, {session.name.split(" ")[0]}.
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Create a document, import a file, or open one shared with you.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <ImportButton />
            <NewDocumentButton />
          </div>
        </div>

        <Section title="Your documents" count={owned.length}>
          {owned.length === 0 ? (
            <EmptyState
              title="No documents yet"
              description="Click “New document” to create your first one, or import a .txt / .md file."
            />
          ) : (
            <Grid>
              {owned.map((d) => (
                <DocumentCard
                  key={d.id}
                  id={d.id}
                  title={d.title}
                  plainTextPreview={d.plainTextPreview}
                  updatedAt={d.updatedAt}
                  badge={{ label: "Owned", tone: "owned" }}
                />
              ))}
            </Grid>
          )}
        </Section>

        <Section title="Shared with me" count={shared.length}>
          {shared.length === 0 ? (
            <EmptyState
              title="Nothing shared with you yet"
              description="When another user shares a document with you, it’ll show up here."
            />
          ) : (
            <Grid>
              {shared.map((s) => (
                <DocumentCard
                  key={s.id}
                  id={s.document.id}
                  title={s.document.title}
                  plainTextPreview={s.document.plainTextPreview}
                  updatedAt={s.document.updatedAt}
                  badge={{ label: "Shared", tone: "shared" }}
                  sharedBy={s.document.owner.name}
                />
              ))}
            </Grid>
          )}
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2 text-xs text-slate-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{description}</p>
    </div>
  );
}
