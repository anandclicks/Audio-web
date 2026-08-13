import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only accept media URLs that live on Vercel Blob.
function isBlobUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)
  );
}

// POST: set the player's background image to a freshly uploaded Blob URL.
export async function POST(req: NextRequest) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = body?.backgroundUrl;
  if (!isBlobUrl(url)) {
    return NextResponse.json(
      { error: "bad_request", message: "A valid uploaded image is required." },
      { status: 400 }
    );
  }

  const prev = await prisma.setting.findUnique({
    where: { key: "backgroundUrl" },
  });

  await prisma.setting.upsert({
    where: { key: "backgroundUrl" },
    create: { key: "backgroundUrl", value: url },
    update: { value: url },
  });

  // Clean up the previous uploaded background so blobs don't pile up.
  if (prev?.value && prev.value !== url && isBlobUrl(prev.value)) {
    await del(prev.value).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

// DELETE: revert to the built-in default background.
export async function DELETE() {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const prev = await prisma.setting.findUnique({
    where: { key: "backgroundUrl" },
  });
  await prisma.setting.deleteMany({ where: { key: "backgroundUrl" } });
  if (prev?.value && isBlobUrl(prev.value)) {
    await del(prev.value).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
