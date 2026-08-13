"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Song {
  id: string;
  title: string;
  artist: string;
  durationMs: number;
  audioUrl: string;
  posterUrl: string | null;
}

type Status = "loading" | "empty" | "error" | "ready";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Player() {
  const [status, setStatus] = useState<Status>("loading");
  const [songs, setSongs] = useState<Song[]>([]);
  const [bgUrl, setBgUrl] = useState("/imageuserthis.png");
  const [bgType, setBgType] = useState<"image" | "video">("image");
  const [instagramUrl, setInstagramUrl] = useState(
    "https://www.instagram.com/its.anand.clicks1/"
  );
  const [creditName, setCreditName] = useState("its.anandclicks.1");
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false); // are we currently playing? (survives src swaps)
  const currentSong = songs[index];

  // ── Load the playlist ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/songs", { cache: "no-store" });
        if (!res.ok) throw new Error(`songs ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.songs?.length) {
          setStatus("empty");
          return;
        }
        setSongs(data.songs);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the admin-configured background image (falls back to the bundled default).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (d.backgroundUrl) setBgUrl(d.backgroundUrl);
        if (d.backgroundType === "video" || d.backgroundType === "image") {
          setBgType(d.backgroundType);
        }
        if (d.instagramUrl) setInstagramUrl(d.instagramUrl);
        if (d.creditName) setCreditName(d.creditName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset progress + seed duration whenever the track changes.
  useEffect(() => {
    setCurrentTime(0);
    setDuration(currentSong ? currentSong.durationMs / 1000 : 0);
  }, [currentSong]);

  // On track change: load the new source, and resume if we were playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const resume = playingRef.current; // capture before load() aborts playback
    audio.load();
    if (resume) audio.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }, []);

  const handleNext = useCallback(() => {
    setIndex((i) => (songs.length ? (i + 1) % songs.length : 0));
  }, [songs.length]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setIndex((i) => (songs.length ? (i - 1 + songs.length) % songs.length : 0));
  }, [songs.length]);

  const progressPct = useMemo(
    () => (duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0),
    [currentTime, duration]
  );

  if (status === "loading") {
    return <FullScreenMessage spinner title="Loading…" subtitle="Getting the playlist ready" />;
  }
  if (status === "error") {
    return <FullScreenMessage title="Something went wrong" subtitle="Please refresh the page." />;
  }
  if (status === "empty") {
    return (
      <FullScreenMessage
        title="No songs yet"
        subtitle="Your admin hasn’t uploaded any songs. Check back soon."
      />
    );
  }

  // ── The player ────────────────────────────────────────────────
  return (
    <div className="no-scroll flex flex-col text-white select-none">
      {/* Audio engine (hidden) */}
      <audio
        ref={audioRef}
        src={currentSong?.audioUrl}
        onPlay={() => {
          playingRef.current = true;
          setIsPlaying(true);
        }}
        onPause={() => {
          playingRef.current = false;
          setIsPlaying(false);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => {
          playingRef.current = true; // keep the drive going
          handleNext();
        }}
        preload="auto"
      />

      {/* Full-screen background image */}
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#05060a]">
        {bgType === "video" ? (
          <video
            key={bgUrl}
            src={bgUrl}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover object-center"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt=""
            className="h-full w-full object-cover object-center"
          />
        )}
        {/* Soft top vignette for the brand */}
        <div
          className="absolute inset-x-0 top-0 h-40"
          style={{ background: "linear-gradient(180deg, rgba(5,6,10,0.5) 0%, transparent 100%)" }}
        />
        {/* Bottom gradient so the control bar stays readable */}
        <div
          className="absolute inset-x-0 bottom-0 h-[45%]"
          style={{
            background:
              "linear-gradient(0deg, rgba(5,6,10,0.85) 0%, rgba(5,6,10,0.35) 55%, transparent 100%)",
          }}
        />
      </div>

      {/* Top bar: live date + time (left), Instagram (right) */}
      <header className="relative z-10 flex items-start justify-between px-6 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10">
        <Clock />
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Instagram"
          className="readable-shadow flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-90"
        >
          <InstagramIcon />
        </a>
      </header>

      {/* Center: big two-line hero title */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="hero-shadow font-display font-black italic leading-[0.9] tracking-tight text-white">
          <span className="block whitespace-nowrap text-6xl sm:text-8xl md:text-9xl">
            Metro.fm
          </span>
        </h1>
      </main>

      {/* Glass control bar.
          On phones the progress bar is squeezed on one line, so there it drops to
          its own full-width row below the controls; on sm+ it stays inline. */}
      <footer className="relative z-10 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="glass mx-auto w-full max-w-lg rounded-3xl px-3 py-2.5 sm:rounded-full sm:px-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Play / Pause */}
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition active:scale-90"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Spinning vinyl poster */}
            <div className="relative h-12 w-12 shrink-0">
              <div
                className="vinyl-spin h-full w-full overflow-hidden rounded-full ring-1 ring-white/15"
                style={{ animationPlayState: isPlaying ? "running" : "paused" }}
              >
                {currentSong?.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentSong.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/5 text-white/25">
                    <BrandMark size={18} />
                  </div>
                )}
              </div>
              {/* Vinyl center hole */}
              <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/70 ring-1 ring-white/25" />
            </div>

            {/* Track title + (inline progress on sm+) */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-tight">
                <span className="font-semibold">{currentSong?.title ?? "—"}</span>
                {currentSong?.artist ? (
                  <span className="text-white/50"> · {currentSong.artist}</span>
                ) : null}
              </p>
              {/* Inline progress: desktop/tablet only */}
              <div className="mt-1.5 hidden sm:block">
                <ProgressBar
                  progressPct={progressPct}
                  currentTime={currentTime}
                  duration={duration}
                />
              </div>
            </div>

            {/* Prev / Next */}
            <div className="flex shrink-0 items-center">
              <ControlButton label="Previous" onClick={handlePrev}>
                <PrevIcon />
              </ControlButton>
              <ControlButton label="Next" onClick={handleNext}>
                <NextIcon />
              </ControlButton>
            </div>
          </div>

          {/* Stacked progress: phones only, full-width so it isn't squeezed */}
          <div className="mt-2.5 px-1 sm:hidden">
            <ProgressBar
              progressPct={progressPct}
              currentTime={currentTime}
              duration={duration}
            />
          </div>
        </div>

        {/* Credit */}
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="readable-shadow mx-auto mt-3 flex w-fit items-center gap-1.5 text-[11px] font-medium text-white transition hover:opacity-80"
        >
          <InstagramIcon size={13} />
          made by {creditName}
        </a>
      </footer>
    </div>
  );
}

// ── Small presentational helpers ────────────────────────────────

// Live date + time (client-only to avoid hydration mismatch).
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) return <div className="h-9" aria-hidden />;

  const time = now
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
  const date = now.toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="readable-shadow leading-tight">
      <div className="text-lg font-semibold tabular-nums text-white/95">{time}</div>
      <div className="text-xs font-medium text-white/60">{date}</div>
    </div>
  );
}

// Progress track + elapsed/total time. Used inline on desktop and full-width on phones.
function ProgressBar({
  progressPct,
  currentTime,
  duration,
}: {
  progressPct: number;
  currentTime: number;
  duration: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/15">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-300 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-medium tabular-nums text-white/55">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ControlButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10 active:scale-90"
    >
      {children}
    </button>
  );
}

function FullScreenMessage({
  title,
  subtitle,
  spinner,
}: {
  title: string;
  subtitle?: string;
  spinner?: boolean;
}) {
  return (
    <div className="no-scroll flex flex-col items-center justify-center bg-[#05060a] px-8 text-center">
      <div className="animate-fade-in flex flex-col items-center">
        {spinner ? (
          <div className="mb-6 h-9 w-9 rounded-full border-2 border-white/20 border-t-white animate-spin-slow" />
        ) : (
          <BrandMark size={40} />
        )}
        <h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-2 max-w-sm text-sm text-white/60">{subtitle}</p>}
      </div>
    </div>
  );
}

function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path
        d="M9 8.5v7.2a2.1 2.1 0 1 1-1.5-2.02V9.7l7-1.6v5.7a2.1 2.1 0 1 1-1.5-2.02V6.8L9 8.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72c0 .78.85 1.26 1.53.85l10.7-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1.4" />
      <rect x="14" y="5" width="4" height="14" rx="1.4" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5.5v13a1 1 0 0 0 1.55.83L16 13.7V18a1 1 0 0 0 2 0V6a1 1 0 0 0-2 0v4.3L7.55 4.67A1 1 0 0 0 6 5.5Z" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18 5.5v13a1 1 0 0 1-1.55.83L8 13.7V18a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v4.3l8.45-5.63A1 1 0 0 1 18 5.5Z" />
    </svg>
  );
}
