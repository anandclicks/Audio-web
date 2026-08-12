import { NextResponse } from "next/server";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-session";
import { uploadPath } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE: remove a song and its files.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  if (!getAdminSession()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const song = await prisma.song.findUnique({ where: { id: params.id } });
  if (!song) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.song.delete({ where: { id: params.id } });

  // Best-effort file cleanup.
  await fs.rm(uploadPath(song.audioFile), { force: true }).catch(() => {});
  if (song.posterFile) {
    await fs.rm(uploadPath(song.posterFile), { force: true }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
