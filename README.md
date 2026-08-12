# 🎵 Auto Anthem

A distraction-free, **single-screen** music player built for bus & cab drivers on long
drives. One full-screen player, one playlist — curated entirely by **you** (the admin).
Listeners just **Play / Pause / Next / Previous**. No search, no menus, no clutter, and
**no accounts** — a driver opens the site and starts listening.

You upload the songs yourself (audio file + poster), and the player streams them straight
from your server. No Spotify, no third-party login, no Premium requirement.

- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Playback:** native HTML5 `<audio>`, streamed with HTTP Range support (seeking)
- **Admin:** password-protected `/admin` to upload songs and set the play order
- **Data:** Prisma + SQLite (song metadata) + files on disk (audio/posters)

---

## ✨ Features

- **Full-screen artwork** — a fixed illustrated background (`public/imageuserthis.png`)
  fills the screen so all focus stays on the scene and the current track.
- **Single-line glass control bar** — play/pause, a **spinning "vinyl" poster** that
  rotates while playing, the title + live progress, and prev/next — all in one slim pill
  with large 48px+ touch targets.
- **Lands straight on the player** — no splash. Tap play once to start (browsers block
  autoplay with sound until a tap), then it plays straight through.
- **Infinite loop** — when the playlist ends it wraps back to track 1.
- **Minimal admin panel** at `/admin` — upload a song (audio + poster), reorder with
  up/down, delete. That's it.

---

## 🚀 Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#    …then set ADMIN_PASSWORD and ADMIN_SESSION_SECRET (see below)

# 3. Create the SQLite database
npx prisma db push

# 4. Run
npm run dev
```

Open **http://localhost:3000** for the player, and **http://localhost:3000/admin** to
upload songs.

---

## 🌱 Environment variables

Copy `.env.example` → `.env` and set:

| Variable               | What it is                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| `ADMIN_PASSWORD`       | The password you type at `/admin`. Choose something strong.                |
| `ADMIN_SESSION_SECRET` | Signs the admin cookie. Generate: `openssl rand -base64 32`.               |
| `DATABASE_URL`         | `file:./dev.db` for SQLite (default).                                      |
| `UPLOAD_DIR`           | *(optional)* Where uploaded files go. Defaults to `./data/uploads`.        |

---

## 🛠️ How to use it

1. **You (admin):** go to **`/admin`**, enter your `ADMIN_PASSWORD`, then:
   - Fill in **Title** (required) and **Artist**.
   - Choose an **audio file** (mp3, m4a, ogg, wav… anything the browser can play).
   - Optionally add a **poster / album art** image — it shows as the spinning vinyl.
   - Click **Upload song**. Repeat for each track.
   - Reorder with **↑ / ↓**; remove with **Delete**. The order here is the play order.
2. **Drivers:** open **`/`**, tap **Play**, and it plays through the playlist on loop.
   They can only Play/Pause, Next, Previous.

Uploaded files are stored in `data/uploads/` (or your `UPLOAD_DIR`) and their metadata in
the database. Nothing leaves your server.

---

## 🎨 Design notes

A fixed illustrated background carries the mood; a soft top vignette keeps the logo legible
and a bottom gradient keeps the control bar readable. The control bar is a single frosted
pill: an emphasized play/pause, a circular poster that spins like a record while playing,
the title + a thin live progress bar, and prev/next. To swap the background, replace
`public/imageuserthis.png` (a wide 16:9 image works best) and update the `src` in
`src/components/Player.tsx`. Everything is tuned for **dark mode, high contrast, and
daylight readability**, with `min-48px` touch targets and safe-area insets for phones.

---

## 🗄️ Switching to Postgres

SQLite is perfect for local dev and single-server / VPS deploys. To use Postgres/Supabase:

1. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your Postgres connection string.
3. Run `npx prisma db push`.

No model or query changes are needed — the schema is portable as-is. (Note: the database
only stores metadata; the audio/poster **files** still live on disk — see deployment.)

---

## ☁️ Deployment

Auto Anthem writes uploaded files to a local directory and (by default) uses a SQLite file.
Both need a **persistent filesystem**, so deploy to a host that provides one:

### Recommended: a VPS or container (Railway, Render, Fly.io, a plain Linux box)

1. Set env vars: `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `DATABASE_URL`.
2. Point `UPLOAD_DIR` at a **persistent volume** (e.g. `/data/uploads`) so uploads survive
   restarts and redeploys.
3. Build and start:
   ```bash
   npm install
   npx prisma db push
   npm run build
   npm run start
   ```
4. Put it behind HTTPS (a reverse proxy like Caddy/Nginx, or the platform's built-in TLS).

### About Vercel

Vercel's serverless filesystem is **read-only and ephemeral**, so file uploads and a
SQLite file won't persist there. To run on Vercel you'd need to switch storage to an object
store (e.g. S3/R2) and the database to hosted Postgres — a larger change. For a single
curated playlist, a small VPS is simpler and cheaper.

> **Large files:** very large audio uploads can hit platform request-size limits. Typical
> songs (a few MB each) are fine. If you upload very large files and see upload errors,
> raise your reverse proxy's body-size limit (e.g. Nginx `client_max_body_size`).

---

## 📁 Project structure

```
prisma/
  schema.prisma            # Song model (metadata; files live on disk)
src/
  app/
    layout.tsx             # root layout, fonts, metadata
    page.tsx               # listener entry: the player
    globals.css            # Tailwind + ambient/glass styles
    admin/page.tsx         # password login + upload/manage songs
    api/
      songs/               # public: ordered playlist for the player
      media/[id]/[kind]/   # streams audio (Range) / serves poster
      admin/
        login/             # password login → signed cookie
        logout/            # clear admin session
        me/                # admin session status
        songs/             # GET list · POST upload
        songs/[id]/        # DELETE a song (+ its files)
        songs/reorder/     # POST new play order
  components/
    Player.tsx             # full-screen HTML5 audio player
  lib/
    admin-session.ts       # password check + signed admin cookie
    storage.ts             # upload-dir helpers
    prisma.ts              # Prisma client
public/
  imageuserthis.png        # full-screen background image
data/
  uploads/                 # uploaded audio + posters (gitignored)
```

---

## 🧯 Troubleshooting

- **"No songs yet" on the player** — upload at least one song at `/admin`.
- **Nothing plays after tapping Start** — check the file is a browser-playable format
  (mp3/m4a/ogg/wav). Exotic codecs may not decode in all browsers.
- **Admin says "Incorrect password"** — it must match `ADMIN_PASSWORD` exactly; restart
  the dev server after changing `.env`.
- **Upload fails for big files** — see the large-files note under Deployment.
```
