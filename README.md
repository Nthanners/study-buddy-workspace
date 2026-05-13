# 📚 Study Buddy Workspace

> A private, single-user productivity space — Notes · Tasks · Habits · Journal · Pomodoro · ambient scenes — with a chat companion named AMAI.
> All running locally, all yours.
> Partially made with the help of claude ai.
---

## What is this?

Study Buddy is a personal workspace built for one user. Think Notion meets lifeat.io, plus a lightweight chat companion (AMAI — 甘い, Japanese for *sweet*) you can talk to with voice or text. Dark lavender theme, animated ambient scenes, lo-fi music, focus timer, habit heatmap. No cloud sync, no accounts, no telemetry — your data lives in plain JSON files on your own machine.

### Features

| Section | What it does |
|---|---|
| **Home** | Greeting + live clock, weather, daily stats ribbon (focus/tasks/streak/habits), journal widget, tasks widget, pinned notes |
| **Notes** | Searchable card grid · markdown editor with **Edit/Preview** toggle · 5 color tags · pin notes to home |
| **Tasks** | Full checklist with **priority** (low/normal/high) and **due dates**, sorted intelligently · overdue/today/soon pills · To Do / Completed sections · progress bar |
| **Habits** | Daily recurring checkboxes with streak counter and 90-day heatmap |
| **Journal** | Mood emoji per entry · today's freewrite (auto-saves) · past entries as an expandable accordion |

### Vibe & Focus (lifeat-style)

| Feature | What it does |
|---|---|
| **Animated scenes** | Six pure-CSS animated backgrounds: Lavender Night, Sakura Café, Rainy Study, Fireplace, Lo-fi Bedroom, Starlight |
| **Theme presets** | One-click bundles of scene + accent + suggested ambient sounds |
| **Ambient sound mixer** | 8 channels (rain, fire, café, keyboard, ocean, wind, birds, thunder) — each with its own volume slider |
| **Music** | Embedded YouTube live-streams (lofi girl, synthwave, jazz, piano) |
| **Pomodoro timer** | Configurable work/break/long-break · floating widget across all views · auto-cycles · browser notification on completion · logs focus minutes to your stats |
| **Focus mode** | `Cmd/Ctrl+.` enters distraction-free fullscreen — big lo-fi clock, pomodoro timer, just the scene and music |
| **Daily affirmation** | Speech bubble next to the waifu (deterministic per-day, click to dismiss) |
| **Weather** | Local weather chip on Home (Open-Meteo, no API key — uses geolocation) |

### Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `⌘/Ctrl + K` | Global search across notes, tasks, journal |
| `⌘/Ctrl + .` | Toggle Focus Mode |
| `⌘/Ctrl + B` | Open Vibe panel |
| `Esc` | Exit focus mode / close modal / close search |

Everything persists between sessions — notes, tasks, journal, habits, settings, and focus session history are all written to JSON files in `backend/data/`.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Plain CSS (dark lavender theme, custom design) |
| Backend | Node.js + Express |
| Auth | Single-user JWT (7-day sessions, optional "remember me") |
| Storage | Flat JSON files |
| Fonts | Outfit · Zen Dots · JetBrains Mono (Google Fonts) |

---

## Project Structure

```
AMAI Website/
├── amai-login/          # Frontend (React + Vite)
│   ├── public/
│   │   ├── waifu.png    # The widget character (drop your own to swap)
│   │   └── sounds/      # ⬅ DROP AMBIENT MP3s HERE (see "Ambient sounds" below)
│   ├── src/
│   │   ├── App.jsx      # All views, components, scenes
│   │   ├── dashboard.css
│   │   └── index.css    # Login page styles
│   ├── index.html
│   └── package.json
│
├── backend/             # Express API
│   ├── server.js        # Auth + CRUD endpoints
│   ├── data/            # Auto-created — your personal data lives here (gitignored)
│   │   ├── notes.json
│   │   ├── tasks.json
│   │   ├── journal.json
│   │   ├── habits.json
│   │   ├── settings.json   # scene, sounds, music, pomodoro config
│   │   └── focus.json      # logged focus sessions
│   ├── .env             # Your input credentials (gitignored — never committed)
│   ├── .env.example     # Template incase i forgor
│   └── package.json
│
└── .gitignore
```

### Custom voice (TTS endpoint)

AMAI's spoken replies use the browser's built-in voice by default. Point AMAI at any TTS HTTP endpoint (text in → audio out) to swap in a custom voice.

#### Option A — RVC voice model (e.g. the included Moka Akashiya model)

There's an included Python bridge for RVC voice-conversion models. See [`tts-rvc-server/README.md`](tts-rvc-server/README.md) for full setup. TL;DR:

```bash
cd tts-rvc-server
pip install -r requirements.txt
run.bat            # or: python server.py --model "..." --index "..."
```

