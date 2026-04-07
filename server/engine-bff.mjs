/**
 * Engine BFF — batches bgweb getmoves calls with LRU cache and bounded upstream parallelism.
 *
 * Run: BGWEB_UPSTREAM=http://127.0.0.1:8080 node server/engine-bff.mjs
 * Env: PORT, BGWEB_UPSTREAM, ENGINE_BFF_CACHE_MAX, ENGINE_BFF_UPSTREAM_CONCURRENCY, ENGINE_BFF_MAX_BATCH, ENGINE_BFF_CORS_ORIGIN
 */
import express from 'express'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT) || 3001
const BGWEB_BASE = (process.env.BGWEB_UPSTREAM || 'http://127.0.0.1:8080').replace(/\/$/, '')
const UPSTREAM_GETMOVES = `${BGWEB_BASE}/api/v1/getmoves`
const CACHE_MAX = Math.max(100, Number(process.env.ENGINE_BFF_CACHE_MAX) || 4000)
const UPSTREAM_CONCURRENCY = Math.max(1, Number(process.env.ENGINE_BFF_UPSTREAM_CONCURRENCY) || 12)
const MAX_BATCH = Math.min(256, Math.max(1, Number(process.env.ENGINE_BFF_MAX_BATCH) || 64))

class LruCache {
  constructor(max) {
    this.max = max
    this.map = new Map()
  }
  get(k) {
    if (!this.map.has(k)) return undefined
    const v = this.map.get(k)
    this.map.delete(k)
    this.map.set(k, v)
    return v
  }
  set(k, v) {
    if (this.map.has(k)) this.map.delete(k)
    this.map.set(k, v)
    while (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value
      this.map.delete(firstKey)
    }
  }
}

const cache = new LruCache(CACHE_MAX)

function cacheKeyForBody(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')
}

function moverWinFromData(data) {
  if (!Array.isArray(data) || data.length === 0) return null
  const win = data[0]?.evaluation?.probability?.win
  return typeof win === 'number' && !Number.isNaN(win) ? win : null
}

async function fetchUpstream(body) {
  const res = await fetch(UPSTREAM_GETMOVES, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  try {
    const data = await res.json()
    return moverWinFromData(data)
  } catch {
    return null
  }
}

async function mapWithConcurrency(limit, items, mapper) {
  if (items.length === 0) return []
  const n = Math.max(1, Math.min(limit, items.length))
  const out = new Array(items.length)
  let ix = 0
  async function worker() {
    while (true) {
      const i = ix++
      if (i >= items.length) break
      out[i] = await mapper(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '4mb' }))

const CORS = process.env.ENGINE_BFF_CORS_ORIGIN
if (CORS) {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', CORS === '*' ? '*' : CORS)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, upstream: UPSTREAM_GETMOVES, cacheMax: CACHE_MAX, maxBatch: MAX_BATCH })
})

/**
 * POST { items: [ { body: MoveArgs }, ... ] }
 * → { results: [ { win: number|null, cached?: boolean }, ... ] }
 */
app.post('/api/v1/batch-getmoves', async (req, res) => {
  const items = req.body?.items
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }
  if (items.length > MAX_BATCH) {
    return res.status(400).json({ error: `items length exceeds max ${MAX_BATCH}` })
  }

  const results = new Array(items.length)
  const misses = []

  for (let i = 0; i < items.length; i++) {
    const body = items[i]?.body
    if (!body || typeof body !== 'object') {
      results[i] = { win: null }
      continue
    }
    const ck = cacheKeyForBody(body)
    const hit = cache.get(ck)
    if (hit !== undefined) {
      results[i] = { win: hit, cached: true }
      continue
    }
    misses.push({ i, body, ck })
  }

  if (misses.length > 0) {
    const wins = await mapWithConcurrency(UPSTREAM_CONCURRENCY, misses, async ({ body, ck }) => {
      const win = await fetchUpstream(body)
      if (win != null) cache.set(ck, win)
      return win
    })
    for (let j = 0; j < misses.length; j++) {
      results[misses[j].i] = { win: wins[j] }
    }
  }

  res.json({ results })
})

app.listen(PORT, () => {
  console.info(
    `[engine-bff] :${PORT} → ${UPSTREAM_GETMOVES}  cache≤${CACHE_MAX}  parallel=${UPSTREAM_CONCURRENCY}`
  )
})
