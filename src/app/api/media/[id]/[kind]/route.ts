import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Resolves a song's audio/poster to its Vercel Blob URL and redirects there.
// Blob is served from a CDN that natively supports HTTP Range requests, so audio
// seeking / streaming keeps working. Keeping this indirection means the stored
// public URLs can change without touching the player.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; kind: string } }
) {
  const { id, kind } = params;
  if (kind !== "audio" && kind !== "poster") {
    return new Response("Not found", { status: 404 });
  }

  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) return new Response("Not found", { status: 404 });

  const url = kind === "audio" ? song.audioFile : song.posterFile;
  if (!url) return new Response("Not found", { status: 404 });

  return NextResponse.redirect(url, 302);
}
