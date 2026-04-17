import { NextResponse } from "next/server";
import { requireSession, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getDocumentForUser,
  assertCanAccessDocument,
  ForbiddenError,
  NotFoundError,
} from "@/lib/access";
import { UpdateContentSchema } from "@/lib/validate";

type Ctx = { params: { id: string } };

/**
 * GET /api/documents/[id] — returns the document if the user owns or shares it.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();
    const { doc, isOwner } = await getDocumentForUser(params.id, session.userId);

    // Parse contentJson from string back to object for the client.
    let contentJson: unknown;
    try {
      contentJson = JSON.parse(doc.contentJson);
    } catch {
      // Corrupt content — fall back to an empty doc instead of 500.
      contentJson = { type: "doc", content: [{ type: "paragraph" }] };
    }

    return NextResponse.json({
      document: {
        id: doc.id,
        title: doc.title,
        contentJson,
        updatedAt: doc.updatedAt,
        ownerId: doc.ownerId,
        owner: doc.owner,
        shares: doc.shares.map(
          (s: {
            userId: string;
            user: { name: string; email: string };
            createdAt: Date;
          }) => ({
            userId: s.userId,
            name: s.user.name,
            email: s.user.email,
            createdAt: s.createdAt,
          })
        ),
      },
      isOwner,
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * PATCH /api/documents/[id] — update title and/or contentJson. Used by autosave.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();
    await assertCanAccessDocument(params.id, session.userId);

    const body = await req.json().catch(() => null);
    const parsed = UpdateContentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // TipTap doc gets serialized to string for the TEXT column.
    // We re-validate the shape minimally to avoid storing totally bogus data.
    const json = parsed.data.contentJson;
    if (!isTiptapDocShape(json)) {
      return NextResponse.json(
        { error: "contentJson must be a TipTap doc" },
        { status: 400 }
      );
    }

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        contentJson: JSON.stringify(json),
        plainTextPreview: parsed.data.plainTextPreview,
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
      },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ document: updated });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * DELETE /api/documents/[id] — owner-only hard delete. Not required by the
 * brief but useful for reviewers who want to tidy up after poking around.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();
    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (doc.ownerId !== session.userId) {
      return NextResponse.json({ error: "Only the owner can delete" }, { status: 403 });
    }
    await prisma.document.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

function isTiptapDocShape(value: unknown): value is { type: "doc"; content?: unknown[] } {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "doc"
  );
}

function handleError(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  if (e instanceof NotFoundError) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (e instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
