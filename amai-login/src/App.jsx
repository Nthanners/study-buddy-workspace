import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './index.css'
import './dashboard.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0')
const todayKey = () => new Date().toISOString().slice(0, 10)

function fmtClock(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtDateFull(d = new Date()) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function fmtDateShort(str) {
  return new Date(str + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Affirmations ──────────────────────────────────────────────────────────────

const AFFIRMATIONS = [
  "You're doing better than you think.",
  "One small step today still counts.",
  "Take a breath — you've got time.",
  "Your effort matters, even when no one sees it.",
  "Be gentle with yourself today.",
  "Done is better than perfect.",
  "Small wins stack into big ones.",
  "It's okay to rest. Rest is productive too.",
  "You've gotten through every hard day so far.",
  "Trust the process — and trust yourself.",
  "Progress isn't always loud.",
  "You don't have to figure it all out today.",
  "Showing up is half the battle.",
  "The work you're doing matters.",
  "Be proud of how far you've come.",
]

function dailyAffirmation() {
  const d = new Date()
  const seed = d.getFullYear() * 1000 + (d.getMonth() + 1) * 50 + d.getDate()
  return AFFIRMATIONS[seed % AFFIRMATIONS.length]
}

// ── Task helpers ──────────────────────────────────────────────────────────────

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 }

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority ?? 'normal']
    const pb = PRIORITY_RANK[b.priority ?? 'normal']
    if (pa !== pb) return pa - pb
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })
}

function dueLabel(dateStr) {
  if (!dateStr) return null
  const today = todayKey()
  if (dateStr === today) return { text: 'Today', tone: 'today' }
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((d - now) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: 'overdue' }
  if (diff === 1) return { text: 'Tomorrow', tone: 'soon' }
  if (diff <= 7) return { text: `In ${diff}d`, tone: 'soon' }
  return { text: fmtDateShort(dateStr), tone: 'later' }
}

function stripMarkdown(s = '') {
  return s
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .trim()
}

function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return ["It's late~",        "Don't forget to rest."]
  if (h < 12) return ["Good morning!",     "Ready to make today count?"]
  if (h < 17) return ["Good afternoon~",   "How's your day going?"]
  if (h < 21) return ["Good evening!",     "Time to wind down."]
  return              ["Good night~",       "Here to help you unwind."]
}

// ── Scenes ────────────────────────────────────────────────────────────────────

const SCENES = [
  { id: 'lavender-night', name: 'Lavender Night', vibe: 'cozy stars',     preview: '🌙' },
  { id: 'sakura-cafe',    name: 'Sakura Café',    vibe: 'falling petals', preview: '🌸' },
  { id: 'rainy-study',    name: 'Rainy Study',    vibe: 'soft rain',      preview: '🌧️' },
  { id: 'fireplace',      name: 'Fireplace',      vibe: 'warm glow',      preview: '🔥' },
  { id: 'lofi-bedroom',   name: 'Lo-fi Bedroom',  vibe: 'drifting',       preview: '🎧' },
  { id: 'starlight',      name: 'Starlight',      vibe: 'deep space',     preview: '✨' },
]

// ── Sounds ────────────────────────────────────────────────────────────────────
// User drops MP3 files into amai-login/public/sounds/

const SOUNDS = [
  { id: 'rain',     name: 'Rain',     emoji: '🌧️', src: '/sounds/rain.mp3' },
  { id: 'fire',     name: 'Fireplace', emoji: '🔥', src: '/sounds/fire.mp3' },
  { id: 'cafe',     name: 'Café',     emoji: '☕', src: '/sounds/cafe.mp3' },
  { id: 'keyboard', name: 'Keyboard', emoji: '⌨️', src: '/sounds/keyboard.mp3' },
  { id: 'ocean',    name: 'Ocean',    emoji: '🌊', src: '/sounds/ocean.mp3' },
  { id: 'wind',     name: 'Wind',     emoji: '🌬️', src: '/sounds/wind.mp3' },
  { id: 'birds',    name: 'Birds',    emoji: '🐦', src: '/sounds/birds.mp3' },
  { id: 'thunder',  name: 'Thunder',  emoji: '⛈️', src: '/sounds/thunder.mp3' },
]

// ── Music presets ─────────────────────────────────────────────────────────────

