# 甘い AMAI — Personal Workspace

> A private, single-user productivity space with a waifu aesthetic.  
> Notes · Tasks · Journal — all running locally, all yours.
> Partially made with the help of claude ai.
---

## What is this?

AMAI (甘い — Japanese for *sweet*) is a personal workspace built for one user. Think Notion, but dark, lavender-themed, and with a chibi mascot living in the sidebar. No cloud sync, no accounts, no telemetry — your data lives in plain JSON files on your own machine.

### Features

| Section | What it does |
|---|---|
| **Home** | Greeting + live clock, today's journal (auto-saves as you type), tasks widget, pinned notes |
| **Notes** | Searchable card grid · create, edit, delete · 4 color tags · pin notes to your home dashboard |
| **Tasks** | Full checklist · To Do / Completed sections · progress bar |
| **Journal** | Today's freewrite entry (auto-saves) · past entries as an expandable accordion |

Everything persists between sessions — notes, tasks, and journal entries are written to JSON files in `backend/data/`.

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
│   ├── src/
│   │   ├── App.jsx      # All views: Login, Home, Notes, Tasks, Journal
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
│   │   └── journal.json
│   ├── .env             # Your input credentials (gitignored — never committed)
│   ├── .env.example     # Template incase i forgor
│   └── package.json
│
└── .gitignore
```

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

If you change the backend port, update `API_BASE` in `amai-login/src/App.jsx`:
```js
const API_BASE = 'http://localhost:3001'
```

---

## Security Notes

- `.env` is gitignored — credentials never touch the repo
- `backend/data/` is gitignored — your notes/tasks/journal stay local
- Tokens expire after 7 days; the frontend handles 401s automatically
- Built for **local personal use only** — do not expose the backend publicly without additional hardening (HTTPS, rate limiting, etc.)

---

*Built with React, Express, and too much lavender.*
