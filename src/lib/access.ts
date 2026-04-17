/**
 * Access control for documents.
 *
 * Rule: a user can read/write a document iff they own it OR a DocumentShare
 * row exists linking them to the document. Every document fetch and every
 * document mutation must go through one of these helpers — do not query the
 * Document table directly in routes.
 */
import { prisma } from "./prisma";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Fetch a document only if the user is the owner or is on the share list.
 * Throws NotFoundError when the doc does not exist (same response as no
 * access, to avoid leaking existence).
 * Throws ForbiddenError when the doc exists but the user isn't authorized.
 */
export async function getDocumentForUser(documentId: string, userId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      shares: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!doc) throw new NotFoundError();

  const isOwner = doc.ownerId === userId;
  const isShared = doc.shares.some((s: { userId: string }) => s.userId === userId);
  if (!isOwner && !isShared) throw new ForbiddenError();

  return { doc, isOwner, isShared };
}

/** Narrower check for mutations that don't need the full doc. */
export async function assertCanAccessDocument(
  documentId: string,
  userId: string
): Promise<{ isOwner: boolean }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      ownerId: true,
      shares: { where: { userId }, select: { userId: true } },
    },
  });
  if (!doc) throw new NotFoundError();
  const isOwner = doc.ownerId === userId;
  const isShared = doc.shares.length > 0;
  if (!isOwner && !isShared) throw new ForbiddenError();
  return { isOwner };
}
