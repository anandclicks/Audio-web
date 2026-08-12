import { NextRequest, NextResponse } from "next/server";
import { checkPassword, setAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

// Admin login with the shared password (ADMIN_PASSWORD).
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "not_configured", message: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const password = body?.password;

  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json(
      { error: "invalid", message: "Incorrect password." },
      { status: 401 }
    );
  }

  setAdminSession();
  return NextResponse.json({ ok: true });
}
