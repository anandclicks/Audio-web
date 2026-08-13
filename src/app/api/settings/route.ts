import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public: app-wide settings the player needs (currently just the background image).
export async function GET() {
  const bg = await prisma.setting
    .findUnique({ where: { key: "backgroundUrl" } })
    .catch(() => null);
  return NextResponse.json({ backgroundUrl: bg?.value ?? null });
}