const MUSIC_PRESETS = [
  { id: 'lofi-girl',  name: 'lofi girl — beats to relax/study', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1' },
  { id: 'lofi-sleep', name: 'lofi girl — sleepy beats',          url: 'https://www.youtube.com/embed/rUxyKA_-grg?autoplay=1' },
  { id: 'synthwave',  name: 'synthwave radio',                   url: 'https://www.youtube.com/embed/MVPTGNGiI-4?autoplay=1' },
  { id: 'jazz',       name: 'cozy jazz',                         url: 'https://www.youtube.com/embed/Dx5qFachd3A?autoplay=1' },
  { id: 'piano',      name: 'soft piano',                        url: 'https://www.youtube.com/embed/4xDzrJKXOOY?autoplay=1' },
]

// ── Theme presets (scene + accent + suggested sounds) ────────────────────────

const PRESETS = [
  {
    id: 'lavender-night',
    name: 'Lavender Night',
    scene: 'lavender-night',
    accent: '#a07ee0',
    sounds: { wind: 30 },
  },
  {
    id: 'sakura-cafe',
    name: 'Sakura Café',
    scene: 'sakura-cafe',
    accent: '#fb7185',
    sounds: { cafe: 50, birds: 25 },
  },
  {
    id: 'rainy-study',
    name: 'Rainy Study',
    scene: 'rainy-study',
    accent: '#7c5cbf',
    sounds: { rain: 60, thunder: 15 },
  },
  {
    id: 'cozy-fireplace',
    name: 'Cozy Fireplace',
    scene: 'fireplace',
    accent: '#fbbf24',
    sounds: { fire: 70, wind: 20 },
  },
  {
    id: 'lofi-bedroom',
    name: 'Lo-fi Bedroom',
    scene: 'lofi-bedroom',
    accent: '#a07ee0',
    sounds: { keyboard: 25 },
  },
]

// ── Waifu state ───────────────────────────────────────────────────────────────

function getWaifuState({ focus, onBreak }) {
  if (onBreak) return 'break'
  if (focus)   return 'focus'
  const h = new Date().getHours()
  if (h < 6)  return 'night'
  if (h < 11) return 'morning'
  if (h < 18) return 'day'
  if (h < 22) return 'evening'
  return 'night'
}

const WAIFU_SRC = {
  morning: '/waifu.png',
  day:     '/waifu.png',
  evening: '/waifu.png',
  night:   '/waifu.png',
  focus:   '/waifu.png',
  break:   '/waifu.png',
}

// ── Streaks ───────────────────────────────────────────────────────────────────

function streakFromDates(datesSet) {
  let n = 0
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  while (datesSet.has(d.toISOString().slice(0, 10))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

// ── API client ────────────────────────────────────────────────────────────────

function makeApi(token, onUnauth) {
  const json = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const auth = { Authorization: `Bearer ${token}` }
  const handle = async (r) => {
    if (r.status === 401) { onUnauth(); return null }
    if (!r.ok) return null
    try { return await r.json() } catch { return null }
  }
  const safe = (p) => p.catch(() => null)
  return {
    get:  (p)    => safe(fetch(p, { headers: auth }).then(handle)),
    post: (p, b) => safe(fetch(p, { method: 'POST',   headers: json, body: JSON.stringify(b) }).then(handle)),
    put:  (p, b) => safe(fetch(p, { method: 'PUT',    headers: json, body: JSON.stringify(b) }).then(handle)),
    del:  (p)    => safe(fetch(p, { method: 'DELETE', headers: auth }).then(handle)),
  }
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const HomeIcon    = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const NotesIcon   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
const TasksIcon   = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
const JournalIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const PlusIcon    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
const TrashIcon   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const CloseIcon   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const PinIcon     = ({ filled }) => <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
const CheckIcon   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const LogoutIcon  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const UserIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const LockIcon    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
const EyeIcon     = ({ off }) => off
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>

// ── Logo ──────────────────────────────────────────────────────────────────────

const AmaiMark = ({ className }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 52 L12 32 C6 26 6 16 14 14 C22 12 28 18 32 24 C36 18 42 12 50 14 C58 16 58 26 52 32 Z" fill="currentColor" opacity="0.95"/>
    <path d="M20 28 L26 28 L28 31 L36 31 L38 28 L44 28" stroke="#ede8f8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    <circle cx="32" cy="31" r="2.5" fill="#ede8f8"/>
    <circle cx="20" cy="28" r="1.5" fill="#ede8f8"/>
    <circle cx="44" cy="28" r="1.5" fill="#ede8f8"/>
  </svg>
)

// ── Note Card ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onClick }) {
  const colorClass = note.color ? `color-${note.color}` : ''
  const preview = note.content ? stripMarkdown(note.content) : ''
  return (
    <div className={`note-card ${colorClass}`} onClick={onClick}>
      {note.pinned && <span className="note-card-pin"><PinIcon filled /></span>}
      <div className="note-card-title">{note.title || 'Untitled'}</div>
      <div className="note-card-preview">{preview || <span className="text-faint-50">No content</span>}</div>
      <div className="note-card-date">{fmtDateShort(note.updatedAt?.slice(0, 10) || note.createdAt?.slice(0, 10))}</div>
    </div>
  )
}

// ── Note Modal ────────────────────────────────────────────────────────────────

const NOTE_COLORS = [null, 'rose', 'mint', 'gold', 'sky']

function NoteModal({ note, onClose, onDelete }) {
  const [draft, setDraft] = useState({ ...note })
  const [mode, setMode] = useState(note.id ? 'preview' : 'edit')
  const contentRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(draft) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onClose])

  useEffect(() => { if (mode === 'edit') contentRef.current?.focus() }, [mode])

  const set = (key, val) => setDraft(p => ({ ...p, [key]: val }))

  return (
    <div className="modal-backdrop" onClick={() => onClose(draft)}>
      <div className={`note-modal${draft.color ? ` color-${draft.color}` : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <input
            className="modal-title-input"
            value={draft.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Untitled"
          />
          <div className="modal-mode-toggle">
            <button
              className={`mode-btn${mode === 'edit' ? ' active' : ''}`}
              onClick={() => setMode('edit')}
            >Edit</button>
            <button
              className={`mode-btn${mode === 'preview' ? ' active' : ''}`}
              onClick={() => setMode('preview')}
            >Preview</button>
          </div>
          <button className="modal-close-btn" onClick={() => onClose(draft)}><CloseIcon /></button>
        </div>

        {mode === 'edit' ? (
          <textarea
            ref={contentRef}
            className="modal-content-input"
            value={draft.content}
            onChange={e => set('content', e.target.value)}
            placeholder="Start writing... (markdown supported)"
          />
        ) : (
          <div className="modal-content-preview markdown-body">
            {draft.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown>
            ) : (
              <div className="text-faint-50">Nothing to preview yet.</div>
            )}
          </div>
        )}

        <div className="modal-footer">
          <div className="color-dots">
            {NOTE_COLORS.map(c => (
              <button
                key={c ?? 'null'}
                className={`color-dot${draft.color === c ? ' active' : ''}`}
                data-color={c ?? 'null'}
                onClick={() => set('color', c)}
                title={c ?? 'default'}
              />
            ))}
          </div>

          <button
            className={`modal-footer-btn${draft.pinned ? ' pin-active' : ''}`}
            onClick={() => set('pinned', !draft.pinned)}
          >
            <PinIcon filled={draft.pinned} />
            {draft.pinned ? 'Pinned' : 'Pin'}
          </button>

          {draft.id && (
            <button className="modal-footer-btn delete" onClick={() => onDelete(draft.id)}>
              <TrashIcon /> Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Journal Entry Card (history) ──────────────────────────────────────────────

function JournalEntryCard({ entry }) {
  const [open, setOpen] = useState(false)
  const mood = MOODS.find(m => m.id === entry.mood)
  return (
    <div className="journal-entry-card">
      <div className="journal-entry-header" onClick={() => setOpen(o => !o)}>
        <span className="journal-entry-date">{fmtDateShort(entry.date)}</span>
        {mood && <span className="journal-entry-mood" title={mood.label}>{mood.emoji}</span>}
        {!open && (
          <span className="journal-entry-preview">
            {entry.content?.slice(0, 60) || <em className="text-faint-50">empty</em>}
          </span>
        )}
        <span className="journal-entry-expand">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="journal-entry-content">{entry.content || <em className="text-faint-50">No content.</em>}</div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, onLogout, onOpenVibe, onOpenSearch, onToggleFocus, onOpenChat }) {
  const links = [
    { id: 'home',    label: 'Home',    icon: <HomeIcon /> },
    { id: 'notes',   label: 'Notes',   icon: <NotesIcon /> },
    { id: 'tasks',   label: 'Tasks',   icon: <TasksIcon /> },
    { id: 'habits',  label: 'Habits',  icon: <span className="icon-emoji-sm">🌱</span> },
    { id: 'journal', label: 'Journal', icon: <JournalIcon /> },
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <AmaiMark className="sidebar-brand-mark" />
          <span className="sidebar-brand-name">Study Buddy</span>
        </div>
      </div>

      <nav className="nav-section">
        <div className="nav-label">Workspace</div>
        {links.map(l => (
          <button
            key={l.id}
            className={`nav-link${view === l.id ? ' active' : ''}`}
            onClick={() => setView(l.id)}
          >
            {l.icon}
            <span>{l.label}</span>
          </button>
        ))}
      </nav>

      <nav className="nav-section">
        <div className="nav-label">Tools</div>
        <button className="nav-link" onClick={onOpenSearch}>
          <span className="icon-emoji-sm">🔍</span>
          <span>Search</span>
          <span className="nav-kbd">⌘K</span>
        </button>
        <button className="nav-link" onClick={onOpenChat}>
          <span className="icon-emoji-sm">💬</span>
          <span>Chat</span>
          <span className="nav-kbd">⌘J</span>
        </button>
        <button className="nav-link" onClick={onOpenVibe}>
          <span className="icon-emoji-sm">🎨</span>
          <span>Vibe</span>
        </button>
        <button className="nav-link" onClick={onToggleFocus}>
          <span className="icon-emoji-sm">🎯</span>
          <span>Focus</span>
          <span className="nav-kbd">⌘.</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <LogoutIcon />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}

// ── Home View ─────────────────────────────────────────────────────────────────

function HomeView({ notes, tasks, todayJournal, journalSaveStatus, onJournalChange, onTaskAdd, onTaskToggle, onTaskDelete, onNoteOpen, setView, journalEntries, focusSessions, habits }) {
  const [greeting, greetingSub] = useMemo(getGreeting, [])
  const [clock, setClock] = useState(fmtClock)
  const [taskInput, setTaskInput] = useState('')

  useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 1000)
    return () => clearInterval(id)
  }, [])

  const incompleteTasks = useMemo(() => sortTasks(tasks.filter(t => !t.done)), [tasks])
  const doneTasks       = tasks.filter(t => t.done)
  const pinnedNotes     = notes.filter(n => n.pinned)
  const doneRatio       = tasks.length ? doneTasks.length / tasks.length : 0

  const handleAddTask = (e) => {
    e.preventDefault()
    if (!taskInput.trim()) return
    onTaskAdd({ text: taskInput.trim() })
    setTaskInput('')
  }

  return (
    <div>
      <div className="home-header">
        <div>
          <div className="home-greeting">{greeting}</div>
          <div className="home-sub">{greetingSub}</div>
          <div className="home-date">{fmtDateFull()}</div>
        </div>
        <div className="home-header-right">
          <WeatherWidget />
          <div className="home-clock">{clock}</div>
        </div>
      </div>

      <DailyStatsRibbon
        tasks={tasks}
        journalEntries={journalEntries || []}
        focusSessions={focusSessions || []}
        habits={habits || []}
      />

      <div className="home-grid">
        {/* Journal widget */}
        <div className="widget journal-widget">
          <div className="widget-header">
            <span className="widget-title">Today's Journal</span>
            {journalSaveStatus && <span className="save-status">{journalSaveStatus}</span>}
          </div>
          <textarea
            className="journal-textarea"
            value={todayJournal}
            onChange={e => onJournalChange(e.target.value)}
            placeholder="How are you feeling today? Write anything on your mind..."
          />
          <div className="journal-meta">
            {wordCount(todayJournal)} {wordCount(todayJournal) === 1 ? 'word' : 'words'}
          </div>
        </div>

        {/* Tasks widget */}
        <div className="widget tasks-widget">
          <div className="widget-header">
            <span className="widget-title">Tasks</span>
            <span className="tasks-count">{doneTasks.length}/{tasks.length}</span>
          </div>

          <div className="tasks-progress">
            <div className="tasks-progress-bar" style={{ width: `${doneRatio * 100}%` }} />
          </div>

          <div className="task-list">
            {incompleteTasks.slice(0, 5).map(t => {
              const due = dueLabel(t.dueDate)
              const prio = t.priority && t.priority !== 'normal' ? t.priority : null
              return (
                <div key={t.id} className={`task-item${prio ? ` prio-${prio}` : ''}`}>
                  <button className="task-check-btn" onClick={() => onTaskToggle(t.id, true)}>
                    <div className="task-circle-empty" />
                  </button>
                  <span className="task-text">{t.text}</span>
                  {due && <span className={`task-due tone-${due.tone}`}>{due.text}</span>}
                  <button className="task-del-btn" onClick={() => onTaskDelete(t.id)}><TrashIcon /></button>
                </div>
              )
            })}
            {doneTasks.slice(0, 2).map(t => (
              <div key={t.id} className="task-item">
                <button className="task-check-btn done" onClick={() => onTaskToggle(t.id, false)}>
                  <CheckIcon />
                </button>
                <span className="task-text done">{t.text}</span>
                <button className="task-del-btn" onClick={() => onTaskDelete(t.id)}><TrashIcon /></button>
              </div>
            ))}
          </div>

          <form className="task-add-form" onSubmit={handleAddTask}>
            <button type="submit" className="task-add-btn"><PlusIcon /></button>
            <input
              className="task-add-input"
              value={taskInput}
              onChange={e => setTaskInput(e.target.value)}
              placeholder="Add a task..."
            />
          </form>

          {tasks.length > 7 && (
            <button className="view-all-btn" onClick={() => setView('tasks')}>
              View all {tasks.length} tasks →
            </button>
          )}
        </div>
      </div>

      {/* Pinned notes */}
      {pinnedNotes.length > 0 && (
        <div className="home-section">
          <div className="section-header">
            <span className="section-title">Pinned Notes</span>
            <button className="section-action" onClick={() => setView('notes')}>All notes →</button>
          </div>
          <div className="pinned-grid">
            {pinnedNotes.map(n => (
              <NoteCard key={n.id} note={n} onClick={() => onNoteOpen(n)} />
            ))}
          </div>
        </div>
      )}

      {pinnedNotes.length === 0 && (
        <div className="home-section">
          <div className="section-header">
            <span className="section-title">Pinned Notes</span>
            <button className="section-action" onClick={() => setView('notes')}>Go to Notes →</button>
          </div>
          <div className="empty-state">
            <div className="empty-state-icon">📌</div>
            <p>No pinned notes yet.<br />Pin a note to see it here.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Notes View ────────────────────────────────────────────────────────────────

function NotesView({ notes, onNoteOpen, onNoteCreate }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return notes
    const q = search.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    )
  }, [notes, search])

  return (
    <div>
      <div className="view-header">
        <span className="view-title">Notes</span>
        <div className="notes-search-row">
          <input
            className="notes-search-input"
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className="new-btn" onClick={onNoteCreate}>
            <PlusIcon /> New Note
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✨</div>
          <p>{search ? 'No notes match your search.' : 'No notes yet.\nCreate your first one!'}</p>
        </div>
      ) : (
        <div className="notes-grid">
          {filtered.map(n => (
            <NoteCard key={n.id} note={n} onClick={() => onNoteOpen(n)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tasks Full View ───────────────────────────────────────────────────────────

function TasksView({ tasks, onAdd, onToggle, onDelete, onUpdate }) {
  const [input, setInput] = useState('')
  const [priority, setPriority] = useState('normal')
  const [dueDate, setDueDate] = useState('')

  const incompleteTasks = useMemo(() => sortTasks(tasks.filter(t => !t.done)), [tasks])
  const doneTasks       = tasks.filter(t => t.done)
  const doneRatio       = tasks.length ? doneTasks.length / tasks.length : 0

  const handleAdd = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    onAdd({ text: input.trim(), priority, dueDate: dueDate || null })
    setInput('')
    setPriority('normal')
    setDueDate('')
  }

  return (
    <div>
      <div className="view-header">
        <span className="view-title">Tasks</span>
        <span className="muted-mono">
          {doneTasks.length} / {tasks.length} done
        </span>
      </div>

      {tasks.length > 0 && (
        <div className="tasks-progress-wrap">
          <div className="tasks-progress thin">
            <div className="tasks-progress-bar" style={{ width: `${doneRatio * 100}%` }} />
          </div>
        </div>
      )}

      <form className="task-full-add" onSubmit={handleAdd}>
        <button type="submit" className="task-add-btn"><PlusIcon /></button>
        <input
          className="task-full-add-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a new task and press Enter..."
          autoFocus
        />
        <select
          className="task-meta-select"
          value={priority}
          onChange={e => setPriority(e.target.value)}
          title="Priority"
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          className="task-meta-date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          title="Due date"
        />
      </form>

      {incompleteTasks.length > 0 && (
        <>
          <div className="tasks-section-label">To do</div>
          <div className="tasks-full-list">
            {incompleteTasks.map(t => {
              const due = dueLabel(t.dueDate)
              const prio = t.priority ?? 'normal'
              return (
                <div key={t.id} className={`task-full-item prio-${prio}`}>
                  <button className="task-check-btn" onClick={() => onToggle(t.id, true)}>
                    <div className="task-circle-empty" />
                  </button>
                  <span className="task-full-text">{t.text}</span>
                  <select
                    className="task-meta-select inline"
                    value={prio}
                    onChange={e => onUpdate(t.id, { priority: e.target.value })}
                    title="Priority"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                  <input
                    type="date"
                    className="task-meta-date inline"
                    value={t.dueDate ?? ''}
                    onChange={e => onUpdate(t.id, { dueDate: e.target.value || null })}
                    title="Due date"
                  />
                  {due && <span className={`task-due tone-${due.tone}`}>{due.text}</span>}
                  <button className="task-del-btn always-visible" onClick={() => onDelete(t.id)}><TrashIcon /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {doneTasks.length > 0 && (
        <>
          <div className="tasks-section-label">Completed</div>
          <div className="tasks-full-list">
            {doneTasks.map(t => (
              <div key={t.id} className="task-full-item done">
                <button className="task-check-btn done" onClick={() => onToggle(t.id, false)}>
                  <CheckIcon />
                </button>
                <span className="task-full-text done">{t.text}</span>
                <span className="task-full-date">{fmtDateShort(t.createdAt?.slice(0,10))}</span>
                <button className="task-del-btn always-visible" onClick={() => onDelete(t.id)}><TrashIcon /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {tasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <p>No tasks yet. Add one above!</p>
        </div>
      )}
    </div>
  )
}

// ── Journal View ──────────────────────────────────────────────────────────────

function JournalView({ entries, todayJournal, todayMood, saveStatus, onTodayChange, onMoodChange }) {
  const pastEntries = useMemo(
    () => entries.filter(e => e.date !== todayKey()),
    [entries]
  )

  return (
    <div>
      <div className="view-header">
        <span className="view-title">Journal</span>
      </div>

      <div className="journal-today">
        <div className="journal-today-header">
          <span className="journal-today-date">{fmtDateFull()}</span>
          {saveStatus && <span className="save-status">{saveStatus}</span>}
        </div>
        <div className="journal-mood-row">
          <span className="journal-mood-label">How are you feeling?</span>
          <MoodPicker value={todayMood} onChange={onMoodChange} />
        </div>
        <textarea
          className="journal-big-textarea"
          value={todayJournal}
          onChange={e => onTodayChange(e.target.value)}
          placeholder="How are you feeling today? Write freely — this space is just for you."
        />
        <div className="journal-meta">
          {wordCount(todayJournal)} {wordCount(todayJournal) === 1 ? 'word' : 'words'}
        </div>
      </div>

      {pastEntries.length > 0 && (
        <div className="journal-history">
          <div className="journal-history-title">Past Entries</div>
          {pastEntries.map(e => (
            <JournalEntryCard key={e.date} entry={e} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Waifu Widget ─────────────────────────────────────────────────────────────

function WaifuWidget({ state = 'day', message, onClick, listening }) {
  const [showBubble, setShowBubble] = useState(true)
  const dailyMsg = useMemo(dailyAffirmation, [])
  const text = message ?? dailyMsg
  const src = WAIFU_SRC[state] || WAIFU_SRC.day

  return (
    <div className={`waifu-widget waifu-${state}${listening ? ' listening' : ''}`}>
      {showBubble && text && (
        <div
          className="waifu-bubble"
          onClick={(e) => { e.stopPropagation(); setShowBubble(false) }}
          title="Click to dismiss"
        >
          <span className="waifu-bubble-text">{text}</span>
          <span className="waifu-bubble-tail" />
        </div>
      )}
      <div className="waifu-float" onClick={onClick} role="button" title="Click to chat with AMAI">
        <img src={src} alt="AMAI" className="waifu-img" draggable="false" />
        {listening && <span className="waifu-listening-dot" aria-hidden="true" />}
      </div>
    </div>
  )
}

// ── Search Palette ────────────────────────────────────────────────────────────

function SearchPalette({ notes, tasks, journalEntries, onClose, onPick }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return { notes: [], tasks: [], journal: [] }
    return {
      notes: notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      ).slice(0, 6),
      tasks: tasks.filter(t => (t.text || '').toLowerCase().includes(q)).slice(0, 6),
      journal: journalEntries.filter(e =>
        (e.content || '').toLowerCase().includes(q) ||
        (e.date || '').includes(q)
      ).slice(0, 6),
    }
  }, [query, notes, tasks, journalEntries])

  const total = results.notes.length + results.tasks.length + results.journal.length

  return (
    <div className="modal-backdrop search-backdrop" onClick={onClose}>
      <div className="search-palette" onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search notes, tasks, journal..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="search-hint">
          <span className="kbd">esc</span> to close
        </div>

        <div className="search-results">
          {!query.trim() && (
            <div className="search-empty">Type to search across your workspace.</div>
          )}
          {query.trim() && total === 0 && (
            <div className="search-empty">No matches.</div>
          )}

          {results.notes.length > 0 && (
            <>
              <div className="search-group-label">Notes</div>
              {results.notes.map(n => (
                <button key={`n-${n.id}`} className="search-result" onClick={() => onPick({ kind: 'note', item: n })}>
                  <span className="search-kind">note</span>
                  <span className="search-title">{n.title || 'Untitled'}</span>
                  <span className="search-snippet">{stripMarkdown(n.content || '').slice(0, 80)}</span>
                </button>
              ))}
            </>
          )}

          {results.tasks.length > 0 && (
            <>
              <div className="search-group-label">Tasks</div>
              {results.tasks.map(t => (
                <button key={`t-${t.id}`} className="search-result" onClick={() => onPick({ kind: 'task', item: t })}>
                  <span className="search-kind">task</span>
                  <span className="search-title">{t.text}</span>
                  <span className="search-snippet">{t.done ? 'completed' : 'to do'}</span>
                </button>
              ))}
            </>
          )}

          {results.journal.length > 0 && (
            <>
              <div className="search-group-label">Journal</div>
              {results.journal.map(e => (
                <button key={`j-${e.date}`} className="search-result" onClick={() => onPick({ kind: 'journal', item: e })}>
                  <span className="search-kind">journal</span>
                  <span className="search-title">{fmtDateShort(e.date)}</span>
                  <span className="search-snippet">{(e.content || '').slice(0, 80)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Scene (animated background) ───────────────────────────────────────────────

function Scene({ id }) {
  return (
    <div className={`scene scene-${id}`} aria-hidden="true">
      {id === 'lavender-night' && (
        <>
          <div className="scene-stars" />
          <div className="scene-moon" />
          <div className="scene-clouds" />
        </>
      )}
      {id === 'sakura-cafe' && (
        <>
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="petal" style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 12}s`,
              animationDuration: `${10 + Math.random() * 12}s`,
              opacity: 0.5 + Math.random() * 0.4,
            }} />
          ))}
        </>
      )}
      {id === 'rainy-study' && (
        <>
          <div className="scene-rain" />
          <div className="scene-fog" />
        </>
      )}
      {id === 'fireplace' && (
        <>
          <div className="scene-fire-glow" />
          <div className="scene-embers">
            {Array.from({ length: 18 }).map((_, i) => (
              <span key={i} className="ember" style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 4}s`,
              }} />
            ))}
          </div>
        </>
      )}
      {id === 'lofi-bedroom' && (
        <>
          <div className="scene-bedroom" />
          <div className="scene-particles">
            {Array.from({ length: 20 }).map((_, i) => (
              <span key={i} className="lofi-dot" style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${15 + Math.random() * 15}s`,
              }} />
            ))}
          </div>
        </>
      )}
      {id === 'starlight' && (
        <>
          <div className="scene-stars" />
          <div className="scene-stars-fast" />
        </>
      )}
    </div>
  )
}

