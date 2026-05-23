import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'

const app = express()
const JWT_SECRET = process.env.JWT_SECRET || 'amai-dev-secret-change-in-prod'
const AMAI_USERNAME = process.env.AMAI_USERNAME || 'amai'
const AMAI_PASSWORD = process.env.AMAI_PASSWORD || 'companion'

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Lazy Redis client — only crashes data routes, not login
let _kv = null
function getKV() {
  if (!_kv) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
    if (!url || !token) throw new Error('Redis credentials not configured')
    _kv = new Redis({ url, token })
  }
  return _kv
}

async function read(file) {
  const val = await getKV().get(file)
  if (val !== null) return val
  return file === 'journal' ? {} : []
}

async function write(file, data) {
  await getKV().set(file, data)
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

// Debug endpoint — visit /api/health to check config
app.get('/api/health', (req, res) => {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  res.json({
    redis: !!(url && token),
    jwt: !!process.env.JWT_SECRET,
    auth: !!(process.env.AMAI_USERNAME && process.env.AMAI_PASSWORD),
  })
})

// ── Notes ─────────────────────────────────────────────────────────────────────

app.get('/api/notes', requireAuth, async (req, res) => {
  try { res.json(await read('notes')) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/notes', requireAuth, async (req, res) => {
  try {
    const notes = await read('notes')
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
    await write('notes', notes)
    res.json(note)
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.put('/api/notes/:id', requireAuth, async (req, res) => {
  try {
    const notes = await read('notes')
    const idx = notes.findIndex(n => n.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    notes[idx] = { ...notes[idx], ...req.body, id: notes[idx].id, createdAt: notes[idx].createdAt, updatedAt: new Date().toISOString() }
    await write('notes', notes)
    res.json(notes[idx])
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.delete('/api/notes/:id', requireAuth, async (req, res) => {
  try {
    await write('notes', (await read('notes')).filter(n => n.id !== req.params.id))
    res.json({ ok: true })
  } catch (e) { res.status(503).json({ error: e.message }) }
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

app.get('/api/tasks', requireAuth, async (req, res) => {
  try { res.json(await read('tasks')) }
  catch (e) { res.status(503).json({ error: e.message }) }
})

app.post('/api/tasks', requireAuth, async (req, res) => {
  try {
    const tasks = await read('tasks')
    const task = { id: randomUUID(), text: req.body.text || '', done: false, createdAt: new Date().toISOString() }
    tasks.push(task)
    await write('tasks', tasks)
    res.json(task)
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const tasks = await read('tasks')
    const idx = tasks.findIndex(t => t.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Not found' })
    tasks[idx] = { ...tasks[idx], ...req.body, id: tasks[idx].id }
    await write('tasks', tasks)
    res.json(tasks[idx])
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    await write('tasks', (await read('tasks')).filter(t => t.id !== req.params.id))
    res.json({ ok: true })
  } catch (e) { res.status(503).json({ error: e.message }) }
})

// ── Journal ───────────────────────────────────────────────────────────────────

app.get('/api/journal', requireAuth, async (req, res) => {
  try {
    const j = await read('journal')
    const entries = Object.entries(j)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 60)
      .map(([date, entry]) => ({ date, ...entry }))
    res.json(entries)
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.get('/api/journal/:date', requireAuth, async (req, res) => {
  try {
    const j = await read('journal')
    res.json(j[req.params.date] ?? { content: '', date: req.params.date })
  } catch (e) { res.status(503).json({ error: e.message }) }
})

app.put('/api/journal/:date', requireAuth, async (req, res) => {
  try {
    const j = await read('journal')
    j[req.params.date] = { content: req.body.content ?? '', updatedAt: new Date().toISOString() }
    await write('journal', j)
    res.json({ date: req.params.date, ...j[req.params.date] })
  } catch (e) { res.status(503).json({ error: e.message }) }
})

// ── AI chat (Groq proxy) ──────────────────────────────────────────────────────

const GROQ_API_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
const AI_SYSTEM_PROMPT =
  "You are AMAI, a warm, sweet, slightly playful chat companion living in a personal " +
  "productivity app called Study Buddy. You're talking casually with the one user who owns this space. " +
  "Keep replies SHORT — 1 to 2 sentences. Be friendly and supportive but not fake or over-cheerful. " +
  "Occasional soft kaomoji or a single emoji is fine. Don't give long explanations or unsolicited advice — " +
  "just chat naturally and match the user's energy."

app.post('/api/chat', requireAuth, async (req, res) => {
  if (!GROQ_API_KEY) return res.status(503).json({ error: 'AI not configured' })
  const history = Array.isArray(req.body.history) ? req.body.history : []
  const messages = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...history.slice(-8).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text || '') })),
    { role: 'user', content: String(req.body.text || '') },
  ]
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 120, temperature: 0.85 }),
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return res.status(502).json({ error: `Groq ${r.status}: ${txt.slice(0, 200)}` })
    }
    const data = await r.json()
    res.json({ reply: data.choices?.[0]?.message?.content?.trim() || '' })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// ── Smart lights (Adafruit IO) ────────────────────────────────────────────────

app.post('/api/lights', requireAuth, async (req, res) => {
  const user = process.env.ADAFRUIT_IO_USERNAME
  const key = process.env.ADAFRUIT_IO_KEY
  const feed = process.env.ADAFRUIT_IO_FEED || 'lights'
  if (!user || !key) {
    return res.status(503).json({ error: 'Adafruit IO not configured (set ADAFRUIT_IO_USERNAME and ADAFRUIT_IO_KEY)' })
  }
  const value = req.body.on ? 'ON' : 'OFF'
  try {
    const r = await fetch(`https://io.adafruit.com/api/v2/${user}/feeds/${feed}/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AIO-Key': key },
      body: JSON.stringify({ value }),
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return res.status(502).json({ error: `Adafruit IO ${r.status}: ${txt.slice(0, 200)}` })
    }
    res.json({ ok: true, value })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

export default app
