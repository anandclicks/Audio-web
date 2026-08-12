import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";
import { ensureUploadDir, uploadPath, safeExt } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

// POST: upload a new song (multipart form: title, artist, audio, poster, durationMs).
export async function POST(req: NextRequest) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const artist = String(form.get("artist") ?? "").trim();
  const durationMs = Math.max(0, Math.round(Number(form.get("durationMs")) || 0));
  const audio = form.get("audio");
  const poster = form.get("poster");

  if (!title) {
    return NextResponse.json(
      { error: "missing_title", message: "Title is required." },
      { status: 400 }
    );
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "missing_audio", message: "An audio file is required." },
      { status: 400 }
    );
  }

  await ensureUploadDir();

  // Save audio.
  const audioFile = `${randomUUID()}${safeExt(audio.name)}`;
  await fs.writeFile(uploadPath(audioFile), Buffer.from(await audio.arrayBuffer()));

  // Save poster (optional).
  let posterFile: string | null = null;
  let posterMime: string | null = null;
  if (poster instanceof File && poster.size > 0) {
    posterFile = `${randomUUID()}${safeExt(poster.name)}`;
    posterMime = poster.type || "image/jpeg";
    await fs.writeFile(uploadPath(posterFile), Buffer.from(await poster.arrayBuffer()));
  }

  // Append to the end of the play order.
  const max = await prisma.song.aggregate({ _max: { order: true } });
  const order = (max._max.order ?? -1) + 1;

  const song = await prisma.song.create({
    data: {
      title,
      artist: artist || "Unknown artist",
      audioFile,
      audioMime: audio.type || "audio/mpeg",
      posterFile,
      posterMime,
      durationMs,
      order,
    },
  });

  return NextResponse.json({ ok: true, id: song.id });
}
