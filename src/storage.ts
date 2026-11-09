import { parseTournament, type Tournament } from './tournament'

export const STORAGE_KEY = 'bracket-maker'
const MAX_TEXT = 4000

export interface Draft {
  name: string
  text: string
}

export interface Saved {
  tournament: Tournament | null
  draft: Draft
}

export const defaults: Saved = { tournament: null, draft: { name: '', text: '' } }

/**
 * The last visit's bracket and the setup form's draft. Each part is checked on its own and falls
 * back to the defaults when missing or damaged.
 */
export function load(storage: Storage = localStorage): Saved {
  let raw: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return defaults
    raw = parsed as Record<string, unknown>
  } catch {
    return defaults
  }
  const d = (typeof raw.draft === 'object' && raw.draft !== null ? raw.draft : {}) as Record<string, unknown>
  return {
    tournament: parseTournament(raw.tournament),
    draft: {
      name: typeof d.name === 'string' ? d.name.slice(0, 80) : '',
      text: typeof d.text === 'string' ? d.text.slice(0, MAX_TEXT) : '',
    },
  }
}

export function save(saved: Saved, storage: Storage = localStorage): void {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tournament: saved.tournament, draft: { ...saved.draft, text: saved.draft.text.slice(0, MAX_TEXT) } }),
    )
  } catch {
    // Storage full or blocked (private mode): the bracket still works, it just won't be remembered.
  }
}
