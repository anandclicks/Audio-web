import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public: the ordered playlist the player consumes.
export async function GET() {
  const songs = await prisma.song.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    songs: songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      durationMs: s.durationMs,
      audioUrl: `/api/media/${s.id}/audio`,
      posterUrl: s.posterFile ? `/api/media/${s.id}/poster` : null,
    })),
  });
}