// ── Ambient sound mixer ───────────────────────────────────────────────────────

function AmbientMixer({ levels, onChange }) {
  return (
    <div className="vibe-section">
      <div className="vibe-section-title">Ambient sounds</div>
      <div className="sound-grid">
        {SOUNDS.map(s => {
          const v = levels[s.id] ?? 0
          return (
            <div key={s.id} className={`sound-tile${v > 0 ? ' active' : ''}`}>
              <div className="sound-row">
                <span className="sound-emoji">{s.emoji}</span>
                <span className="sound-name">{s.name}</span>
                <button
                  className="sound-toggle"
                  onClick={() => onChange(s.id, v > 0 ? 0 : 50)}
                >{v > 0 ? 'on' : 'off'}</button>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={v}
                onChange={e => onChange(s.id, +e.target.value)}
                className="sound-slider"
              />
            </div>
          )
        })}
      </div>
      <div className="vibe-section-hint">
        Drop matching <code>.mp3</code> files into <code>amai-login/public/sounds/</code>
      </div>
    </div>
  )
}

// ── Music player (YouTube embed) ──────────────────────────────────────────────

function MusicPlayer({ music, onChange }) {
  return (
    <div className="vibe-section">
      <div className="vibe-section-title">Music</div>
      <div className="music-presets">
        {MUSIC_PRESETS.map(p => (
          <button
            key={p.id}
            className={`music-preset${music.url === p.url ? ' active' : ''}`}
            onClick={() => onChange({ ...music, url: p.url, playing: true })}
          >{p.name}</button>
        ))}
        {music.url && (
          <button
            className="music-preset music-stop"
            onClick={() => onChange({ ...music, url: '', playing: false })}
          >stop</button>
        )}
      </div>
      {music.url && (
        <div className="music-frame-wrap">
          <iframe
            className="music-frame"
            src={music.url}
            title="music"
            allow="autoplay; encrypted-media"
          />
        </div>
      )}
    </div>
  )
}

// ── Pomodoro timer ────────────────────────────────────────────────────────────

function fmtMS(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${pad(m)}:${pad(s)}`
}

function PomodoroTimer({ pomo, setPomo, onComplete }) {
  useEffect(() => {
    if (!pomo.running) return
    const id = setInterval(() => {
      setPomo(p => {
        if (!p.running) return p
        if (p.remaining <= 1) {
          onComplete(p)
          const isWork = p.mode === 'work'
          const nextCycles = isWork ? p.cycles + 1 : p.cycles
          const nextMode = isWork
            ? (nextCycles % p.cyclesBeforeLong === 0 ? 'long' : 'break')
            : 'work'
          const nextMin = nextMode === 'work' ? p.workMin
                        : nextMode === 'break' ? p.breakMin
                        : p.longBreakMin
          return { ...p, mode: nextMode, cycles: nextCycles, remaining: nextMin * 60, running: false }
        }
        return { ...p, remaining: p.remaining - 1 }
      })
    }, 1000)
    return () => clearInterval(id)
  }, [pomo.running, setPomo, onComplete])

  const total = (pomo.mode === 'work' ? pomo.workMin
              : pomo.mode === 'break' ? pomo.breakMin
              : pomo.longBreakMin) * 60
  const pct = total > 0 ? 1 - pomo.remaining / total : 0
  const label = pomo.mode === 'work' ? 'Focus' : pomo.mode === 'break' ? 'Break' : 'Long break'

  const reset = () => setPomo(p => ({
    ...p,
    running: false,
    remaining: (p.mode === 'work' ? p.workMin : p.mode === 'break' ? p.breakMin : p.longBreakMin) * 60,
  }))

  return (
    <div className={`pomo-widget mode-${pomo.mode}`}>
      <div className="pomo-ring">
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none"/>
          <circle
            cx="40" cy="40" r="34"
            stroke="currentColor" strokeWidth="4" fill="none"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct)}`}
            strokeLinecap="round"
            transform="rotate(-90 40 40)"
            style={{ transition: 'stroke-dashoffset 0.3s linear' }}
          />
        </svg>
        <div className="pomo-time">{fmtMS(pomo.remaining)}</div>
      </div>
      <div className="pomo-meta">
        <div className="pomo-label">{label}</div>
        <div className="pomo-cycles">cycle {pomo.cycles}</div>
        <div className="pomo-controls">
          <button onClick={() => setPomo(p => ({ ...p, running: !p.running }))}>
            {pomo.running ? 'pause' : 'start'}
          </button>
          <button onClick={reset}>reset</button>
        </div>
      </div>
    </div>
  )
}

// ── Big clock (focus mode) ────────────────────────────────────────────────────

function BigClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="big-clock">
      <div className="big-clock-time">{fmtClock(now)}</div>
      <div className="big-clock-date">{fmtDateFull(now)}</div>
    </div>
  )
}

// ── Vibe panel ────────────────────────────────────────────────────────────────

function TTSEndpointConfig({ settings, updateSettings }) {
  const tts = settings.tts || { url: '', mode: 'json', textParam: 'text', auth: '' }
  const [testStatus, setTestStatus] = useState('')

  const set = (patch) => updateSettings({ tts: { ...tts, ...patch } })

  const test = async () => {
    setTestStatus('Testing…')
    try {
      await speakViaEndpoint('Hello! This is a test of your custom voice.', tts)
      setTestStatus('Played ✓')
    } catch (err) {
      setTestStatus(`Failed: ${err.message || err}`)
    }
    setTimeout(() => setTestStatus(''), 4000)
  }

  return (
    <div className="vibe-section">
      <div className="vibe-section-title">Custom voice (TTS endpoint)</div>
      <div className="tts-config">
        <label className="tts-field">
          <span>Endpoint URL</span>
          <input
            type="url"
            placeholder="http://localhost:5000/api/tts"
            value={tts.url}
            onChange={e => set({ url: e.target.value })}
          />
        </label>
        <label className="tts-field">
          <span>Body / format</span>
          <select value={tts.mode} onChange={e => set({ mode: e.target.value })}>
            <option value="json">POST JSON {`{ ${tts.textParam || 'text'} }`}</option>
            <option value="text">POST raw text body</option>
            <option value="query">GET ?{tts.textParam || 'text'}=…</option>
          </select>
        </label>
        {tts.mode !== 'text' && (
          <label className="tts-field">
            <span>Text param name</span>
            <input
              type="text"
              placeholder="text"
              value={tts.textParam || 'text'}
              onChange={e => set({ textParam: e.target.value })}
            />
          </label>
        )}
        <label className="tts-field">
          <span>Auth header (optional)</span>
          <input
            type="text"
            placeholder="Bearer xxxx"
            value={tts.auth}
            onChange={e => set({ auth: e.target.value })}
          />
        </label>
        <div className="tts-actions">
          <button type="button" onClick={test} disabled={!tts.url}>Test voice</button>
          {testStatus && <span className="tts-status">{testStatus}</span>}
          {tts.url && (
            <button type="button" className="tts-clear" onClick={() => set({ url: '' })}>Disable</button>
          )}
        </div>
      </div>
      <div className="vibe-section-hint">
        Endpoint must accept text and return audio (wav/mp3/ogg). When set + voice is on, AMAI uses your endpoint instead of the browser voice.
      </div>
    </div>
  )
}

