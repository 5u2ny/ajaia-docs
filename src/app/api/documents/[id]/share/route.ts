import { NextResponse } from "next/server";
import { requireSession, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShareSchema } from "@/lib/validate";

type Ctx = { params: { id: string } };

/**
 * POST /api/documents/[id]/share — owner-only share grant.
 *
 * Validation rules (from the brief):
 *   1. Only the owner can share.
 *   2. Cannot share with yourself.
 *   3. Target user must exist (we don't invite by email).
 *   4. Duplicate shares are idempotent (we return the existing record).
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();

    const body = await req.json().catch(() => null);
    const parsed = ShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Only the owner can share.
    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      select: { id: true, ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.ownerId !== session.userId) {
      return NextResponse.json(
        { error: "Only the owner can share this document" },
        { status: 403 }
      );
    }

    // Can't share with yourself.
    if (parsed.data.email === session.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You can't share a document with yourself" },
        { status: 400 }
      );
    }

    // Target user must exist. We don't send invites.
    const target = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, name: true, email: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: "No user found with that email. (Demo app: try alex@demo.app, maya@demo.app, or jordan@demo.app.)" },
        { status: 404 }
      );
    }

    // Upsert — duplicate shares shouldn't be an error.
    const share = await prisma.documentShare.upsert({
      where: {
        documentId_userId: { documentId: params.id, userId: target.id },
      },
      update: {},
      create: {
        documentId: params.id,
        userId: target.id,
        permission: "EDIT",
      },
    });

    return NextResponse.json({
      share: {
        id: share.id,
        userId: target.id,
        name: target.name,
        email: target.email,
        permission: share.permission,
        createdAt: share.createdAt,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * DELETE /api/documents/[id]/share?email=... — owner-only unshare.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const email = url.searchParams.get("email")?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "email query param required" }, { status: 400 });
    }

    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      select: { ownerId: true },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.ownerId !== session.userId) {
      return NextResponse.json({ error: "Only the owner can unshare" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!target) return NextResponse.json({ ok: true });

    await prisma.documentShare
      .delete({
        where: {
          documentId_userId: { documentId: params.id, userId: target.id },
        },
      })
      .catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
