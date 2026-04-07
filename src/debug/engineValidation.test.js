/**
 * Integration validation against local bgweb-api (Docker on 8080).
 *
 *   VITE_BGWEB_URL=http://127.0.0.1:8080 npm run validate-engine
 */
import { runEngineValidation } from './runEngineValidation.js'

describe('engine validation harness', () => {
  it(
    'prints all qualitative positions (requires GNU / Docker)',
    async () => {
      await runEngineValidation({ log: console.warn })
    },
    300_000
  )
})