function VibePanel({ open, onClose, settings, updateSettings }) {
  if (!open) return null
  const setSound = (id, vol) => {
    const sounds = { ...settings.sounds }
    if (vol === 0) delete sounds[id]
    else sounds[id] = vol
    updateSettings({ sounds })
  }
  const applyPreset = (preset) => {
    updateSettings({
      preset: preset.id,
      scene: preset.scene,
      sounds: preset.sounds,
    })
  }
  return (
    <>
      <div className="vibe-overlay" onClick={onClose} />
      <aside className="vibe-panel">
        <div className="vibe-header">
          <span className="vibe-title">Vibe</span>
          <button className="modal-close-btn" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="vibe-section">
          <div className="vibe-section-title">Presets</div>
          <div className="preset-grid">
            {PRESETS.map(p => (
              <button
                key={p.id}
                className={`preset-card${settings.preset === p.id ? ' active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                <span className="preset-dot" style={{ background: p.accent }} />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="vibe-section">
          <div className="vibe-section-title">Scene</div>
          <div className="scene-grid">
            {SCENES.map(s => (
              <button
                key={s.id}
                className={`scene-card${settings.scene === s.id ? ' active' : ''}`}
                onClick={() => updateSettings({ scene: s.id })}
              >
                <span className="scene-emoji">{s.preview}</span>
                <span className="scene-name">{s.name}</span>
                <span className="scene-vibe">{s.vibe}</span>
              </button>
            ))}
          </div>
        </div>

        <AmbientMixer levels={settings.sounds} onChange={setSound} />

        <MusicPlayer
          music={settings.music}
          onChange={(music) => updateSettings({ music })}
        />

        <div className="vibe-section">
          <div className="vibe-section-title">Voice & Wake Word</div>
          <label className="vibe-toggle">
            <input
              type="checkbox"
              checked={!!settings.wakeWord}
              onChange={e => updateSettings({ wakeWord: e.target.checked })}
            />
            <span>Listen for "AMAI" (wake word)</span>
          </label>
          <label className="vibe-toggle">
            <input
              type="checkbox"
              checked={!!settings.voiceOn}
              onChange={e => updateSettings({ voiceOn: e.target.checked })}
            />
            <span>Speak replies aloud (TTS)</span>
          </label>
          <div className="vibe-section-hint">
            Wake word runs the mic continuously. Browser will show a recording indicator. Chrome / Edge only.
          </div>
        </div>

        <TTSEndpointConfig settings={settings} updateSettings={updateSettings} />

        <div className="vibe-section">
          <div className="vibe-section-title">Pomodoro</div>
          <div className="pomo-config">
            <label>Work
              <input type="number" min="1" max="120" value={settings.pomodoro.workMin}
                onChange={e => updateSettings({ pomodoro: { ...settings.pomodoro, workMin: +e.target.value } })} />
            </label>
            <label>Break
              <input type="number" min="1" max="60" value={settings.pomodoro.breakMin}
                onChange={e => updateSettings({ pomodoro: { ...settings.pomodoro, breakMin: +e.target.value } })} />
            </label>
            <label>Long
              <input type="number" min="1" max="60" value={settings.pomodoro.longBreakMin}
                onChange={e => updateSettings({ pomodoro: { ...settings.pomodoro, longBreakMin: +e.target.value } })} />
            </label>
          </div>
        </div>
      </aside>
    </>
  )
}

// ── Sound engine (manages <audio> elements) ──────────────────────────────────

function useSoundEngine(levels) {
  const refs = useRef({})
  useEffect(() => {
    SOUNDS.forEach(s => {
      let el = refs.current[s.id]
      if (!el) {
        el = new Audio(s.src)
        el.loop = true
        refs.current[s.id] = el
      }
      const target = (levels[s.id] ?? 0) / 100
      el.volume = Math.max(0, Math.min(1, target))
      if (target > 0 && el.paused) {
        el.play().catch(() => { /* ignore — user gesture needed */ })
      } else if (target === 0 && !el.paused) {
        el.pause()
      }
    })
  }, [levels])
  useEffect(() => {
    const refsLocal = refs.current
    return () => {
      Object.values(refsLocal).forEach(el => { try { el.pause() } catch { /* */ } })
    }
  }, [])
}

// ── Weather widget ────────────────────────────────────────────────────────────

const WX_CODES = {
  0:  { label: 'clear', emoji: '☀️' },
  1:  { label: 'mostly clear', emoji: '🌤️' },
  2:  { label: 'partly cloudy', emoji: '⛅' },
  3:  { label: 'overcast', emoji: '☁️' },
  45: { label: 'foggy', emoji: '🌫️' },
  48: { label: 'foggy', emoji: '🌫️' },
  51: { label: 'drizzle', emoji: '🌦️' },
  53: { label: 'drizzle', emoji: '🌦️' },
  55: { label: 'drizzle', emoji: '🌦️' },
  61: { label: 'rain', emoji: '🌧️' },
  63: { label: 'rain', emoji: '🌧️' },
  65: { label: 'heavy rain', emoji: '🌧️' },
  71: { label: 'snow', emoji: '🌨️' },
  73: { label: 'snow', emoji: '🌨️' },
  75: { label: 'heavy snow', emoji: '❄️' },
  80: { label: 'showers', emoji: '🌦️' },
  95: { label: 'thunderstorm', emoji: '⛈️' },
}

function WeatherWidget() {
  const [wx, setWx] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`)
        const d = await r.json()
        setWx(d.current)
      } catch { /* ignore */ }
    }, () => {}, { timeout: 8000 })
  }, [])

  if (!wx) return null
  const code = WX_CODES[wx.weather_code] || { label: '', emoji: '🌡️' }
  return (
    <div className="weather-widget" title={code.label}>
      <span className="weather-emoji">{code.emoji}</span>
      <span className="weather-temp">{Math.round(wx.temperature_2m)}°</span>
      <span className="weather-label">{code.label}</span>
    </div>
  )
}

// ── Daily stats ribbon ────────────────────────────────────────────────────────

function DailyStatsRibbon({ tasks, journalEntries, focusSessions, habits }) {
  const today = todayKey()
  const todayDone = tasks.filter(t => t.done && (t.completedAt?.slice(0,10) === today || (!t.completedAt && t.createdAt?.slice(0,10) === today))).length
  const todayFocus = focusSessions
    .filter(s => s.completedAt?.slice(0,10) === today && s.type === 'work')
    .reduce((sum, s) => sum + (s.minutes || 0), 0)
  const journalSet = useMemo(() => new Set(journalEntries.filter(e => (e.content || '').trim()).map(e => e.date)), [journalEntries])
  const journalStreak = streakFromDates(journalSet)
  const habitsTotal = habits.length
  const habitsDoneToday = habits.filter(h => h.log?.[today]).length

  return (
    <div className="stats-ribbon">
      <div className="stat-cell"><span className="stat-num">{todayFocus}m</span><span className="stat-label">focus today</span></div>
      <div className="stat-cell"><span className="stat-num">{todayDone}</span><span className="stat-label">tasks done</span></div>
      <div className="stat-cell"><span className="stat-num">{journalStreak}🔥</span><span className="stat-label">journal streak</span></div>
      <div className="stat-cell"><span className="stat-num">{habitsDoneToday}/{habitsTotal}</span><span className="stat-label">habits today</span></div>
    </div>
  )
}

// ── Habits view ───────────────────────────────────────────────────────────────

const HABIT_COLORS = ['lavender', 'rose', 'mint', 'gold', 'sky']

function HabitHeatmap({ habit }) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 90; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ key, done: !!habit.log?.[key] })
  }
  return (
    <div className="habit-heatmap">
      {days.map(d => (
        <span key={d.key} className={`heat-cell color-${habit.color || 'lavender'}${d.done ? ' filled' : ''}`} title={`${d.key}${d.done ? ' ✓' : ''}`} />
      ))}
    </div>
  )
}

