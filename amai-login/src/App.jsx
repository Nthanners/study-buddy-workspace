import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './index.css'
import './dashboard.css'

const API_BASE = 'http://localhost:3001'

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

// ── API client ────────────────────────────────────────────────────────────────

function makeApi(token, onUnauth) {
  const json = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  const auth = { Authorization: `Bearer ${token}` }
  const handle = async (r) => {
    if (r.status === 401) { onUnauth(); return null }
    return r.json()
  }
  return {
    get:  (p)    => fetch(`${API_BASE}${p}`, { headers: auth }).then(handle),
    post: (p, b) => fetch(`${API_BASE}${p}`, { method: 'POST',   headers: json, body: JSON.stringify(b) }).then(handle),
    put:  (p, b) => fetch(`${API_BASE}${p}`, { method: 'PUT',    headers: json, body: JSON.stringify(b) }).then(handle),
    del:  (p)    => fetch(`${API_BASE}${p}`, { method: 'DELETE', headers: auth }).then(handle),
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
  return (
    <div className={`note-card ${colorClass}`} onClick={onClick}>
      {note.pinned && <span className="note-card-pin"><PinIcon filled /></span>}
      <div className="note-card-title">{note.title || 'Untitled'}</div>
      <div className="note-card-preview">{note.content || <span style={{ opacity: 0.4 }}>No content</span>}</div>
      <div className="note-card-date">{fmtDateShort(note.updatedAt?.slice(0, 10) || note.createdAt?.slice(0, 10))}</div>
    </div>
  )
}

// ── Note Modal ────────────────────────────────────────────────────────────────

const NOTE_COLORS = [null, 'rose', 'mint', 'gold', 'sky']

function NoteModal({ note, onClose, onDelete }) {
  const [draft, setDraft] = useState({ ...note })
  const contentRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(draft) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [draft, onClose])

  useEffect(() => { contentRef.current?.focus() }, [])

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
          <button className="modal-close-btn" onClick={() => onClose(draft)}><CloseIcon /></button>
        </div>

        <textarea
          ref={contentRef}
          className="modal-content-input"
          value={draft.content}
          onChange={e => set('content', e.target.value)}
          placeholder="Start writing..."
        />

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
  return (
    <div className="journal-entry-card">
      <div className="journal-entry-header" onClick={() => setOpen(o => !o)}>
        <span className="journal-entry-date">{fmtDateShort(entry.date)}</span>
        {!open && (
          <span className="journal-entry-preview">
            {entry.content?.slice(0, 60) || <em style={{ opacity: 0.4 }}>empty</em>}
          </span>
        )}
        <span className="journal-entry-expand">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="journal-entry-content">{entry.content || <em style={{ opacity: 0.4 }}>No content.</em>}</div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ view, setView, onLogout }) {
  const links = [
    { id: 'home',    label: 'Home',    icon: <HomeIcon /> },
    { id: 'notes',   label: 'Notes',   icon: <NotesIcon /> },
    { id: 'tasks',   label: 'Tasks',   icon: <TasksIcon /> },
    { id: 'journal', label: 'Journal', icon: <JournalIcon /> },
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <AmaiMark className="sidebar-brand-mark" />
          <span className="sidebar-brand-name">AMAI</span>
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

function HomeView({ notes, tasks, todayJournal, journalSaveStatus, onJournalChange, onTaskAdd, onTaskToggle, onTaskDelete, onNoteOpen, setView }) {
  const [greeting, greetingSub] = useMemo(getGreeting, [])
  const [clock, setClock] = useState(fmtClock)
  const [taskInput, setTaskInput] = useState('')

  useEffect(() => {
    const id = setInterval(() => setClock(fmtClock()), 1000)
    return () => clearInterval(id)
  }, [])

  const incompleteTasks = tasks.filter(t => !t.done)
  const doneTasks       = tasks.filter(t => t.done)
  const pinnedNotes     = notes.filter(n => n.pinned)
  const doneRatio       = tasks.length ? doneTasks.length / tasks.length : 0

  const handleAddTask = (e) => {
    e.preventDefault()
    if (!taskInput.trim()) return
    onTaskAdd(taskInput.trim())
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
        <div className="home-clock">{clock}</div>
      </div>

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
            {incompleteTasks.slice(0, 5).map(t => (
              <div key={t.id} className="task-item">
                <button className="task-check-btn" onClick={() => onTaskToggle(t.id, true)}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(160,126,224,0.4)' }} />
                </button>
                <span className="task-text">{t.text}</span>
                <button className="task-del-btn" onClick={() => onTaskDelete(t.id)}><TrashIcon /></button>
              </div>
            ))}
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
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(124,92,191,0.2)',
              borderRadius: 10,
              padding: '0.45rem 0.85rem',
              color: '#ede8f8',
              fontFamily: 'Outfit, sans-serif',
              fontSize: '0.85rem',
              outline: 'none',
              width: 180,
            }}
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

function TasksView({ tasks, onAdd, onToggle, onDelete }) {
  const [input, setInput] = useState('')

  const incompleteTasks = tasks.filter(t => !t.done)
  const doneTasks       = tasks.filter(t => t.done)
  const doneRatio       = tasks.length ? doneTasks.length / tasks.length : 0

  const handleAdd = (e) => {
    e.preventDefault()
    if (!input.trim()) return
    onAdd(input.trim())
    setInput('')
  }

  return (
    <div>
      <div className="view-header">
        <span className="view-title">Tasks</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'rgba(237,232,248,0.3)', letterSpacing: '0.06em' }}>
          {doneTasks.length} / {tasks.length} done
        </span>
      </div>

      {tasks.length > 0 && (
        <div style={{ maxWidth: 640, marginBottom: '1.5rem' }}>
          <div className="tasks-progress" style={{ height: 3 }}>
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
      </form>

      {incompleteTasks.length > 0 && (
        <>
          <div className="tasks-section-label">To do</div>
          <div className="tasks-full-list">
            {incompleteTasks.map(t => (
              <div key={t.id} className="task-full-item">
                <button className="task-check-btn" onClick={() => onToggle(t.id, true)}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(160,126,224,0.4)' }} />
                </button>
                <span className="task-full-text">{t.text}</span>
                <span className="task-full-date">{fmtDateShort(t.createdAt?.slice(0,10))}</span>
                <button className="task-del-btn" style={{ opacity: 1 }} onClick={() => onDelete(t.id)}><TrashIcon /></button>
              </div>
            ))}
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
                <button className="task-del-btn" style={{ opacity: 1 }} onClick={() => onDelete(t.id)}><TrashIcon /></button>
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

function JournalView({ entries, todayJournal, saveStatus, onTodayChange }) {
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

function getPupilOffset(eyeX, eyeY, mx, my, max = 2.5) {
  const dx = mx - eyeX
  const dy = my - eyeY
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return { x: 0, y: 0 }
  const s = Math.min(dist / 90, 1)
  return { x: (dx / dist) * max * s, y: (dy / dist) * max * s }
}

function WaifuWidget() {
  const svgRef = useRef(null)
  const [pupils, setPupils] = useState({ L: { x: 0, y: 0 }, R: { x: 0, y: 0 } })
  const [tilt, setTilt] = useState(0)

  useEffect(() => {
    const L = { x: 42, y: 78 }
    const R = { x: 78, y: 78 }

    const onMove = (e) => {
      const el = svgRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Convert mouse to SVG coordinate space (viewBox 120×150)
      const mx = ((e.clientX - rect.left) / rect.width) * 120
      const my = ((e.clientY - rect.top) / rect.height) * 150
      setPupils({
        L: getPupilOffset(L.x, L.y, mx, my),
        R: getPupilOffset(R.x, R.y, mx, my),
      })
      // Head tilt follows cursor left/right
      const norm = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2)
      setTilt(Math.max(-7, Math.min(7, norm * 8)))
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const lx = (n) => 42 + pupils.L.x + n
  const ly = (n) => n + pupils.L.y
  const rx = (n) => 78 + pupils.R.x + n
  const ry = (n) => n + pupils.R.y

  return (
    <div className="waifu-widget" aria-hidden="true">
      <div className="waifu-float">
        <svg
          ref={svgRef}
          width="134"
          height="160"
          viewBox="0 0 120 150"
          fill="none"
          style={{
            transform: `rotate(${tilt}deg)`,
            transformOrigin: '60px 144px',
            transition: 'transform 0.14s ease',
          }}
        >
          <defs>
            <radialGradient id="wFace" cx="40%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#fff4ef"/>
              <stop offset="100%" stopColor="#fdddd0"/>
            </radialGradient>
            <radialGradient id="wIris" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#c4a0f0"/>
              <stop offset="55%" stopColor="#7c5cbf"/>
              <stop offset="100%" stopColor="#4a2d8a"/>
            </radialGradient>
            <radialGradient id="wGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a07ee0" stopOpacity="0.22"/>
              <stop offset="100%" stopColor="#a07ee0" stopOpacity="0"/>
            </radialGradient>
            <clipPath id="lClip"><ellipse cx="42" cy="78" rx="10.5" ry="12.5"/></clipPath>
            <clipPath id="rClip"><ellipse cx="78" cy="78" rx="10.5" ry="12.5"/></clipPath>
          </defs>

          {/* Glow halo */}
          <circle cx="60" cy="76" r="56" fill="url(#wGlow)"/>

          {/* Hair — back layer */}
          <path d="M22 87 Q17 48 32 28 Q60 8 88 28 Q103 48 98 87 Q92 62 80 50 Q60 38 40 50 Q28 62 22 87Z" fill="#8b5cf6"/>

          {/* Face */}
          <ellipse cx="60" cy="83" rx="38" ry="42" fill="url(#wFace)"/>

          {/* Ears */}
          <ellipse cx="22" cy="82" rx="5"   ry="7"   fill="#fdddd0"/>
          <ellipse cx="22" cy="82" rx="3"   ry="4.5" fill="#f9c4b2"/>
          <ellipse cx="98" cy="82" rx="5"   ry="7"   fill="#fdddd0"/>
          <ellipse cx="98" cy="82" rx="3"   ry="4.5" fill="#f9c4b2"/>

          {/* Hair — front bangs */}
          <path d="M22 87 Q22 54 32 40 Q42 28 50 32 Q56 36 55 44 L52 49 Q48 36 40 39 Q30 43 26 68Z" fill="#7c3aed"/>
          <path d="M98 87 Q98 54 88 40 Q78 28 70 32 Q64 36 65 44 L68 49 Q72 36 80 39 Q90 43 94 68Z" fill="#7c3aed"/>
          <path d="M52 30 Q60 24 68 30 Q64 38 60 35 Q56 38 52 30Z" fill="#9333ea"/>

          {/* Ahoge */}
          <path d="M60 26 Q63 14 58 6 Q56 2 60 1 Q64 2 62 6 Q57 14 61 26Z" fill="#7c3aed"/>

          {/* Left eye — sclera */}
          <ellipse cx="42" cy="78" rx="11" ry="13" fill="white" opacity="0.95"/>
          {/* Left iris + pupil, clipped to sclera */}
          <g clipPath="url(#lClip)">
            <ellipse cx={lx(0)}   cy={ly(79)} rx="8.5" ry="10" fill="url(#wIris)"/>
            <ellipse cx={lx(0)}   cy={ly(80)} rx="4"   ry="5"  fill="#150b28"/>
            <circle  cx={lx(2.5)} cy={ly(76.5)} r="2.5" fill="white" opacity="0.9"/>
            <circle  cx={lx(-2)}  cy={ly(82)}   r="1"   fill="white" opacity="0.5"/>
          </g>
          {/* Left upper lid */}
          <path d="M30 74 Q42 66 54 74" fill="#1a0f35"/>
          <path d="M30 74 Q42 67 54 74" fill="none" stroke="#2d1f4e" strokeWidth="1.5" strokeLinecap="round"/>

          {/* Right eye — sclera */}
          <ellipse cx="78" cy="78" rx="11" ry="13" fill="white" opacity="0.95"/>
          {/* Right iris + pupil, clipped to sclera */}
          <g clipPath="url(#rClip)">
            <ellipse cx={rx(0)}   cy={ry(79)} rx="8.5" ry="10" fill="url(#wIris)"/>
            <ellipse cx={rx(0)}   cy={ry(80)} rx="4"   ry="5"  fill="#150b28"/>
            <circle  cx={rx(2.5)} cy={ry(76.5)} r="2.5" fill="white" opacity="0.9"/>
            <circle  cx={rx(-2)}  cy={ry(82)}   r="1"   fill="white" opacity="0.5"/>
          </g>
          {/* Right upper lid */}
          <path d="M66 74 Q78 66 90 74" fill="#1a0f35"/>
          <path d="M66 74 Q78 67 90 74" fill="none" stroke="#2d1f4e" strokeWidth="1.5" strokeLinecap="round"/>

          {/* Blush */}
          <ellipse cx="32" cy="92" rx="9" ry="5" fill="#fda4af" opacity="0.4"/>
          <ellipse cx="88" cy="92" rx="9" ry="5" fill="#fda4af" opacity="0.4"/>

          {/* Nose */}
          <path d="M57 98 Q60 101 63 98" fill="none" stroke="#c4997a" strokeWidth="1.2" strokeLinecap="round"/>

          {/* Mouth */}
          <path d="M51 109 Q60 117 69 109" fill="none" stroke="#c47a8a" strokeWidth="1.8" strokeLinecap="round"/>

          {/* Shoulders + dress */}
          <path d="M8 152 Q20 130 42 124 Q50 121 60 121 Q70 121 78 124 Q100 130 112 152Z" fill="#7c5cbf"/>
          <path d="M46 121 Q60 130 74 121 Q71 134 60 136 Q49 134 46 121Z" fill="#a07ee0" opacity="0.55"/>
        </svg>
      </div>
    </div>
  )
}

// ── Dashboard App ─────────────────────────────────────────────────────────────

function DashboardApp({ token, onLogout }) {
  const [view, setView] = useState('home')
  const [notes, setNotes] = useState([])
  const [tasks, setTasks] = useState([])
  const [todayJournal, setTodayJournal] = useState('')
  const [journalEntries, setJournalEntries] = useState([])
  const [journalSaveStatus, setJournalSaveStatus] = useState('')
  const [editNote, setEditNote] = useState(null)

  const skipJournalSave = useRef(true)

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
    api.get(`/api/journal/${todayKey()}`).then(d => {
      if (d) setTodayJournal(d.content || '')
      skipJournalSave.current = true
    })
  }, [])

  // Auto-save journal with 900ms debounce, skip initial load
  useEffect(() => {
    if (skipJournalSave.current) {
      skipJournalSave.current = false
      return
    }
    const t = setTimeout(async () => {
      const saved = await api.put(`/api/journal/${todayKey()}`, { content: todayJournal })
      if (saved) {
        setJournalSaveStatus('saved ✓')
        setJournalEntries(prev => {
          const today = todayKey()
          const idx = prev.findIndex(e => e.date === today)
          const entry = { date: today, content: todayJournal, updatedAt: new Date().toISOString() }
          if (idx >= 0) { const u = [...prev]; u[idx] = entry; return u }
          return [entry, ...prev]
        })
        setTimeout(() => setJournalSaveStatus(''), 2200)
      }
    }, 900)
    return () => clearTimeout(t)
  }, [todayJournal])

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
  const addTask = useCallback(async (text) => {
    const t = await api.post('/api/tasks', { text })
    if (t) setTasks(prev => [...prev, t])
  }, [api])

  const toggleTask = useCallback(async (id, done) => {
    const t = await api.put(`/api/tasks/${id}`, { done })
    if (t) setTasks(prev => prev.map(x => x.id === id ? t : x))
  }, [api])

  const deleteTask = useCallback(async (id) => {
    await api.del(`/api/tasks/${id}`)
    setTasks(prev => prev.filter(x => x.id !== id))
  }, [api])

  return (
    <div className="dashboard">
      <Sidebar view={view} setView={setView} onLogout={logout} />

      <div className="main-area">
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
          />
        )}
        {view === 'notes' && (
          <NotesView notes={notes} onNoteOpen={openNote} onNoteCreate={openNewNote} />
        )}
        {view === 'tasks' && (
          <TasksView tasks={tasks} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />
        )}
        {view === 'journal' && (
          <JournalView
            entries={journalEntries}
            todayJournal={todayJournal}
            saveStatus={journalSaveStatus}
            onTodayChange={setTodayJournal}
          />
        )}
      </div>

      {editNote !== null && (
        <NoteModal note={editNote} onClose={closeNote} onDelete={deleteNote} />
      )}

      <WaifuWidget />
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
      const res = await fetch(`${API_BASE}/api/auth/login`, {
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
            <span className="brand-name">AMAI</span>
            <span className="brand-sub">Personal Workspace</span>
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

      <div className="version-line">AMAI <span className="sep">◆</span> v0.2.0 <span className="sep">◆</span> SINGLE_USER_BUILD</div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('amai_token') || null)
  if (token) return <DashboardApp token={token} onLogout={() => setToken(null)} />
  return <LoginPage onLogin={setToken} />
}
