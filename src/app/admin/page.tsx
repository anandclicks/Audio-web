"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

interface SongItem {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  order: number;
  posterUrl: string | null;
}

function formatDuration(ms: number): string {
  if (!ms) return "";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Read an audio file's duration in the browser before uploading.
function getAudioDurationMs(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const ms = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
      URL.revokeObjectURL(url);
      resolve(Math.round(ms));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [songs, setSongs] = useState<SongItem[]>([]);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const showToast = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/admin/me", { cache: "no-store" });
    setAuthed(res.ok);
    setLoading(false);
  }, []);

  const loadSongs = useCallback(async () => {
    const res = await fetch("/api/admin/songs", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setSongs(data.songs ?? []);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (authed) loadSongs();
  }, [authed, loadSongs]);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-white animate-spin-slow" />
        </div>
      </Shell>
    );
  }

  if (!authed) {
    return (
      <Shell>
        <LoginForm onSuccess={() => setAuthed(true)} onError={(m) => showToast("err", m)} />
        <Toast toast={toast} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-xl font-bold">Auto Anthem admin</h1>
          <p className="mt-1 text-sm text-white/50">Upload songs and set the play order.</p>
        </div>
        <form action="/api/admin/logout" method="post">
          <button className="rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/10">
            Log out
          </button>
        </form>
      </div>

      <UploadForm
        onUploaded={async () => {
          await loadSongs();
          showToast("ok", "Song uploaded.");
        }}
        onError={(m) => showToast("err", m)}
      />

      <SongList
        songs={songs}
        onChange={setSongs}
        reload={loadSongs}
        onToast={showToast}
      />

      <Toast toast={toast} />
    </Shell>
  );
}

// ── Login ───────────────────────────────────────────────────────

function LoginForm({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSuccess();
      } else {
        onError(data.message || "Login failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm py-16 text-center">
      <h1 className="text-2xl font-bold">Auto Anthem admin</h1>
      <p className="mt-2 text-sm text-white/60">Enter the admin password to manage songs.</p>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        autoFocus
        className="mt-6 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-sm outline-none placeholder:text-white/30 focus:border-white/30"
      />
      <button
        disabled={busy || !password}
        className="mt-4 w-full rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

// ── Upload ──────────────────────────────────────────────────────

function UploadForm({
  onUploaded,
  onError,
}: {
  onUploaded: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [audio, setAudio] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const audioInput = useRef<HTMLInputElement | null>(null);
  const posterInput = useRef<HTMLInputElement | null>(null);

  const reset = () => {
    setTitle("");
    setArtist("");
    setAudio(null);
    setPoster(null);
    if (audioInput.current) audioInput.current.value = "";
    if (posterInput.current) posterInput.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !audio) {
      onError("Title and an audio file are required.");
      return;
    }
    setBusy(true);
    try {
      const durationMs = await getAudioDurationMs(audio);

      // Upload files straight to Vercel Blob from the browser (no 4.5 MB
      // serverless body limit). The token route verifies the admin session.
      const audioBlob = await upload(audio.name, audio, {
        access: "public",
        handleUploadUrl: "/api/admin/blob-upload",
      });
      const posterBlob = poster
        ? await upload(poster.name, poster, {
            access: "public",
            handleUploadUrl: "/api/admin/blob-upload",
          })
        : null;

      const res = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          durationMs,
          audioUrl: audioBlob.url,
          audioMime: audio.type || "audio/mpeg",
          posterUrl: posterBlob?.url ?? null,
          posterMime: poster?.type ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        reset();
        onUploaded();
      } else {
        onError(data.message || "Upload failed.");
      }
    } catch (err) {
      onError((err as Error).message || "Network error during upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <p className="text-xs font-medium uppercase tracking-widest text-white/40">Add a song</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-white/60">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-white/30"
          />
        </div>
        <div>
          <label className="text-xs text-white/60">Artist</label>
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist name"
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-white/30"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-white/60">Audio file *</label>
          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-white/20"
          />
        </div>
        <div>
          <label className="text-xs text-white/60">Poster / album art</label>
          <input
            ref={posterInput}
            type="file"
            accept="image/*"
            onChange={(e) => setPoster(e.target.files?.[0] ?? null)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-white/20"
          />
        </div>
      </div>

      <button
        disabled={busy}
        className="mt-4 rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-40"
      >
        {busy ? "Uploading…" : "Upload song"}
      </button>
    </form>
  );
}

// ── Song list ───────────────────────────────────────────────────

function SongList({
  songs,
  onChange,
  reload,
  onToast,
}: {
  songs: SongItem[];
  onChange: (s: SongItem[]) => void;
  reload: () => Promise<void>;
  onToast: (kind: "ok" | "err", msg: string) => void;
}) {
  const persistOrder = async (ordered: SongItem[]) => {
    onChange(ordered);
    const res = await fetch("/api/admin/songs/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ordered.map((s) => s.id) }),
    });
    if (!res.ok) {
      onToast("err", "Could not save the new order.");
      await reload();
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= songs.length) return;
    const next = [...songs];
    [next[i], next[j]] = [next[j], next[i]];
    persistOrder(next);
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/songs/${id}`, { method: "DELETE" });
    if (res.ok) {
      onChange(songs.filter((s) => s.id !== id));
      onToast("ok", "Song removed.");
    } else {
      onToast("err", "Could not remove song.");
    }
  };

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-white/80">
        Playlist{" "}
        <span className="text-white/40">
          ({songs.length} {songs.length === 1 ? "song" : "songs"})
        </span>
      </h2>

      {songs.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
          No songs yet. Upload one above and it becomes track 1.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10">
          {songs.map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 bg-white/[0.02] p-3">
              <span className="w-6 shrink-0 text-center text-xs text-white/35">{i + 1}</span>
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/5">
                {s.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.posterUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{s.title}</p>
                <p className="truncate text-xs text-white/45">
                  {s.artist}
                  {s.durationMs ? ` · ${formatDuration(s.durationMs)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={i === songs.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </IconButton>
                <button
                  aria-label="Delete"
                  onClick={() => remove(s.id)}
                  className="ml-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/15"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

// ── Chrome ──────────────────────────────────────────────────────

function Toast({ toast }: { toast: { kind: "ok" | "err"; msg: string } | null }) {
  if (!toast) return null;
  return (
    <div
      className={`fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[90vw] rounded-full px-5 py-3 text-sm font-medium shadow-lg ${
        toast.kind === "ok" ? "bg-emerald-500 text-black" : "bg-red-500 text-white"
      }`}
    >
      {toast.msg}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#05060a] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-2xl">{children}</div>
    </main>
  );
}