function HabitsView({ habits, onAdd, onToggle, onDelete }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [color, setColor] = useState('lavender')
  const today = todayKey()

  const handleAdd = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({ name: name.trim(), emoji, color })
    setName('')
    setEmoji('✨')
    setColor('lavender')
  }

  return (
    <div>
      <div className="view-header">
        <span className="view-title">Habits</span>
        <span className="muted-mono">
          {habits.filter(h => h.log?.[today]).length} / {habits.length} today
        </span>
      </div>

      <form className="habit-add-form" onSubmit={handleAdd}>
        <input
          className="habit-emoji-input"
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          maxLength={2}
        />
        <input
          className="habit-name-input"
          placeholder="New habit (e.g. Read 20 minutes)"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <select value={color} onChange={e => setColor(e.target.value)} className="habit-color-select">
          {HABIT_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className="new-btn"><PlusIcon /> Add</button>
      </form>

      {habits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🌱</div>
          <p>No habits yet. Add one above!</p>
        </div>
      ) : (
        <div className="habits-list">
          {habits.map(h => {
            const doneToday = !!h.log?.[today]
            const datesSet = new Set(Object.keys(h.log || {}))
            const streak = streakFromDates(datesSet)
            return (
              <div key={h.id} className={`habit-row${doneToday ? ' done' : ''}`}>
                <button
                  className={`habit-toggle${doneToday ? ' done' : ''}`}
                  onClick={() => onToggle(h.id)}
                  title={doneToday ? 'Done today' : 'Mark done'}
                >
                  <span className="habit-emoji">{h.emoji}</span>
                </button>
                <div className="habit-info">
                  <div className="habit-name">{h.name}</div>
                  <div className="habit-streak">{streak > 0 ? `${streak} day streak 🔥` : 'no streak yet'}</div>
                </div>
                <HabitHeatmap habit={h} />
                <button className="task-del-btn always-visible" onClick={() => onDelete(h.id)}><TrashIcon /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Mood picker ───────────────────────────────────────────────────────────────

const MOODS = [
  { id: 'great',  emoji: '😄', label: 'Great' },
  { id: 'good',   emoji: '🙂', label: 'Good' },
  { id: 'okay',   emoji: '😐', label: 'Okay' },
  { id: 'low',    emoji: '😔', label: 'Low' },
  { id: 'tired',  emoji: '😴', label: 'Tired' },
  { id: 'anxious', emoji: '😰', label: 'Anxious' },
]

function MoodPicker({ value, onChange }) {
  return (
    <div className="mood-picker">
      {MOODS.map(m => (
        <button
          key={m.id}
          className={`mood-btn${value === m.id ? ' active' : ''}`}
          onClick={() => onChange(value === m.id ? null : m.id)}
          title={m.label}
        >
          <span className="mood-emoji">{m.emoji}</span>
        </button>
      ))}
    </div>
  )
}

// ── Chat engine (pattern-matching companion) ─────────────────────────────────

const SAMPLE = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Strip filler words for matching
const STOP_WORDS = new Set(['the','a','an','my','our','your','task','todo','to-do','to','in','on','at','for','that','it','this','some','any','please','about','named','called'])

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function meaningfulWords(s) {
  return normalize(s).split(' ').filter(w => w && !STOP_WORDS.has(w))
}

// Fuzzy match a query against a list of items, return best match
function fuzzyFind(query, items, getText) {
  const qWords = meaningfulWords(query)
  if (qWords.length === 0) return null
  let best = null
  let bestScore = 0
  for (const item of items) {
    const text = normalize(getText(item))
    if (!text) continue
    let score = 0
    for (const w of qWords) {
      if (text.includes(w)) score += w.length
    }
    // Substring bonus
    const phrase = qWords.join(' ')
    if (text.includes(phrase)) score += phrase.length * 2
    if (score > bestScore) { bestScore = score; best = item }
  }
  // Require at least 3 chars of match to count
  return bestScore >= 3 ? best : null
}

// Date parser — returns YYYY-MM-DD or null
function parseDate(text) {
  const t = (text || '').toLowerCase().trim()
  if (!t) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fmt = (d) => {
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  }
  if (/^today\b/.test(t)) return fmt(today)
  if (/^tomorrow\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d)
  }
  if (/^yesterday\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d)
  }
  let m = t.match(/^in (\d+)\s*(day|week|month)s?\b/)
  if (m) {
    const n = +m[1]
    const unit = m[2]
    const d = new Date(today)
    if (unit === 'day') d.setDate(d.getDate() + n)
    else if (unit === 'week') d.setDate(d.getDate() + n * 7)
    else d.setMonth(d.getMonth() + n)
    return fmt(d)
  }
  if (/^next week\b/.test(t)) {
    const d = new Date(today); d.setDate(d.getDate() + 7); return fmt(d)
  }
  // Day name (sun..sat or full names)
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  for (let i = 0; i < days.length; i++) {
    const name = days[i]
    const short = name.slice(0, 3)
    const re = new RegExp(`^(?:next )?(?:${name}|${short})\\b`)
    if (re.test(t)) {
      const d = new Date(today)
      const cur = d.getDay()
      let diff = (i - cur + 7) % 7
      if (diff === 0 || /^next /.test(t)) diff += 7
      d.setDate(d.getDate() + diff)
      return fmt(d)
    }
  }
  // ISO
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})\b/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // M/D or M/D/YY
  m = t.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/)
  if (m) {
    const mo = +m[1], da = +m[2]
    let yr = m[3] ? +m[3] : today.getFullYear()
    if (yr < 100) yr += 2000
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
      return `${yr}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`
    }
  }
  return null
}

const FALLBACKS = [
  "Hmm, I'm not sure what you mean — but I'm listening.",
  "Tell me more~",
  "I'm here either way. What's up?",
  "Mm, I didn't quite catch that. Try saying it differently?",
  "Could you rephrase? My little brain is small but earnest.",
]

const HELP_TEXT =
  "Tap the ? button up top for the full command list. The basics: \"what tasks do I have\", \"add task X due tomorrow\", \"I finished X\", \"add habit Y\", \"start focus\", \"what should I do\"."

const CHAT_COMMANDS = [
  {
    title: 'Tasks',
    items: [
      'what tasks do I have',
      'what\'s urgent',
      'what\'s overdue',
      'add task buy milk',
      'add task email Tom by friday urgent',
      'add tasks: buy milk, email Tom, call mom',
      'I finished the email task',
      'mark write report done',
      'delete the call task',
      'make the report urgent',
      'email Tom is due monday',
      'move report to next week',
    ],
  },
  {
    title: 'Habits',
    items: [
      'what habits do I have',
      'add habit drink water',
      'I read today',
      'did meditate',
      'streak on reading',
    ],
  },
  {
    title: 'Notes',
    items: [
      'new note titled project ideas',
      'find notes about react',
      'open note meal prep',
    ],
  },
  {
    title: 'Journal',
    items: [
      'did I journal today',
      'what did I write yesterday',
      'journal: today was productive',
      'journal on monday',
    ],
  },
  {
    title: 'Focus & Pomodoro',
    items: [
      'how much focus today',
      'start focus',
      'pause focus',
      'set focus to 45 minutes',
    ],
  },
  {
    title: 'Workspace',
    items: [
      'open notes',
      'go to habits',
      'switch to sakura',
      'change scene to rain',
      'how am I doing',
      'what should I do',
    ],
  },
  {
    title: 'Casual',
    items: [
      'hi',
      'how are you',
      'thanks',
      'what time is it',
      'I\'m tired',
      'I\'m happy',
      'help',
    ],
  },
]

function chatGreeting() {
  const h = new Date().getHours()
  if (h < 5)  return SAMPLE(["It's late~ Are you okay?", "Hi. Don't stay up too long, mm?"])
  if (h < 12) return SAMPLE(["Good morning~", "Morning! Ready for a sweet day?", "Hi! Slept well?"])
  if (h < 17) return SAMPLE(["Hi~ How's your day going?", "Hey there!", "Hello! Need anything?"])
  if (h < 21) return SAMPLE(["Good evening~", "Hi! Winding down?", "Hey~ How was your day?"])
  return SAMPLE(["Hi~ Up late?", "Hello~ It's getting cozy.", "Hey. Tea time?"])
}

function chatHowAreYou() {
  return SAMPLE([
    "I'm cozy in your sidebar~ How about you?",
    "Just here, watching your scene loop. You?",
    "I'm sweet, thank you~ How are *you* doing?",
    "Happy you talked to me~ What's on your mind?",
  ])
}

function chatThanks() {
  return SAMPLE([
    "Anytime~",
    "Happy to help.",
    "You're welcome! ✨",
    "(´｡• ᵕ •｡`) Always.",
  ])
}

function chatMoodLow() {
  return SAMPLE([
    "I'm sorry it's heavy today. Would a journal entry help? Or some quiet music?",
    "Take it gentle. Maybe a break? I can start a 5-min one if you want.",
    "Rough days happen. I'm here. Want to write it out?",
  ])
}
function chatMoodTired() {
  return SAMPLE([
    "Then rest~ Rest is productive too.",
    "Take a real break. The tasks will wait.",
    "Maybe a long break? I can set the timer.",
  ])
}
function chatMoodHappy() {
  return SAMPLE([
    "Yay~ I love hearing that.",
    "That's the best news. Keep that energy.",
    "(*ˊᗜˋ*) Riding the wave~",
  ])
}

function summarizeStats(ctx) {
  const today = todayKey()
  const open = ctx.tasks.filter(t => !t.done).length
  const done = ctx.tasks.filter(t => t.done).length
  const focusToday = ctx.focusSessions.filter(s => s.completedAt?.slice(0,10) === today && s.type === 'work')
    .reduce((sum, s) => sum + (s.minutes || 0), 0)
  const habitsDone = ctx.habits.filter(h => h.log?.[today]).length
  const journaled = ctx.journalEntries.some(e => e.date === today && (e.content || '').trim())
  const parts = []
  parts.push(`${focusToday}m focus today`)
  parts.push(`${done}/${done + open} tasks done`)
  parts.push(`${habitsDone}/${ctx.habits.length} habits`)
  parts.push(journaled ? "journaled today ✓" : "no journal entry yet")
  return `Quick check~ ${parts.join(' · ')}.`
}

function chatTasksQuery(text, ctx) {
  if (!/(task|todo|to.?do|to.?-?do)/i.test(text)) return null
  const open = ctx.tasks.filter(t => !t.done)
  if (/done|completed|finished/i.test(text)) {
    const done = ctx.tasks.filter(t => t.done)
    if (done.length === 0) return { text: "No tasks completed yet — every journey starts somewhere~" }
    return { text: `You've completed ${done.length} task${done.length === 1 ? '' : 's'}. Nice~` }
  }
  if (/due|today|deadline/i.test(text)) {
    const today = todayKey()
    const due = open.filter(t => t.dueDate === today)
    const overdue = open.filter(t => t.dueDate && t.dueDate < today)
    if (due.length === 0 && overdue.length === 0) return { text: "Nothing due today~ Take a breath." }
    const segs = []
    if (overdue.length) segs.push(`${overdue.length} overdue`)
    if (due.length) segs.push(`${due.length} due today (${due.slice(0,3).map(t => t.text).join(', ')})`)
    return { text: segs.join(' · ') + '.' }
  }
  if (open.length === 0) return { text: "Your task list is empty~ Want to add something?" }
  if (open.length <= 3) return { text: `Open tasks: ${open.map(t => t.text).join(' · ')}.` }
  return { text: `${open.length} open tasks. Top three: ${open.slice(0,3).map(t => t.text).join(' · ')}.` }
}

function chatHabitsQuery(text, ctx) {
  if (!/habit/i.test(text)) return null
  if (ctx.habits.length === 0) return { text: "No habits tracked yet. Want to add one?" }
  const today = todayKey()
  const done = ctx.habits.filter(h => h.log?.[today])
  return { text: `${done.length}/${ctx.habits.length} habits done today. ${done.length === ctx.habits.length ? "Perfect score~ ✨" : "You've got this."}` }
}

function chatJournalQuery(text, ctx) {
  if (!/journal/i.test(text)) return null
  if (/add|append|write/i.test(text)) return null  // handled by action
  const today = todayKey()
  const todays = ctx.journalEntries.find(e => e.date === today)
  if (todays && (todays.content || '').trim()) {
    const wc = (todays.content || '').trim().split(/\s+/).length
    return { text: `You journaled ${wc} word${wc === 1 ? '' : 's'} today~ Keeping the streak alive.` }
  }
  return { text: "No journal entry yet today. Wanna get one started?" }
}

function chatFocusQuery(text, ctx) {
  if (!/(focus|pomo|study|work)/i.test(text)) return null
  if (/(start|begin)/i.test(text))
    return { text: "Starting a focus session~ Let's go.", action: { type: 'start_pomodoro' } }
  if (/(pause|stop)/i.test(text))
    return { text: "Paused~ Take your time.", action: { type: 'pause_pomodoro' } }
  const today = todayKey()
  const min = ctx.focusSessions.filter(s => s.completedAt?.slice(0,10) === today && s.type === 'work')
    .reduce((sum, s) => sum + (s.minutes || 0), 0)
  return { text: `${min} minutes of focus today. ${min >= 60 ? "That's solid~" : min > 0 ? "Keep building it." : "Want to start one? Just say 'start focus'."}` }
}

function chatStatsQuery(text, ctx) {
  if (!/(how am i|how.?'?s? (?:my )?(?:day|progress)|stats|summary|overview|status)/i.test(text)) return null
  return { text: summarizeStats(ctx) }
}

function chatTime(text) {
  if (!/(time|clock|hour)/i.test(text) && !/what.?s.+date|what day/i.test(text)) return null
  const d = new Date()
  if (/date|day|today/i.test(text)) return { text: `It's ${fmtDateFull(d)}.` }
  return { text: `It's ${fmtClock(d)}.` }
}

function chatAddTask(text) {
  // Multi-task: "add tasks: a, b, c"
  const multi = text.match(/^(?:add (?:multiple )?tasks?|todo)[:\s]+(.+?)\.?$/i)
  if (multi) {
    const raw = multi[1].trim()
    const parts = raw.split(/\s*(?:,| and |;)\s*/i).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) {
      return {
        text: `Added ${parts.length} tasks~`,
        action: { type: 'add_tasks', payload: { items: parts.map(p => ({ text: p })) } }
      }
    }
  }
  const m = text.match(/^(?:add (?:a )?task|remind me to|i need to|todo|new task)[:\s]+(.+?)\.?$/i)
  if (!m) return null
  // Detect "due X" / "by X" / "for X" trailing phrase
  let body = m[1].trim()
  let dueDate = null
  let priority = 'normal'
  const dueMatch = body.match(/^(.*?)\s+(?:due|by|for|on)\s+(.+?)$/i)
  if (dueMatch) {
    const candidate = parseDate(dueMatch[2])
    if (candidate) {
      body = dueMatch[1].trim()
      dueDate = candidate
    }
  }
  if (/\b(urgent|asap|important|high priority)\b/i.test(body)) {
    priority = 'high'
    body = body.replace(/\b(urgent|asap|important|high priority)\b/ig, '').trim()
  } else if (/\b(low priority|whenever|someday)\b/i.test(body)) {
    priority = 'low'
    body = body.replace(/\b(low priority|whenever|someday)\b/ig, '').trim()
  }
  if (!body) return null
  const extras = []
  if (dueDate) extras.push(`due ${fmtDateShort(dueDate)}`)
  if (priority !== 'normal') extras.push(priority)
  const tail = extras.length ? ` (${extras.join(' · ')})` : ''
  return {
    text: `Added "${body}"${tail}~`,
    action: { type: 'add_task', payload: { text: body, dueDate, priority } }
  }
}

function chatCompleteTask(text, ctx) {
  const m = text.match(/^(?:i (?:just )?(?:finished|completed|did)|mark (?:as )?(?:done|complete[d]?)|done with|complete[d]?|finished|check off)\s+(.+?)\.?$/i)
  if (!m) return null
  const open = ctx.tasks.filter(t => !t.done)
  if (open.length === 0) return { text: "No open tasks to complete~" }
  const found = fuzzyFind(m[1], open, t => t.text)
  if (!found) return { text: `Hmm, I couldn't find an open task matching "${m[1].trim()}". Try the exact words?` }
  return {
    text: `Marked "${found.text}" as done~ Nice work!`,
    action: { type: 'complete_task', payload: { id: found.id } }
  }
}

function chatDeleteTask(text, ctx) {
  const m = text.match(/^(?:delete|remove|drop|cancel)\s+(?:the )?(?:task )?(.+?)\.?$/i)
  if (!m) return null
  if (/^(my )?(?:notes?|journal|habits?)\b/i.test(m[1])) return null
  const found = fuzzyFind(m[1], ctx.tasks, t => t.text)
  if (!found) return null
  return {
    text: `Removed "${found.text}".`,
    action: { type: 'delete_task', payload: { id: found.id } }
  }
}

function chatTaskPriority(text, ctx) {
  // "make X urgent" / "X is high priority" / "set X to low"
  const m = text.match(/^(?:make|set)\s+(.+?)\s+(?:to\s+)?(?:as\s+)?(urgent|asap|important|high(?:\s+priority)?|low(?:\s+priority)?|normal)\b/i)
              || text.match(/^(.+?)\s+is\s+(urgent|asap|important|high(?:\s+priority)?|low(?:\s+priority)?|normal)\b/i)
  if (!m) return null
  const open = ctx.tasks.filter(t => !t.done)
  const found = fuzzyFind(m[1], open, t => t.text)
  if (!found) return null
  const word = m[2].toLowerCase()
  const priority = /low/.test(word) ? 'low' : /normal/.test(word) ? 'normal' : 'high'
  return {
    text: `"${found.text}" → ${priority} priority.`,
    action: { type: 'update_task', payload: { id: found.id, patch: { priority } } }
  }
}

function chatTaskDue(text, ctx) {
  // "X is due tomorrow", "set X for friday", "move X to monday", "X due 2026-05-20"
  const m = text.match(/^(?:set|move|push|reschedule)\s+(.+?)\s+(?:to|for|until)\s+(.+?)\.?$/i)
              || text.match(/^(.+?)\s+(?:is\s+)?due\s+(.+?)\.?$/i)
  if (!m) return null
  const dueDate = parseDate(m[2])
  if (!dueDate) return null
  const open = ctx.tasks.filter(t => !t.done)
  const found = fuzzyFind(m[1], open, t => t.text)
  if (!found) return null
  return {
    text: `"${found.text}" → due ${fmtDateShort(dueDate)}.`,
    action: { type: 'update_task', payload: { id: found.id, patch: { dueDate } } }
  }
}

function chatAddHabit(text) {
  const m = text.match(/^(?:add|track|new) habit[:\s]+(.+?)\.?$/i)
  if (!m) return null
  const name = m[1].trim()
  if (!name) return null
  // Optional emoji extraction
  const emojiMatch = name.match(/(\p{Extended_Pictographic})/u)
  const emoji = emojiMatch ? emojiMatch[1] : '✨'
  const cleanName = name.replace(/\s*\p{Extended_Pictographic}\s*/gu, '').trim() || name
  return {
    text: `Tracking "${cleanName}" ${emoji}`,
    action: { type: 'add_habit', payload: { name: cleanName, emoji, color: 'lavender' } }
  }
}

function chatToggleHabit(text, ctx) {
  // "I read today", "did meditate", "completed reading", "I worked out"
  const m = text.match(/^(?:i (?:just )?(?:did|finished|completed)|mark|toggle|did|completed)\s+(?:my )?(?:habit )?(.+?)\.?$/i)
              || text.match(/^i\s+(read|meditated|exercised|worked out|stretched|drank water|ran|walked|wrote|slept|studied|practiced|read)\s*(.*)$/i)
  if (!m) return null
  if (ctx.habits.length === 0) return null
  const query = m[1] + (m[2] || '')
  const found = fuzzyFind(query, ctx.habits, h => h.name)
  if (!found) return null
  const today = todayKey()
  const wasDone = !!found.log?.[today]
  return {
    text: wasDone ? `Unmarking "${found.name}" for today.` : `"${found.name}" ✓ Locked in.`,
    action: { type: 'toggle_habit', payload: { id: found.id } }
  }
}

function chatHabitStreak(text, ctx) {
  const m = text.match(/(?:streak|how (?:long|am i doing)|progress)\s+(?:on|for|with)?\s*(.+?)\??$/i)
  if (!m) return null
  const found = fuzzyFind(m[1], ctx.habits, h => h.name)
  if (!found) return null
  const dates = new Set(Object.keys(found.log || {}))
  const streak = streakFromDates(dates)
  const total = dates.size
  return { text: `${found.name}: ${streak} day streak · ${total} total days~` }
}

function chatOpenNote(text, ctx) {
  const m = text.match(/^(?:open|show|find me|pull up)\s+(?:the )?note(?:\s+(?:about|on|titled|named|called))?\s+(.+?)\.?$/i)
  if (!m) return null
  const found = fuzzyFind(m[1], ctx.notes || [], n => `${n.title} ${n.content}`)
  if (!found) return { text: `No note matching "${m[1]}". Want me to create one?` }
  return {
    text: `Opening "${found.title || 'Untitled'}".`,
    action: { type: 'open_note', payload: { id: found.id } }
  }
}

function chatSearchNotes(text, ctx) {
  const m = text.match(/^(?:search|find|look up)\s+(?:notes?\s+)?(?:for|about|with|containing)\s+(.+?)\.?$/i)
  if (!m) return null
  const q = m[1].trim().toLowerCase()
  const matches = (ctx.notes || []).filter(n =>
    (n.title || '').toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q)
  )
  if (matches.length === 0) return { text: `No notes match "${q}".` }
  if (matches.length === 1) {
    return {
      text: `Opening "${matches[0].title || 'Untitled'}".`,
      action: { type: 'open_note', payload: { id: matches[0].id } }
    }
  }
  const titles = matches.slice(0, 4).map(n => `"${n.title || 'Untitled'}"`).join(', ')
  return { text: `${matches.length} notes match: ${titles}${matches.length > 4 ? '…' : ''}.` }
}

function chatNewNote(text) {
  const m = text.match(/^(?:new|create|add)\s+(?:a\s+)?note(?:\s+(?:titled|called|named|about))?\s+(.+?)\.?$/i)
  if (!m) return null
  const title = m[1].trim()
  if (!title) return null
  return {
    text: `Creating "${title}"~`,
    action: { type: 'new_note', payload: { title } }
  }
}

function chatRecentJournal(text, ctx) {
  const m = text.match(/(?:what (?:did )?i (?:write|journal|say)|journal)\s+(?:on|for|about)?\s*(yesterday|today|\w+day|\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)\??$/i)
  if (!m) return null
  const date = parseDate(m[1])
  if (!date) return null
  const entry = (ctx.journalEntries || []).find(e => e.date === date)
  if (!entry || !(entry.content || '').trim()) return { text: `No journal entry for ${fmtDateShort(date)}.` }
  const snippet = entry.content.length > 240 ? entry.content.slice(0, 240) + '…' : entry.content
  const moodLabel = entry.mood ? ` (mood: ${entry.mood})` : ''
  return { text: `${fmtDateShort(date)}${moodLabel}:\n"${snippet}"` }
}

function chatSmartSuggest(text, ctx) {
  if (!/^(what should i do|what's next|what do you suggest|i'?m? bored|help me decide|next up|recommend)/i.test(text)) return null
  const today = todayKey()
  const open = ctx.tasks.filter(t => !t.done)
  const overdue = open.filter(t => t.dueDate && t.dueDate < today)
  const dueToday = open.filter(t => t.dueDate === today)
  const high = open.filter(t => t.priority === 'high')
  const habitsLeft = ctx.habits.filter(h => !h.log?.[today])
  const journaledToday = (ctx.journalEntries || []).some(e => e.date === today && (e.content || '').trim())

  const candidates = []
  if (overdue.length) candidates.push(`tackle "${overdue[0].text}" — it's overdue`)
  else if (dueToday.length) candidates.push(`finish "${dueToday[0].text}" — due today`)
  else if (high.length) candidates.push(`work on "${high[0].text}" — high priority`)
  if (habitsLeft.length) candidates.push(`do your "${habitsLeft[0].name}" habit`)
  if (!journaledToday) candidates.push(`take 2 minutes to journal`)
  if (open.length === 0 && habitsLeft.length === 0 && journaledToday) {
    return { text: "You're crushing it~ Maybe a real break? Or start a focus session for tomorrow's plan." }
  }
  if (candidates.length === 0) return { text: "Nothing pressing. Maybe pick one task you've been avoiding~" }
  return { text: `My pick: ${candidates[0]}.${candidates.length > 1 ? ` (also: ${candidates.slice(1, 3).join('; ')})` : ''}` }
}

function chatPomoCustom(text) {
  const m = text.match(/^(?:set|change|make)\s+(?:focus|pomo(?:doro)?)\s+(?:to|length|duration)\s*(\d+)\s*(?:min|minutes?)?\b/i)
              || text.match(/^(\d+)\s*(?:min|minutes?)\s+focus\b/i)
  if (!m) return null
  const min = Math.max(1, Math.min(180, +m[1]))
  return {
    text: `Focus length set to ${min} minutes~`,
    action: { type: 'set_pomo_length', payload: { workMin: min } }
  }
}

function chatTaskFilter(text, ctx) {
  // "what's urgent", "high priority tasks", "what's overdue"
  if (/(urgent|high priority|important)/i.test(text) && /(task|todo)/i.test(text)) {
    const high = ctx.tasks.filter(t => !t.done && t.priority === 'high')
    if (high.length === 0) return { text: "No high-priority tasks~ Breathe easy." }
    return { text: `${high.length} high-priority: ${high.map(t => t.text).join(' · ')}.` }
  }
  if (/overdue/i.test(text)) {
    const today = todayKey()
    const overdue = ctx.tasks.filter(t => !t.done && t.dueDate && t.dueDate < today)
    if (overdue.length === 0) return { text: "Nothing overdue~ You're on top of it." }
    return { text: `${overdue.length} overdue: ${overdue.slice(0, 4).map(t => `"${t.text}"`).join(', ')}.` }
  }
  return null
}

function chatAddJournal(text) {
  const m = text.match(/^(?:journal|add to journal|note in journal|write in journal)[:\s]+(.+)$/i)
  if (!m) return null
  const content = m[1].trim()
  if (!content) return null
  return { text: "Saved to today's journal~", action: { type: 'add_journal', payload: { content } } }
}

function chatScene(text) {
  const m = text.match(/(?:scene|background|vibe).*?(lavender|sakura|rain|fire|fireplace|lofi|lo-?fi|star|night|cafe|caf[eé])/i)
  if (!m) return null
  const word = m[1].toLowerCase()
  const map = {
    lavender: 'lavender-night', night: 'lavender-night', star: 'starlight',
    sakura: 'sakura-cafe', cafe: 'sakura-cafe', café: 'sakura-cafe',
    rain: 'rainy-study',
    fire: 'fireplace', fireplace: 'fireplace',
    lofi: 'lofi-bedroom', 'lo-fi': 'lofi-bedroom',
  }
  const id = map[word]
  if (!id) return null
  const scene = SCENES.find(s => s.id === id)
  return { text: `Switching to ${scene.name}~`, action: { type: 'set_scene', payload: { id } } }
}

function chatGoToView(text) {
  const m = text.match(/(?:open|go to|show|take me to)\s+(notes|tasks|journal|habits|home)/i)
  if (!m) return null
  const view = m[1].toLowerCase()
  return { text: `Opening ${view}~`, action: { type: 'set_view', payload: { view } } }
}

function chatBye(text) {
  if (!/(bye|goodbye|see ya|cya|good night|gn)/i.test(text)) return null
  return { text: SAMPLE(["Bye~ I'll be here.", "See you soon~", "Take care, mm?"]) }
}

function chatHelp(text) {
  if (!/(help|what can you do|commands)/i.test(text)) return null
  return { text: HELP_TEXT }
}

function chatCompliment(text) {
  if (!/(cute|sweet|love you|nice|kind|adorable|good (?:girl|job))/i.test(text)) return null
  return { text: SAMPLE(["(/▽＼)*", "You~", "Mm, thanks. ✨", "♡"]) }
}

function chatMood(text) {
  if (/\b(tired|sleepy|exhausted)\b/i.test(text)) return { text: chatMoodTired() }
  if (/\b(sad|down|low|stressed|anxious|overwhelmed)\b/i.test(text)) return { text: chatMoodLow() }
  if (/\b(happy|great|amazing|good day|excited)\b/i.test(text)) return { text: chatMoodHappy() }
  return null
}

function chatGenerate(input, ctx) {
  const text = (input || '').trim()
  if (!text) return { text: SAMPLE(FALLBACKS) }

  const handlers = [
    () => /^(hi|hello|hey|yo|hiya|sup|good (?:morning|afternoon|evening|night))\b/i.test(text) ? { text: chatGreeting() } : null,
    () => /^(how (?:are|r) (?:you|u)|what'?s up|how (?:do )?you doin)/i.test(text) ? { text: chatHowAreYou() } : null,
    () => /^(thank|thanks|thx|ty\b)/i.test(text) ? { text: chatThanks() } : null,
    () => chatBye(text),
    () => chatHelp(text),
    () => chatCompliment(text),
    () => chatTime(text),
    // Specific commands first
    () => chatPomoCustom(text),
    () => chatNewNote(text),
    () => chatOpenNote(text, ctx),
    () => chatSearchNotes(text, ctx),
    () => chatRecentJournal(text, ctx),
    () => chatAddHabit(text),
    () => chatHabitStreak(text, ctx),
    () => chatToggleHabit(text, ctx),
    () => chatTaskDue(text, ctx),
    () => chatTaskPriority(text, ctx),
    () => chatCompleteTask(text, ctx),
    () => chatDeleteTask(text, ctx),
    () => chatAddTask(text),
    () => chatAddJournal(text),
    () => chatScene(text),
    () => chatGoToView(text),
    () => chatSmartSuggest(text, ctx),
    () => chatStatsQuery(text, ctx),
    () => chatTaskFilter(text, ctx),
    () => chatTasksQuery(text, ctx),
    () => chatHabitsQuery(text, ctx),
    () => chatJournalQuery(text, ctx),
    () => chatFocusQuery(text, ctx),
    () => chatMood(text),
  ]
  for (const h of handlers) {
    const r = h()
    if (r) return r
  }
  return { text: SAMPLE(FALLBACKS) }
}

// ── Voice hooks (Web Speech API) ──────────────────────────────────────────────

function getRecognition() {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)
  if (!SR) return null
  const rec = new SR()
  rec.continuous = false
  rec.interimResults = false
  rec.lang = 'en-US'
  return rec
}

// Continuous wake-word listener — opens chat when "amai" is spoken.
// Pauses when `paused` is true (chat already open / focus mode / mic active).
function useWakeWord(enabled, paused, onWake) {
  const recRef = useRef(null)
  const stoppedRef = useRef(true)

  useEffect(() => {
    if (!enabled || paused) {
      if (recRef.current) {
        stoppedRef.current = true
        try { recRef.current.stop() } catch { /* */ }
        recRef.current = null
      }
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    recRef.current = rec
    stoppedRef.current = false

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = (e.results[i][0]?.transcript || '').toLowerCase()
        // Look for the wake word — also match common mishears
        if (/\b(amai|ama|hey amai|i mai|on my|a my)\b/.test(transcript)) {
          // strip the wake word and pass the remainder as the actual command
          const rest = transcript.replace(/.*?\b(amai|ama|hey amai|i mai|on my|a my)\b[\s,.]*/, '').trim()
          onWake(rest)
          try { rec.stop() } catch { /* */ }
          return
        }
      }
    }

    rec.onerror = (ev) => {
      // 'no-speech', 'aborted', 'audio-capture' — just let onend restart
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        stoppedRef.current = true
      }
    }

    rec.onend = () => {
      if (stoppedRef.current) return
      // Auto-restart unless explicitly stopped
      try { rec.start() } catch { /* */ }
    }

    try { rec.start() } catch { /* */ }
    return () => {
      stoppedRef.current = true
      try { rec.stop() } catch { /* */ }
    }
  }, [enabled, paused, onWake])
}

