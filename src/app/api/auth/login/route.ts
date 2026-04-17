import { NextResponse } from "next/server";
import { LoginSchema } from "@/lib/validate";
import { authenticate, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    // Generic error message — don't reveal whether the email exists.
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    name: user.name,
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
