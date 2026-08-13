import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Only accept media URLs that live on Vercel Blob, so a caller can't point the
// player at an arbitrary external URL.
function isBlobUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)
  );
}

// GET: list songs for the admin UI.
export async function GET() {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const songs = await prisma.song.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({
    songs: songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      durationMs: s.durationMs,
      order: s.order,
      posterUrl: s.posterFile ? `/api/media/${s.id}/poster` : null,
    })),
  });
}

// POST: register a new song. The browser has already uploaded the audio (and
// optional poster) straight to Vercel Blob; here we just store their URLs + metadata.
// Body (JSON): { title, artist, durationMs, audioUrl, audioMime, posterUrl?, posterMime? }
export async function POST(req: NextRequest) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const title = String(body.title ?? "").trim();
  const artist = String(body.artist ?? "").trim();
  const durationMs = Math.max(0, Math.round(Number(body.durationMs) || 0));
  const audioUrl = body.audioUrl;
  const posterUrl = body.posterUrl;

  if (!title) {
    return NextResponse.json(
      { error: "missing_title", message: "Title is required." },
      { status: 400 }
    );
  }
  if (!isBlobUrl(audioUrl)) {
    return NextResponse.json(
      { error: "missing_audio", message: "An audio file is required." },
      { status: 400 }
    );
  }

  const posterFile = isBlobUrl(posterUrl) ? posterUrl : null;
  const posterMime = posterFile
    ? String(body.posterMime || "image/jpeg")
    : null;

  // Append to the end of the play order.
  const max = await prisma.song.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  const song = await prisma.song.create({
    data: {
      title,
      artist: artist || "Unknown artist",
      audioFile: audioUrl,
      audioMime: String(body.audioMime || "audio/mpeg"),
      posterFile,
      posterMime,
      durationMs,
      order,
    },
  });

  return NextResponse.json({ ok: true, id: song.id });
}
