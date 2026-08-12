import { NextRequest, NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  clearAdminSession();
  return NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
}
