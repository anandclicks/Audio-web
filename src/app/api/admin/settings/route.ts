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

// Store a value, or delete the row when the value is an empty string.
async function setOrClear(key: string, value: string) {
  if (value) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  } else {
    await prisma.setting.deleteMany({ where: { key } });
  }
}

// POST: update player settings. Any subset of these fields may be sent:
//   backgroundUrl → a freshly uploaded Blob URL (or omit to leave unchanged)
//   instagramUrl  → the Instagram profile link ("" clears it → falls back to default)
//   creditName    → the "made by" name ("" clears it → falls back to default)
export async function POST(req: NextRequest) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Background image (Blob URL, with cleanup of the previous file).
  if ("backgroundUrl" in body) {
    const url = body.backgroundUrl;
    if (!isBlobUrl(url)) {
      return NextResponse.json(
        { error: "bad_request", message: "A valid uploaded image is required." },
        { status: 400 }
      );
    }
    const prev = await prisma.setting.findUnique({
      where: { key: "backgroundUrl" },
    });
    await setOrClear("backgroundUrl", url);
    if (prev?.value && prev.value !== url && isBlobUrl(prev.value)) {
      await del(prev.value).catch(() => {});
    }
  }

  // Instagram link — normalise to include a protocol.
  if ("instagramUrl" in body) {
    let ig = String(body.instagramUrl ?? "").trim();
    if (ig && !/^https?:\/\//i.test(ig)) ig = `https://${ig}`;
    await setOrClear("instagramUrl", ig.slice(0, 300));
  }

  // "Made by" credit name.
  if ("creditName" in body) {
    const name = String(body.creditName ?? "").trim().slice(0, 60);
    await setOrClear("creditName", name);
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
