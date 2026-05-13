import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dir = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dir, 'data')
if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true })

const app = express()
const PORT = process.env.PORT || 3001
const JWT_SECRET = process.env.JWT_SECRET || 'amai-dev-secret-change-in-prod'
const AMAI_USERNAME = process.env.AMAI_USERNAME || 'amai'
const AMAI_PASSWORD = process.env.AMAI_PASSWORD || 'companion'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())

// ── JSON file DB ──────────────────────────────────────────────────────────────

function read(file) {
  const p = join(DATA, `${file}.json`)
  if (!existsSync(p)) return file === 'journal' ? {} : []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return file === 'journal' ? {} : [] }
}

function write(file, data) {
  writeFileSync(join(DATA, `${file}.json`), JSON.stringify(data, null, 2), 'utf-8')
}

// ── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {}
  if (username === AMAI_USERNAME && password === AMAI_PASSWORD) {
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '7d' })
    return res.json({ token, user: username })
  }
  res.status(401).json({ error: 'Invalid credentials' })
})

const requireAuth = (req, res, next) => {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
  try { req.user = jwt.verify(h.slice(7), JWT_SECRET); next() }
  catch { res.status(401).json({ error: 'Token invalid or expired' }) }
}

app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user.user }))

// ── Notes ─────────────────────────────────────────────────────────────────────

app.get('/api/notes', requireAuth, (req, res) => res.json(read('notes')))

app.post('/api/notes', requireAuth, (req, res) => {
  const notes = read('notes')
  const note = {
    id: randomUUID(),
    title: req.body.title || 'Untitled',
    content: req.body.content || '',
    pinned: req.body.pinned ?? false,
    color: req.body.color ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  notes.unshift(note)
  write('notes', notes)
  res.json(note)
})

app.put('/api/notes/:id', requireAuth, (req, res) => {
  const notes = read('notes')
  const idx = notes.findIndex(n => n.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  notes[idx] = { ...notes[idx], ...req.body, id: notes[idx].id, createdAt: notes[idx].createdAt, updatedAt: new Date().toISOString() }
  write('notes', notes)
  res.json(notes[idx])
})

app.delete('/api/notes/:id', requireAuth, (req, res) => {
  write('notes', read('notes').filter(n => n.id !== req.params.id))
  res.json({ ok: true })
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/api/tasks', requireAuth, (req, res) => res.json(read('tasks')))

app.post('/api/tasks', requireAuth, (req, res) => {
  const tasks = read('tasks')
  const task = {
    id: randomUUID(),
    text: req.body.text || '',
    done: false,
    priority: req.body.priority ?? 'normal',
    dueDate: req.body.dueDate ?? null,
    createdAt: new Date().toISOString(),
  }
  tasks.push(task)
  write('tasks', tasks)
  res.json(task)
})

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const tasks = read('tasks')
  const idx = tasks.findIndex(t => t.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  tasks[idx] = { ...tasks[idx], ...req.body, id: tasks[idx].id }
  write('tasks', tasks)
  res.json(tasks[idx])
})

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  write('tasks', read('tasks').filter(t => t.id !== req.params.id))
  res.json({ ok: true })
})

// ── Journal ───────────────────────────────────────────────────────────────────

app.get('/api/journal', requireAuth, (req, res) => {
  const j = read('journal')
  const entries = Object.entries(j)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 60)
    .map(([date, entry]) => ({ date, ...entry }))
  res.json(entries)
})

app.get('/api/journal/:date', requireAuth, (req, res) => {
  const j = read('journal')
  res.json(j[req.params.date] ?? { content: '', date: req.params.date })
})

app.put('/api/journal/:date', requireAuth, (req, res) => {
  const j = read('journal')
  const cur = j[req.params.date] || {}
  j[req.params.date] = {
    ...cur,
    content: req.body.content ?? cur.content ?? '',
    mood: req.body.mood !== undefined ? req.body.mood : (cur.mood ?? null),
    updatedAt: new Date().toISOString(),
  }
  write('journal', j)
  res.json({ date: req.params.date, ...j[req.params.date] })
})

// ── Habits ────────────────────────────────────────────────────────────────────

app.get('/api/habits', requireAuth, (req, res) => res.json(read('habits')))

app.post('/api/habits', requireAuth, (req, res) => {
  const habits = read('habits')
  const habit = {
    id: randomUUID(),
    name: req.body.name || 'New habit',
    emoji: req.body.emoji || '✨',
    color: req.body.color || 'lavender',
    log: {},
    createdAt: new Date().toISOString(),
  }
  habits.push(habit)
  write('habits', habits)
  res.json(habit)
})

app.put('/api/habits/:id', requireAuth, (req, res) => {
  const habits = read('habits')
  const idx = habits.findIndex(h => h.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  habits[idx] = { ...habits[idx], ...req.body, id: habits[idx].id }
  write('habits', habits)
  res.json(habits[idx])
})

app.post('/api/habits/:id/toggle', requireAuth, (req, res) => {
  const habits = read('habits')
  const idx = habits.findIndex(h => h.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Not found' })
  const date = req.body.date || new Date().toISOString().slice(0, 10)
  const log = { ...(habits[idx].log || {}) }
  if (log[date]) delete log[date]
  else log[date] = true
  habits[idx] = { ...habits[idx], log }
  write('habits', habits)
  res.json(habits[idx])
})

app.delete('/api/habits/:id', requireAuth, (req, res) => {
  write('habits', read('habits').filter(h => h.id !== req.params.id))
  res.json({ ok: true })
})

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  scene: 'lavender-night',
  preset: 'lavender-night',
  sounds: {},
  music: { url: '', playing: false, volume: 60 },
  pomodoro: { workMin: 25, breakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 },
  weatherCity: '',
}

app.get('/api/settings', requireAuth, (req, res) => {
  const s = read('settings')
  res.json({ ...DEFAULT_SETTINGS, ...(Array.isArray(s) ? {} : s) })
})

app.put('/api/settings', requireAuth, (req, res) => {
  const cur = read('settings')
  const next = { ...DEFAULT_SETTINGS, ...(Array.isArray(cur) ? {} : cur), ...req.body }
  write('settings', next)
  res.json(next)
})

// ── Focus sessions ────────────────────────────────────────────────────────────

app.get('/api/focus-sessions', requireAuth, (req, res) => res.json(read('focus')))

app.post('/api/focus-sessions', requireAuth, (req, res) => {
  const focus = read('focus')
  const session = {
    id: randomUUID(),
    minutes: req.body.minutes || 0,
    type: req.body.type || 'work',
    completedAt: new Date().toISOString(),
  }
  focus.push(session)
  write('focus', focus)
  res.json(session)
})

// ── Chats (AI companion conversation history) ─────────────────────────────────

app.get('/api/chats', requireAuth, (req, res) => {
  const all = read('chats')
  res.json(Array.isArray(all) ? all.slice(-200) : [])
})

app.post('/api/chats', requireAuth, (req, res) => {
  const all = read('chats')
  const list = Array.isArray(all) ? all : []
  const msg = {
    id: randomUUID(),
    role: req.body.role === 'user' ? 'user' : 'assistant',
    text: String(req.body.text || ''),
    time: new Date().toISOString(),
  }
  list.push(msg)
  write('chats', list.slice(-500))
  res.json(msg)
})

app.delete('/api/chats', requireAuth, (req, res) => {
  write('chats', [])
  res.json({ ok: true })
})

app.listen(PORT, () => console.log(`✨ AMAI workspace running on http://localhost:${PORT}`))
