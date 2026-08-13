import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KEYS = ["backgroundUrl", "instagramUrl", "creditName"] as const;

// Public: app-wide settings the player needs (background image, Instagram link,
// and the "made by" credit name — all editable from the admin panel).
export async function GET() {
  const rows = await prisma.setting
    .findMany({ where: { key: { in: KEYS as unknown as string[] } } })
    .catch(() => [] as { key: string; value: string }[]);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return NextResponse.json({
    backgroundUrl: map.backgroundUrl ?? null,
    instagramUrl: map.instagramUrl ?? null,
    creditName: map.creditName ?? null,
  });
}
