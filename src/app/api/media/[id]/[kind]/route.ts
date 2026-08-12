import { NextRequest } from "next/server";
import fs from "fs";
import fsp from "fs/promises";
import { Readable } from "stream";
import { prisma } from "@/lib/prisma";
import { uploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Streams a song's audio (with HTTP Range support for seeking) or serves its poster.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; kind: string } }
) {
  const { id, kind } = params;
  if (kind !== "audio" && kind !== "poster") {
    return new Response("Not found", { status: 404 });
  }

  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) return new Response("Not found", { status: 404 });

  const file = kind === "audio" ? song.audioFile : song.posterFile;
  const mime =
    (kind === "audio" ? song.audioMime : song.posterMime) ||
    "application/octet-stream";
  if (!file) return new Response("Not found", { status: 404 });

  const filePath = uploadPath(file);
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const size = stat.size;

  const range = req.headers.get("range");

  // Ranged request → 206 Partial Content (enables audio seeking / streaming).
  if (range && kind === "audio") {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    if (Number.isNaN(start) || start < 0) start = 0;
    if (Number.isNaN(end) || end >= size) end = size - 1;
    if (start > end) start = 0;

    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
