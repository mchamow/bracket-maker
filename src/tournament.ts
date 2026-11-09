import { MAX_PLAYERS, MIN_PLAYERS, pickWinner, pruneResults, validatePlayers, type Results } from './bracket'

export interface Tournament {
  name: string
  /** In seed order: index 0 is the top seed. */
  players: string[]
  results: Results
}

/** The bracket plus undo/redo history of its results. */
export interface State {
  tournament: Tournament | null
  past: Results[]
  future: Results[]
}

export type Action =
  | { type: 'create'; name: string; players: string[] }
  | { type: 'pick'; round: number; index: number; seed: number }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }

export const HISTORY_LIMIT = 200

export const emptyState: State = { tournament: null, past: [], future: [] }

function withResults(state: State, results: Results): State {
  const t = state.tournament!
  if (results === t.results) return state
  return {
    tournament: { ...t, results },
    past: [...state.past, t.results].slice(-HISTORY_LIMIT),
    future: [],
  }
}

export function reducer(state: State, action: Action): State {
  const t = state.tournament
  switch (action.type) {
    case 'create':
      if (validatePlayers(action.players)) return state
      return { tournament: { name: action.name.trim(), players: action.players, results: {} }, past: [], future: [] }
    case 'pick':
      if (!t) return state
      return withResults(state, pickWinner(t.players.length, t.results, action.round, action.index, action.seed))
    case 'reset':
      if (!t || Object.keys(t.results).length === 0) return state
      return withResults(state, {})
    case 'undo': {
      const prev = state.past.at(-1)
      if (!t || !prev) return state
      return { tournament: { ...t, results: prev }, past: state.past.slice(0, -1), future: [t.results, ...state.future] }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!t || !next) return state
      return { tournament: { ...t, results: next }, past: [...state.past, t.results], future: rest }
    }
  }
}

/** A saved tournament, checked field by field; null if it isn't a usable one. */
export function parseTournament(raw: unknown): Tournament | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.players) || !r.players.every((p) => typeof p === 'string')) return null
  const players = r.players as string[]
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS || validatePlayers(players)) return null
  const results: Results = {}
  if (typeof r.results === 'object' && r.results !== null && !Array.isArray(r.results)) {
    for (const [key, value] of Object.entries(r.results)) {
      if (/^\d+:\d+$/.test(key) && Number.isInteger(value)) results[key] = value as number
    }
  }
  return {
    name: typeof r.name === 'string' ? r.name.slice(0, 80) : '',
    players,
    results: pruneResults(players.length, results),
  }
}
