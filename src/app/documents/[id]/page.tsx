import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getDocumentForUser,
  ForbiddenError,
  NotFoundError,
} from "@/lib/access";
import DocumentEditor from "@/components/DocumentEditor";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) return { title: "Document · Ajaia Docs" };
  try {
    const { doc } = await getDocumentForUser(params.id, session.userId);
    return { title: `${doc.title} · Ajaia Docs` };
  } catch {
    return { title: "Document · Ajaia Docs" };
  }
}

export default async function DocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  let result;
  try {
    result = await getDocumentForUser(params.id, session.userId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) redirect("/unauthorized");
    throw e;
  }

  const { doc, isOwner } = result;

  // Parse TipTap JSON from its string column.
  let contentJson: unknown;
  try {
    contentJson = JSON.parse(doc.contentJson);
  } catch {
    contentJson = { type: "doc", content: [{ type: "paragraph" }] };
  }

  return (
    <DocumentEditor
      session={session}
      isOwner={isOwner}
      document={{
        id: doc.id,
        title: doc.title,
        // Cast: validated shape on save; client TipTap will complain loudly
        // if this is malformed, which is fine for a dev-time surfaced bug.
        contentJson: contentJson as never,
        owner: {
          id: doc.owner.id,
          name: doc.owner.name,
          email: doc.owner.email,
        },
        shares: doc.shares.map(
          (s: { userId: string; user: { name: string; email: string } }) => ({
            userId: s.userId,
            name: s.user.name,
            email: s.user.email,
          })
        ),
      }}
    />
  );
}