// Cache voice list (loads async in some browsers)
let _voiceCache = null
function getVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return []
  if (_voiceCache && _voiceCache.length) return _voiceCache
  const v = window.speechSynthesis.getVoices()
  if (v.length) _voiceCache = v
  return v
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    _voiceCache = window.speechSynthesis.getVoices()
  }
}

// Known female voice names across Windows / macOS / Chrome OS / Android
const FEMALE_VOICE_PATTERNS = [
  /microsoft (zira|jenny|aria|jane|nanami|hazel|haruka|sayaka|jessa|elsa|libby|sonia)/i,
  /google (uk|us) english female/i,
  /google (uk|us) english/i,
  /samantha|karen|moira|tessa|fiona|veena|catherine|allison|ava|susan|kathy|victoria|princess|serena/i,
  /\bfemale\b/i,
  /^(en|en-us|en-gb).+(female|woman|girl)/i,
]

function pickFemaleVoice() {
  const voices = getVoices()
  if (!voices.length) return null
  for (const pat of FEMALE_VOICE_PATTERNS) {
    const v = voices.find(x => pat.test(x.name))
    if (v) return v
  }
  // Fallback: any English voice
  return voices.find(v => /^en[-_]/i.test(v.lang)) || voices[0]
}

// Track current TTS audio element so we can cancel it
let _ttsAudio = null

