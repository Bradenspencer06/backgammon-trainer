/**
 * Map over `items` with at most `limit` async operations in flight.
 * Avoids spawning N * 21 parallel fetches when N is the number of legal plays.
 */
export async function mapWithConcurrency(items, limit, mapper) {
  if (items.length === 0) return []
  const n = Math.max(1, Math.min(limit, items.length))
  const results = new Array(items.length)
  let index = 0

  async function worker() {
    while (true) {
      const i = index++
      if (i >= items.length) break
      results[i] = await mapper(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}
