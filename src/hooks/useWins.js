/**
 * useWins — persists per-difficulty win counts in localStorage.
 *
 * Shape: { beginner: 0, medium: 0, hard: 0, expert: 0 }
 *
 * WINS_TO_PROMOTE: number of wins at a level before the sensei recommends moving up.
 */

import { useState } from 'react'

export const WINS_TO_PROMOTE = 3

const STORAGE_KEY = 'bgtrainer_wins'

const DEFAULTS = { beginner: 0, medium: 0, hard: 0, expert: 0 }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch {
    return { ...DEFAULTS }
  }
}

function save(wins) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(wins)) } catch {}
}

export function useWins() {
  const [wins, setWins] = useState(load)

  function recordWin(difficulty) {
    if (!difficulty || difficulty === '2player') return
    const next = { ...wins, [difficulty]: (wins[difficulty] ?? 0) + 1 }
    save(next)
    setWins(next)
    return next[difficulty]   // return new total so caller can check threshold
  }

  return { wins, recordWin }
}