Then in AMAI → Vibe panel → **Custom voice (TTS endpoint)**:
- URL: `http://localhost:5800/tts`
- Body format: `POST JSON`, Text param: `text`
- Click **Test voice** to verify.

The bridge uses Microsoft Edge's free neural TTS to generate base speech, then converts it through your RVC model.

#### Option B — Plain TTS server (no RVC)

Any TTS server that accepts text and returns audio works. Examples:
- **Piper HTTP**: `pip install piper-tts && python -m piper.http_server --model en_US-amy-medium.onnx --port 5000`
- **Coqui TTS server**: `tts-server --model_name tts_models/multilingual/multi-dataset/xtts_v2 --port 5002`
- **OpenTTS**: `docker run -it -p 5500:5500 synesthesiam/opentts:en`

Configure the URL, body format, and text-param name in the Vibe panel to match.

#### Behavior

When configured, AMAI's spoken replies use your endpoint instead of the browser voice. If the endpoint fails or is offline, AMAI silently falls back to the browser's built-in TTS so it never goes mute. The endpoint must return audio (`audio/wav`, `audio/mpeg`, `audio/ogg`).

### Ambient sounds — drop-in assets

The mixer expects MP3 files in `amai-login/public/sounds/`. Drop royalty-free loops you like under these exact filenames and they'll just work:

```
amai-login/public/sounds/
├── rain.mp3
├── fire.mp3
├── cafe.mp3
├── keyboard.mp3
├── ocean.mp3
├── wind.mp3
├── birds.mp3
└── thunder.mp3
```

Good free sources: [Pixabay sound effects](https://pixabay.com/sound-effects/), [freesound.org](https://freesound.org), [Mixkit](https://mixkit.co/free-sound-effects/). Look for seamless loop versions. Any sound without a matching file just stays silent — the mixer UI still renders.

---

## How It Works

### Authentication

Login sends a `POST /api/auth/login` with your username and password. The backend compares them against the values in `.env` — no user database, no hashing complexity. On success it issues a **JWT** (7-day expiry). The frontend stores it in `localStorage` if "Remember this device" is checked, otherwise it lives only in React state and expires when you close the tab.

Every subsequent API call sends `Authorization: Bearer <token>`. If the token expires or is invalid, the backend returns `401` and the frontend automatically drops you back to the login screen.

### Data Storage

All data is stored as **plain JSON files** in `backend/data/` — one file per collection:

```
notes.json   → array of note objects
tasks.json   → array of task objects
journal.json → object keyed by date (YYYY-MM-DD)
```

The directory is created automatically on first run. Because it's gitignored, your personal data never touches the repo.

### Auto-save Journal

The journal widget uses a **debounced save** — it waits 900 ms after you stop typing, then fires a `PUT /api/journal/:date`. A "saved ✓" indicator briefly appears. The initial load is silently skipped to avoid overwriting the file with itself on mount.

### Note Colors & Pinning

Notes support 5 states: default lavender, rose, mint, gold, and sky. The color is stored as a string on the note object and applied as a CSS class (`color-rose`, `color-mint`, etc.) that changes the card's left border and background tint. Pinned notes appear in the Home dashboard grid — unpinning them removes them from home without deleting them.

---

## Design System

The UI uses a custom dark lavender palette with no external component library.

| Token | Value | Role |
|---|---|---|
| Background | `#0d0b18` | Page canvas |
| Sidebar | `#110e22` | Navigation panel |
| Surface | `rgba(255,255,255,0.04)` | Cards, widgets |
| Lavender | `#7c5cbf` | Primary accent, buttons |
| Lavender light | `#a07ee0` | Hovers, highlights, glow |
| Rose tag | `#fb7185` | Note color option |
| Mint tag | `#34d399` | Note color option |
| Gold tag | `#fbbf24` | Note color option |
| Sky tag | `#38bdf8` | Note color option |

The **Amai mascot** in the sidebar is a hand-crafted inline SVG — no image files, no external assets. The login page uses the same lavender palette but in light mode, with floating petal animations and a heartbeat logo.

---

## Customization

**Change your credentials** — `backend/.env`:
```env
AMAI_USERNAME=yourname
AMAI_PASSWORD=yourpassword
```

**Change the port** — same file:
```env
PORT=3001
```

The frontend uses relative API paths via Vite's dev proxy / production rewrite, so no `API_BASE` to edit.

**Swap the waifu character** — replace `amai-login/public/waifu.png` with any portrait PNG (transparent background looks best on the dark dashboard).

---

## Security Notes

- `.env` is gitignored — credentials never touch the repo
- `backend/data/` is gitignored — your notes/tasks/journal stay local
- Tokens expire after 7 days; the frontend handles 401s automatically
- Built for **local personal use only** — do not expose the backend publicly without additional hardening (HTTPS, rate limiting, etc.)

---

*Built with React, Express, and too much lavender.*
