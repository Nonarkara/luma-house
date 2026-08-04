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

function defaultStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null
  const candidate = (globalThis as { localStorage?: Storage }).localStorage
  return candidate ?? null
}

/** Read with a fallback to the legacy luma-house:* key, write to the new key. */
export function readOrMigrate<T>(
  keyName: string,
  legacy: string,
  parse: (raw: string) => T | null,
  storage: Storage | null = defaultStorage(),
): T | null {
  if (!storage) return null
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
      storage.setItem(PREFIX + keyName, legacyRaw)
      return parsed
    }
  }
  return null
}

/** Plain-string read. */
export function readString(keyName: string, legacy: string, storage?: Storage | null): string | null {
  return readOrMigrate<string>(keyName, legacy, (raw) => raw, storage)
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
    storage,
  )
}

/** Write under the new key. */
export function writeJson<T>(keyName: string, value: T, storage: Storage | null = defaultStorage()): void {
  if (!storage) return
  storage.setItem(PREFIX + keyName, JSON.stringify(value))
}

/** Write a plain string under the new key. */
export function writeString(keyName: string, value: string, storage: Storage | null = defaultStorage()): void {
  if (!storage) return
  storage.setItem(PREFIX + keyName, value)
}

/** Compose the new key. Exposed for one-off callers. */
export function key(name: string): string {
  return PREFIX + name
}
