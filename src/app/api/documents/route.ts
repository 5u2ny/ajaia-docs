import { NextResponse } from "next/server";
import { requireSession, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreateDocumentSchema } from "@/lib/validate";

/**
 * GET /api/documents — returns two arrays: owned and shared.
 * We split server-side so the dashboard doesn't have to bucket them.
 */
export async function GET() {
  try {
    const session = await requireSession();

    const [owned, sharedRecords] = await Promise.all([
      prisma.document.findMany({
        where: { ownerId: session.userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          plainTextPreview: true,
          updatedAt: true,
          ownerId: true,
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
              ownerId: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      }),
    ]);

    const shared = sharedRecords.map((r) => ({
      ...r.document,
      ownerName: r.document.owner.name,
      ownerEmail: r.document.owner.email,
    }));

    return NextResponse.json({ owned, shared });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * POST /api/documents — create a new empty document owned by the caller.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const parsed = CreateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const doc = await prisma.document.create({
      data: {
        title: parsed.data.title || "Untitled document",
        ownerId: session.userId,
      },
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