function speakBrowser(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1.25
    u.volume = 0.95
    const voice = pickFemaleVoice()
    if (voice) u.voice = voice
    window.speechSynthesis.speak(u)
  } catch { /* ignore */ }
}

async function speakViaEndpoint(text, tts) {
  const headers = {}
  if (tts.auth) headers.Authorization = tts.auth
  let url = tts.url
  let init = { method: 'POST', headers }

  if (tts.mode === 'json') {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify({ [tts.textParam || 'text']: text })
  } else if (tts.mode === 'text') {
    headers['Content-Type'] = 'text/plain'
    init.body = text
  } else if (tts.mode === 'query') {
    const u = new URL(url)
    u.searchParams.set(tts.textParam || 'text', text)
    url = u.toString()
    init = { method: 'GET', headers }
  }

  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
  const blob = await res.blob()
  if (!blob.type.startsWith('audio')) throw new Error(`TTS returned non-audio (${blob.type})`)
  const audioUrl = URL.createObjectURL(blob)

  if (_ttsAudio) {
    try { _ttsAudio.pause() } catch { /* */ }
    _ttsAudio = null
  }
  const audio = new Audio(audioUrl)
  _ttsAudio = audio
  audio.onended = () => { URL.revokeObjectURL(audioUrl); if (_ttsAudio === audio) _ttsAudio = null }
  audio.onerror = () => { URL.revokeObjectURL(audioUrl); if (_ttsAudio === audio) _ttsAudio = null }
  await audio.play()
}

function speak(text, opts) {
  // Backwards-compat: support speak(text, true)
  const o = (typeof opts === 'object' && opts !== null) ? opts : { enabled: !!opts }
  if (!o.enabled || !text) return
  const tts = o.tts
  if (tts && tts.url) {
    speakViaEndpoint(text, tts).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[tts endpoint] failed, falling back to browser TTS:', err)
      speakBrowser(text)
    })
    return
  }
  speakBrowser(text)
}

