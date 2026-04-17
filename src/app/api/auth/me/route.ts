import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * Returns the current user or 401. Client uses this to hydrate nav state and
 * to detect expired sessions on navigation.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
