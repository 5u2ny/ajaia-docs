/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules, which would spawn a new Prisma
 * connection on every change. We cache the client on `globalThis` so we
 * only ever create one connection per process. This pattern is from the
 * Prisma docs and is safe because `globalThis` is per-process, not shared.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
