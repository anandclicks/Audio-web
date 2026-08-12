import crypto from "crypto";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────
//  Lightweight signed-cookie session for the ADMIN.
//  Auth is a single shared password (ADMIN_PASSWORD). On success we issue an
//  HMAC-signed cookie so subsequent admin API calls are authenticated.
//  Token format:  base64url(payloadJSON).base64url(hmacSHA256)
// ─────────────────────────────────────────────────────────────

const COOKIE_NAME = "rt_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface AdminSession {
  role: "admin";
  iat: number; // issued-at (seconds)
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: AdminSession): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac("sha256", secret()).update(body).digest();
  return `${body}.${b64url(sig)}`;
}

function verify(token: string): AdminSession | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = b64url(
    crypto.createHmac("sha256", secret()).update(body).digest()
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as AdminSession;
    if (payload.role !== "admin") return null;
    if (Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Constant-time password comparison. */
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Issue an admin session cookie. */
export function setAdminSession() {
  const token = sign({ role: "admin", iat: Math.floor(Date.now() / 1000) });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Read + verify the admin session, or null if absent/invalid. */
export function getAdminSession(): AdminSession | null {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verify(token);
}

/** Clear the admin session cookie. */
export function clearAdminSession() {
  cookies().delete(COOKIE_NAME);
}
