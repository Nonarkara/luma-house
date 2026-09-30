/**
 * Storage keys live under `designon:{domain}:{key}`.
 *
 * The original Luma House keys were `luma-house:{key}` (no domain split).
 * This helper migrates them on first read so existing users don't lose
 * their saved plans, sketches, or quota counters.
 *
 * Convention:
 *   - `designon:plan`             — the saved draft plan
 *   - `designon:style-keywords`  — the design language keywords
 *   - `designon:concept-quota`   — the daily concept render counter
 *   - `designon:pageviews`       — the pageview queue
 *   - `designon:welcome-dismissed` — the welcome gate
 *   - `designon:visited`         — the visited-stages set
 *
 * The `luma-house:*` keys are kept as legacy fallbacks. Once the new key
 * is written, the legacy key is no longer read.
 *
 * All functions accept an optional `Storage` (default: `globalThis.localStorage`)
 * so unit tests can pass a Map-backed stub.
 */

const PREFIX = 'designon:'

/**
 * Storage can exist and still be unusable. Safari private browsing, "block all
 * cookies", an enterprise policy, or a full quota all leave `localStorage`
 * present and make `getItem`/`setItem` throw — the throw happens on the call,
 * not on the property access, so a null check never caught it. One unguarded
 * read inside a `useState` initializer took the whole app down to a white
 * screen in every browser we tested.
 *
 * So: probe storage once, and fall back to an in-memory store. The workspace
 * keeps working — draw, analyse, furnish, and Share, which carries the plan in
 * the URL and needs no storage at all. It just cannot remember between visits,
 * and `storageIsPersistent()` reports that so the UI can say so out loud rather
 * than let someone believe their work is saved.
 */
const memory = new Map<string, string>()
let persistent: boolean | null = null

const memoryStorage: Storage = {
  get length() { return memory.size },
  clear: () => memory.clear(),
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => { memory.delete(key) },
  setItem: (key: string, value: string) => { memory.set(key, value) },
}

function probe(candidate: Storage): boolean {
  try {
    // Only trust the methods that exist — a partial Storage must not be written
    // off as unusable, or a perfectly good store gets skipped.
    if (typeof candidate.setItem !== 'function' || typeof candidate.getItem !== 'function') return false
    const key = `${PREFIX}__probe__`
    candidate.setItem(key, '1')
    const ok = candidate.getItem(key) === '1'
    if (typeof candidate.removeItem === 'function') candidate.removeItem(key)
    return ok
  } catch {
    return false
  }
}

function defaultStorage(): Storage {
  if (typeof globalThis === 'undefined') return memoryStorage
  let candidate: Storage | undefined
  try {
    candidate = (globalThis as { localStorage?: Storage }).localStorage
  } catch {
    // Some privacy modes throw merely on touching the property.
    candidate = undefined
  }
  if (!candidate) {
    persistent = false
    return memoryStorage
  }
  const usable = probe(candidate)
  persistent = usable
  return usable ? candidate : memoryStorage
}

/** False when this session cannot save anything and the UI must say so. */
export function storageIsPersistent(): boolean {
  if (persistent === null) defaultStorage()
  return persistent === true
}

/** Read with a fallback to the legacy luma-house:* key, write to the new key. */
export function readOrMigrate<T>(
  keyName: string,
  legacy: string,
  parse: (raw: string) => T | null,
  storage: Storage = defaultStorage(),
): T | null {
  try {
    const newRaw = storage.getItem(PREFIX + keyName)
    if (newRaw !== null) {
      const parsed = parse(newRaw)
      if (parsed !== null) return parsed
    }
    const legacyRaw = storage.getItem(legacy)
    if (legacyRaw !== null) {
      const parsed = parse(legacyRaw)
      if (parsed !== null) {
        // One-shot migration: write to the new key, leave the legacy key alone
        // (so a rollback to the old app still works).
        try { storage.setItem(PREFIX + keyName, legacyRaw) } catch { /* read-only storage */ }
        return parsed
      }
    }
  } catch {
    // Storage went away or is refusing reads. Fall through to the default.
  }
  return null
}

/** Plain-string read. */
export function readString(keyName: string, legacy: string, storage?: Storage | null): string | null {
  return readOrMigrate<string>(keyName, legacy, (raw) => raw, storage ?? defaultStorage())
}

/** JSON read with a parse step. */
export function readJson<T>(keyName: string, legacy: string, storage?: Storage | null): T | null {
  return readOrMigrate<T>(
    keyName,
    legacy,
    (raw) => {
      try {
        return JSON.parse(raw) as T
      } catch {
        return null
      }
    },
    storage ?? defaultStorage(),
  )
}

/** Write under the new key. */
export function writeJson<T>(keyName: string, value: T, storage: Storage = defaultStorage()): void {
  try { storage.setItem(PREFIX + keyName, JSON.stringify(value)) } catch { /* quota or private mode */ }
}

/** Write a plain string under the new key. */
export function writeString(keyName: string, value: string, storage: Storage = defaultStorage()): void {
  try { storage.setItem(PREFIX + keyName, value) } catch { /* quota or private mode */ }
}

/** Compose the new key. Exposed for one-off callers. */
export function key(name: string): string {
  return PREFIX + name
}