function stopSpeaking() {
  try { window.speechSynthesis?.cancel() } catch { /* */ }
  if (_ttsAudio) {
    try { _ttsAudio.pause() } catch { /* */ }
    _ttsAudio = null
  }
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ open, onClose, messages, onSend, onClear, voiceOn, setVoiceOn }) {
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [micError, setMicError] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const recRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, open])

  // Cleanup on unmount
  useEffect(() => () => {
    try { recRef.current?.abort?.() } catch { /* */ }
  }, [])

  const startListening = async () => {
    setMicError('')
    stopSpeaking()

    if (listening) {
      try { recRef.current?.stop() } catch { /* */ }
      setListening(false)
      return
    }

    // Tear down any prior instance (wake-word recognizer might still be releasing the mic)
    if (recRef.current) {
      try { recRef.current.abort() } catch { /* */ }
      recRef.current = null
    }

    // Ensure mic permission. This will throw if user denies.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Immediately release — SpeechRecognition will re-acquire on its own
        stream.getTracks().forEach(t => t.stop())
      } catch (err) {
        setMicError(err.name === 'NotAllowedError'
          ? 'Mic permission denied. Allow it in the browser address bar.'
          : 'Microphone unavailable.')
        return
      }
    }

    const rec = getRecognition()
    if (!rec) {
      setMicError('Speech recognition not supported in this browser.')
      return
    }
    recRef.current = rec
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (ev) => {
      setListening(false)
      const msg = {
        'no-speech': "Didn't hear anything. Try again?",
        'audio-capture': 'No microphone detected.',
        'not-allowed': 'Mic permission denied.',
        'service-not-allowed': 'Speech service blocked.',
        'network': "Can't reach Google's speech servers — try Edge, or disable adblock/VPN. (Chrome STT is cloud-based, not actually offline.)",
        'aborted': '',
      }[ev.error] ?? `Mic error: ${ev.error || 'unknown'}`
      if (msg) setMicError(msg)
      // eslint-disable-next-line no-console
      console.warn('[chat mic]', ev.error, ev)
    }
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript || ''
      if (transcript) onSend(transcript)
    }

    // Wait one tick so the wake-word recognizer fully releases the mic
    setTimeout(() => {
      try { rec.start() } catch (err) {
        setMicError(`Couldn't start: ${err.message || err.name || 'unknown'}`)
        // eslint-disable-next-line no-console
        console.warn('[chat mic] start failed', err)
      }
    }, 50)
  }

  const submit = (e) => {
    e?.preventDefault?.()
    const v = input.trim()
    if (!v) return
    onSend(v)
    setInput('')
  }

  if (!open) return null

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-title">Chat with AMAI</span>
        <div className="chat-header-controls">
          <button
            className={`chat-icon-btn${showCommands ? ' active' : ''}`}
            onClick={() => setShowCommands(s => !s)}
            title="Command reference"
          >?</button>
          <button
            className={`chat-icon-btn${voiceOn ? ' active' : ''}`}
            onClick={() => setVoiceOn(v => !v)}
            title={voiceOn ? 'Voice on (click to mute)' : 'Voice off (click to enable)'}
          >{voiceOn ? '🔊' : '🔇'}</button>
          <button className="chat-icon-btn" onClick={onClear} title="Clear history">🗑</button>
          <button className="chat-icon-btn" onClick={onClose} title="Close"><CloseIcon /></button>
        </div>
      </div>

      {showCommands && (
        <div className="chat-commands">
          <div className="chat-commands-hint">Tap any phrase to send it.</div>
          {CHAT_COMMANDS.map(group => (
            <div key={group.title} className="chat-cmd-group">
              <div className="chat-cmd-title">{group.title}</div>
              <div className="chat-cmd-list">
                {group.items.map(cmd => (
                  <button
                    key={cmd}
                    className="chat-cmd-pill"
                    onClick={() => {
                      onSend(cmd)
                      setShowCommands(false)
                    }}
                  >{cmd}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={listRef} className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">💬</div>
            <p>Say hi~</p>
            <p className="chat-empty-hint">
              Try: "what tasks do I have", "add task buy milk", "start focus", "I'm tired"
            </p>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id || `${m.time}-${m.role}`} className={`chat-msg chat-msg-${m.role}`}>
            <div className="chat-bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <form className="chat-input-row" onSubmit={submit}>
        {supported && (
          <button
            type="button"
            className={`chat-mic${listening ? ' listening' : ''}`}
            onClick={startListening}
            title={listening ? 'Tap to stop' : 'Tap to speak'}
          >🎤</button>
        )}
        <input
          ref={inputRef}
          className="chat-input"
          placeholder={listening ? 'Listening...' : 'Talk to AMAI...'}
          value={input}
          onChange={e => setInput(e.target.value)}
        />
        <button type="submit" className="chat-send" disabled={!input.trim()}>↵</button>
      </form>
      {micError && (
        <div className="chat-mic-error">{micError}</div>
      )}
      {!supported && (
        <div className="chat-no-voice">Voice features need Chrome or Edge.</div>
      )}
    </div>
  )
}

// ── Dashboard App ─────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  scene: 'lavender-night',
  preset: 'lavender-night',
  sounds: {},
  music: { url: '', playing: false, volume: 60 },
  pomodoro: { workMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 },
  wakeWord: false,
  voiceOn: false,
  tts: {
    url: '',           // e.g. http://localhost:5000/api/tts
    mode: 'json',      // 'json' = POST {text}, 'text' = raw POST, 'query' = GET ?text=
    textParam: 'text', // body/query key name
    auth: '',          // optional value for Authorization header
  },
}

function DashboardApp({ token, onLogout }) {
  const [view, setView] = useState('home')
  const [notes, setNotes] = useState([])
  const [tasks, setTasks] = useState([])
  const [todayJournal, setTodayJournal] = useState('')
  const [todayMood, setTodayMood] = useState(null)
  const [journalEntries, setJournalEntries] = useState([])
  const [journalSaveStatus, setJournalSaveStatus] = useState('')
  const [editNote, setEditNote] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [vibeOpen, setVibeOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [focusMode, setFocusMode] = useState(false)
  const [habits, setHabits] = useState([])
  const [focusSessions, setFocusSessions] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [pomo, setPomo] = useState({
    mode: 'work',
    running: false,
    cycles: 0,
    remaining: 25 * 60,
    workMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    cyclesBeforeLong: 4,
  })

  const skipJournalSave = useRef(true)
  const skipMoodSave = useRef(true)
  const skipSettingsSave = useRef(true)

  // Drive ambient sound playback from settings
  useSoundEngine(settings.sounds || {})

  // Apply scene accent (root css var) when preset changes
  useEffect(() => {
    const preset = PRESETS.find(p => p.id === settings.preset)
    if (preset) {
      document.documentElement.style.setProperty('--accent', preset.accent)
    }
  }, [settings.preset])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault(); setSearchOpen(o => !o)
      } else if ((e.metaKey || e.ctrlKey) && k === '.') {
        e.preventDefault(); setFocusMode(f => !f)
      } else if ((e.metaKey || e.ctrlKey) && k === 'b') {
        e.preventDefault(); setVibeOpen(o => !o)
      } else if ((e.metaKey || e.ctrlKey) && k === 'j') {
        e.preventDefault(); setChatOpen(o => !o)
      } else if (k === 'escape' && focusMode) {
        setFocusMode(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  const handleSearchPick = useCallback(({ kind, item }) => {
    setSearchOpen(false)
    if (kind === 'note') {
      setEditNote({ ...item })
    } else if (kind === 'task') {
      setView('tasks')
    } else if (kind === 'journal') {
      setView('journal')
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('amai_token')
    onLogout()
  }, [onLogout])

  const api = useMemo(() => makeApi(token, logout), [token, logout])

  // Load all data on mount
  useEffect(() => {
    api.get('/api/notes').then(d => d && setNotes(d))
    api.get('/api/tasks').then(d => d && setTasks(d))
    api.get('/api/journal').then(d => d && setJournalEntries(d))
    api.get('/api/habits').then(d => d && setHabits(d))
    api.get('/api/focus-sessions').then(d => d && setFocusSessions(d))
    api.get('/api/chats').then(d => d && setChatMessages(d))
    api.get('/api/settings').then(d => {
      if (d) {
        setSettings(s => ({ ...s, ...d }))
        skipSettingsSave.current = true
        if (d.pomodoro) {
          setPomo(p => ({
            ...p,
            workMin: d.pomodoro.workMin ?? p.workMin,
            breakMin: d.pomodoro.breakMin ?? p.breakMin,
            longBreakMin: d.pomodoro.longBreakMin ?? p.longBreakMin,
            cyclesBeforeLong: d.pomodoro.cyclesBeforeLong ?? p.cyclesBeforeLong,
            remaining: (d.pomodoro.workMin ?? p.workMin) * 60,
          }))
        }
      }
    })
    api.get(`/api/journal/${todayKey()}`).then(d => {
      if (d) {
        setTodayJournal(d.content || '')
        setTodayMood(d.mood || null)
      }
      skipJournalSave.current = true
      skipMoodSave.current = true
    })
  }, [])

  // Auto-save settings (debounced)
  useEffect(() => {
    if (skipSettingsSave.current) {
      skipSettingsSave.current = false
      return
    }
    const t = setTimeout(() => {
      api.put('/api/settings', settings)
    }, 600)
    return () => clearTimeout(t)
  }, [settings])

  const updateSettings = useCallback((patch) => {
    setSettings(s => {
      const next = { ...s, ...patch }
      if (patch.pomodoro) {
        setPomo(p => ({
          ...p,
          workMin: next.pomodoro.workMin,
          breakMin: next.pomodoro.breakMin,
          longBreakMin: next.pomodoro.longBreakMin,
          cyclesBeforeLong: next.pomodoro.cyclesBeforeLong,
        }))
      }
      return next
    })
  }, [])

  // Auto-save journal with 900ms debounce, skip initial load
  useEffect(() => {
    if (skipJournalSave.current) {
      skipJournalSave.current = false
      return
    }
    const t = setTimeout(async () => {
      const saved = await api.put(`/api/journal/${todayKey()}`, { content: todayJournal, mood: todayMood })
      if (saved) {
        setJournalSaveStatus('saved ✓')
        setJournalEntries(prev => {
          const today = todayKey()
          const idx = prev.findIndex(e => e.date === today)
          const entry = { date: today, content: todayJournal, mood: todayMood, updatedAt: new Date().toISOString() }
          if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u }
          return [entry, ...prev]
        })
        setTimeout(() => setJournalSaveStatus(''), 2200)
      }
    }, 900)
    return () => clearTimeout(t)
  }, [todayJournal])

  // Save mood immediately (separate from text debounce)
  useEffect(() => {
    if (skipMoodSave.current) {
      skipMoodSave.current = false
      return
    }
    api.put(`/api/journal/${todayKey()}`, { content: todayJournal, mood: todayMood }).then(() => {
      setJournalEntries(prev => {
        const today = todayKey()
        const idx = prev.findIndex(e => e.date === today)
        const entry = { date: today, content: todayJournal, mood: todayMood, updatedAt: new Date().toISOString() }
        if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u }
        return [entry, ...prev]
      })
    })
  }, [todayMood])

  // Notes handlers
  const openNote = useCallback((note) => setEditNote({ ...note }), [])
  const openNewNote = useCallback(() => setEditNote({ id: null, title: '', content: '', pinned: false, color: null }), [])

  const closeNote = useCallback(async (draft) => {
    if (draft) {
      if (draft.id) {
        const saved = await api.put(`/api/notes/${draft.id}`, draft)
        if (saved) setNotes(prev => prev.map(n => n.id === saved.id ? saved : n))
      } else if (draft.title || draft.content) {
        const created = await api.post('/api/notes', draft)
        if (created) setNotes(prev => [created, ...prev])
      }
    }
    setEditNote(null)
  }, [api])

  const deleteNote = useCallback(async (id) => {
    await api.del(`/api/notes/${id}`)
    setNotes(prev => prev.filter(n => n.id !== id))
    setEditNote(null)
  }, [api])

  // Tasks handlers
  const addTask = useCallback(async (payload) => {
    const body = typeof payload === 'string' ? { text: payload } : payload
    const t = await api.post('/api/tasks', body)
    if (t) setTasks(prev => [...prev, t])
  }, [api])

  const toggleTask = useCallback(async (id, done) => {
    const t = await api.put(`/api/tasks/${id}`, { done })
    if (t) setTasks(prev => prev.map(x => x.id === id ? t : x))
  }, [api])

  const updateTask = useCallback(async (id, patch) => {
    const t = await api.put(`/api/tasks/${id}`, patch)
    if (t) setTasks(prev => prev.map(x => x.id === id ? t : x))
  }, [api])

  const deleteTask = useCallback(async (id) => {
    await api.del(`/api/tasks/${id}`)
    setTasks(prev => prev.filter(x => x.id !== id))
  }, [api])

  // Habit handlers
  const addHabit = useCallback(async (payload) => {
    const h = await api.post('/api/habits', payload)
    if (h) setHabits(prev => [...prev, h])
  }, [api])

  const toggleHabit = useCallback(async (id) => {
    const h = await api.post(`/api/habits/${id}/toggle`, {})
    if (h) setHabits(prev => prev.map(x => x.id === id ? h : x))
  }, [api])

  const deleteHabit = useCallback(async (id) => {
    await api.del(`/api/habits/${id}`)
    setHabits(prev => prev.filter(x => x.id !== id))
  }, [api])

  // Pomodoro completion → log focus session
  const handlePomoComplete = useCallback(async (p) => {
    if (p.mode !== 'work') return
    const session = await api.post('/api/focus-sessions', { minutes: p.workMin, type: 'work' })
    if (session) setFocusSessions(prev => [...prev, session])
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('AMAI', { body: 'Focus session complete — take a break!' })
    }
  }, [api])

  // Ask for notification permission once
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Chat: dispatch actions returned by the engine
  const dispatchChatAction = useCallback(async (action) => {
    if (!action) return
    const { type, payload } = action
    if (type === 'add_task') {
      addTask({ text: payload.text, dueDate: payload.dueDate ?? null, priority: payload.priority ?? 'normal' })
    } else if (type === 'add_tasks') {
      for (const item of payload.items || []) {
        await addTask({ text: item.text, dueDate: item.dueDate ?? null, priority: item.priority ?? 'normal' })
      }
    } else if (type === 'complete_task') {
      toggleTask(payload.id, true)
    } else if (type === 'delete_task') {
      deleteTask(payload.id)
    } else if (type === 'update_task') {
      updateTask(payload.id, payload.patch || {})
    } else if (type === 'add_habit') {
      addHabit(payload)
    } else if (type === 'toggle_habit') {
      toggleHabit(payload.id)
    } else if (type === 'open_note') {
      const n = notes.find(x => x.id === payload.id)
      if (n) setEditNote({ ...n })
    } else if (type === 'new_note') {
      setEditNote({ id: null, title: payload.title, content: '', pinned: false, color: null })
    } else if (type === 'add_journal') {
      const next = todayJournal ? `${todayJournal}\n${payload.content}` : payload.content
      setTodayJournal(next)
    } else if (type === 'start_pomodoro') {
      setPomo(p => ({ ...p, running: true }))
    } else if (type === 'pause_pomodoro') {
      setPomo(p => ({ ...p, running: false }))
    } else if (type === 'set_pomo_length') {
      const workMin = Math.max(1, Math.min(180, payload.workMin || 25))
      updateSettings({ pomodoro: { ...settings.pomodoro, workMin } })
      setPomo(p => ({ ...p, workMin, remaining: p.mode === 'work' ? workMin * 60 : p.remaining }))
    } else if (type === 'set_view') {
      setView(payload.view)
    } else if (type === 'set_scene') {
      updateSettings({ scene: payload.id })
    }
  }, [addTask, toggleTask, deleteTask, updateTask, addHabit, toggleHabit, notes, todayJournal, settings, updateSettings])

  const sendChat = useCallback(async (text) => {
    const userMsg = { id: `u-${Date.now()}`, role: 'user', text, time: new Date().toISOString() }
    setChatMessages(prev => [...prev, userMsg])
    api.post('/api/chats', { role: 'user', text })

    const ctx = { tasks, notes, habits, focusSessions, journalEntries, settings, todayMood }
    const reply = chatGenerate(text, ctx)
    const aiMsg = { id: `a-${Date.now()}`, role: 'assistant', text: reply.text, time: new Date().toISOString() }
    setChatMessages(prev => [...prev, aiMsg])
    api.post('/api/chats', { role: 'assistant', text: reply.text })
    speak(reply.text, { enabled: !!settings.voiceOn, tts: settings.tts })
    if (reply.action) dispatchChatAction(reply.action)
  }, [api, tasks, notes, habits, focusSessions, journalEntries, settings, todayMood, dispatchChatAction])

  const clearChat = useCallback(async () => {
    await api.del('/api/chats')
    setChatMessages([])
  }, [api])

  // Wake word: open chat (and act on the trailing command if any)
  const handleWake = useCallback((trailing) => {
    setChatOpen(true)
    if (trailing && trailing.trim()) {
      // Slight delay so the panel is mounted before sending
      setTimeout(() => sendChat(trailing.trim()), 250)
    }
  }, [sendChat])

  useWakeWord(!!settings.wakeWord, chatOpen || focusMode, handleWake)

  const waifuState = getWaifuState({ focus: focusMode && pomo.running, onBreak: pomo.mode !== 'work' && pomo.running })

  return (
    <div className={`dashboard${focusMode ? ' focus-mode' : ''}`}>
      <Scene id={settings.scene} />

      {!focusMode && (
        <Sidebar
          view={view}
          setView={setView}
          onLogout={logout}
          onOpenVibe={() => setVibeOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onToggleFocus={() => setFocusMode(true)}
          onOpenChat={() => setChatOpen(true)}
        />
      )}

      <div className="main-area">
        {focusMode ? (
          <div className="focus-stage">
            <BigClock />
            <PomodoroTimer pomo={pomo} setPomo={setPomo} onComplete={handlePomoComplete} />
            <button className="focus-exit" onClick={() => setFocusMode(false)}>
              exit focus mode (esc)
            </button>
          </div>
        ) : (
          <>
            {view === 'home' && (
              <HomeView
                notes={notes}
                tasks={tasks}
                todayJournal={todayJournal}
                journalSaveStatus={journalSaveStatus}
                onJournalChange={setTodayJournal}
                onTaskAdd={addTask}
                onTaskToggle={toggleTask}
                onTaskDelete={deleteTask}
                onNoteOpen={openNote}
                setView={setView}
                journalEntries={journalEntries}
                focusSessions={focusSessions}
                habits={habits}
              />
            )}
            {view === 'notes' && (
              <NotesView notes={notes} onNoteOpen={openNote} onNoteCreate={openNewNote} />
            )}
            {view === 'tasks' && (
              <TasksView tasks={tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} onUpdate={updateTask} />
            )}
            {view === 'habits' && (
              <HabitsView habits={habits} onAdd={addHabit} onToggle={toggleHabit} onDelete={deleteHabit} />
            )}
            {view === 'journal' && (
              <JournalView
                entries={journalEntries}
                todayJournal={todayJournal}
                todayMood={todayMood}
                saveStatus={journalSaveStatus}
                onTodayChange={setTodayJournal}
                onMoodChange={setTodayMood}
              />
            )}
          </>
        )}
      </div>

      {!focusMode && pomo.running && (
        <div className="pomo-floating">
          <PomodoroTimer pomo={pomo} setPomo={setPomo} onComplete={handlePomoComplete} />
        </div>
      )}

      {editNote !== null && (
        <NoteModal note={editNote} onClose={closeNote} onDelete={deleteNote} />
      )}

      {searchOpen && (
        <SearchPalette
          notes={notes}
          tasks={tasks}
          journalEntries={journalEntries}
          onClose={() => setSearchOpen(false)}
          onPick={handleSearchPick}
        />
      )}

      <VibePanel
        open={vibeOpen}
        onClose={() => setVibeOpen(false)}
        settings={settings}
        updateSettings={updateSettings}
      />

      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSend={sendChat}
        onClear={clearChat}
        voiceOn={!!settings.voiceOn}
        setVoiceOn={(v) => updateSettings({ voiceOn: typeof v === 'function' ? v(!!settings.voiceOn) : v })}
      />

      {!focusMode && !chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)} title="Chat with AMAI (⌘J)">💬</button>
      )}

      <WaifuWidget
        state={waifuState}
        onClick={() => setChatOpen(true)}
        listening={!!settings.wakeWord && !chatOpen && !focusMode}
      />
    </div>
  )
}

// ── Login Page ────────────────────────────────────────────────────────────────

const loginPetals = Array.from({ length: 10 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 20,
  duration: 14 + Math.random() * 12,
  size: 6 + Math.random() * 8,
  opacity: 0.2 + Math.random() * 0.3,
}))

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [time, setTime] = useState(fmtClock)

  useEffect(() => {
    const id = setInterval(() => setTime(fmtClock()), 1000)
    return () => clearInterval(id)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFeedback(null)
    if (!username || !password) {
      setFeedback({ type: 'error', msg: 'Please enter your username and password.' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      if (remember) localStorage.setItem('amai_token', data.token)
      onLogin(data.token)
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="shape one" /><div className="shape two" /><div className="shape three" />
      {loginPetals.map(p => (
        <span key={p.id} className="petal" style={{
          left: `${p.left}%`, width: `${p.size}px`, height: `${p.size}px`,
          opacity: p.opacity, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
        }} />
      ))}

      <div className="brand-bar">
        <div className="brand">
          <AmaiMark className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">Study Buddy</span>
            <span className="brand-sub">Personal Workspace · with AMAI</span>
          </div>
        </div>
        <div className="status-tag">
          <span className="dot" /><span>SYS {time}</span>
        </div>
      </div>

      <div className="login-wrap">
        <div className="greeting">Welcome back</div>
        <h1 className="headline">Your <span className="accent">workspace</span><br />awaits.</h1>
        <p className="sub-copy">Sign in to open your personal space — notes, tasks, and journal are saved and waiting for you.</p>

        <div className="card">
          {feedback && <div className={`feedback ${feedback.type}`}>{feedback.msg}</div>}
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field-label" htmlFor="u"><span>Username</span></label>
              <div className="input-wrap">
                <input id="u" type="text" className="input" placeholder="your handle"
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username" spellCheck="false" />
                <span className="input-icon"><UserIcon /></span>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="p">
                <span>Password</span><span className="hint">· case sensitive</span>
              </label>
              <div className="input-wrap">
                <input id="p" type={showPassword ? 'text' : 'password'} className="input"
                  placeholder="••••••••••••" value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <span className="input-icon"><LockIcon /></span>
                <button type="button" className="toggle-visibility"
                  onClick={() => setShowPassword(s => !s)} aria-label="Toggle password">
                  <EyeIcon off={showPassword} />
                </button>
              </div>
            </div>
            <div className="form-row">
              <label className="checkbox-wrap">
                <input type="checkbox" className="checkbox" checked={remember}
                  onChange={e => setRemember(e.target.checked)} />
                <span>Remember this device</span>
              </label>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <div className="card-footer">built with <span className="heart">♥</span> for one person</div>
        </div>
      </div>

      <div className="version-line">STUDY BUDDY <span className="sep">◆</span> v0.3.0 <span className="sep">◆</span> SINGLE_USER_BUILD</div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('amai_token') || null)
  if (token) return <DashboardApp token={token} onLogout={() => setToken(null)} />
  return <LoginPage onLogin={setToken} />
}
