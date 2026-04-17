/**
 * Session auth backed by a signed JWT cookie.
 *
 * Why JWT cookies and not a server-side session store?
 *   The scope is 3 seeded users — a server-side store would be overkill.
 *   JWTs are stateless and work everywhere (edge, lambda, anywhere Vercel
 *   puts us). The `jose` library is edge-runtime-compatible.
 *
 * Why HTTP-only + SameSite=Lax?
 *   HTTP-only means client JS cannot read the cookie (mitigates XSS token
 *   theft). SameSite=Lax prevents the cookie from being sent on cross-site
 *   requests (mitigates CSRF for the auth-required endpoints).
 */
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const COOKIE_NAME = "ajaia_session";
const ALG = "HS256";
// 7-day sessions; the scope doesn't need refresh tokens.
const EXPIRY_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters. Set it in .env."
    );
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string"
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
      };
    }
    return null;
  } catch {
    // Expired, tampered, or malformed — treat as no session.
    return null;
  }
}

/** Read the session from the current request's cookies, or null. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/** Same as getSession but throws if unauthenticated. Use in protected routes. */
export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) throw new AuthError("Not authenticated");
  return s;
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = await signSession(payload);
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EXPIRY_SECONDS,
  });
}

export function clearSessionCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export class AuthError extends Error {}

/** Verify credentials against the DB. Returns user on match, null otherwise. */
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}
