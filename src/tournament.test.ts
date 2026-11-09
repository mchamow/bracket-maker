import { describe, expect, it } from 'vitest'
import { emptyState, HISTORY_LIMIT, parseTournament, reducer, type Action, type State } from './tournament'

const run = (state: State, ...actions: Action[]) => actions.reduce(reducer, state)
const created = run(emptyState, { type: 'create', name: ' Cup ', players: ['A', 'B', 'C', 'D'] })
const pick = (round: number, index: number, seed: number): Action => ({ type: 'pick', round, index, seed })

describe('reducer', () => {
  it('creates a tournament with a trimmed name and no results', () => {
    expect(created.tournament).toEqual({ name: 'Cup', players: ['A', 'B', 'C', 'D'], results: {} })
  })

  it('refuses an invalid player list', () => {
    expect(run(created, { type: 'create', name: '', players: ['A', 'a'] })).toBe(created)
  })

  it('records picks with undo and redo', () => {
    const s = run(created, pick(0, 0, 0), pick(0, 1, 1))
    expect(s.tournament!.results).toEqual({ '0:0': 0, '0:1': 1 })
    const undone = run(s, { type: 'undo' })
    expect(undone.tournament!.results).toEqual({ '0:0': 0 })
    const redone = run(undone, { type: 'redo' })
    expect(redone.tournament!.results).toEqual(s.tournament!.results)
    expect(run(undone, pick(0, 1, 2)).future).toEqual([])
  })

  it('ignores picks that change nothing, and undo/redo with no history', () => {
    expect(run(created, pick(1, 0, 0))).toBe(created)
    expect(run(created, { type: 'undo' })).toBe(created)
    expect(run(created, { type: 'redo' })).toBe(created)
    expect(run(emptyState, pick(0, 0, 0))).toBe(emptyState)
  })

  it('resets results as one undoable step', () => {
    const s = run(created, pick(0, 0, 0), pick(0, 1, 1), pick(1, 0, 1), { type: 'reset' })
    expect(s.tournament!.results).toEqual({})
    expect(run(s, { type: 'undo' }).tournament!.results).toEqual({ '0:0': 0, '0:1': 1, '1:0': 1 })
    expect(run(created, { type: 'reset' })).toBe(created)
  })

  it('caps the history', () => {
    let s = created
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s = run(s, pick(0, 0, 0))
    expect(s.past).toHaveLength(HISTORY_LIMIT)
  })

  it('a new tournament starts a fresh history', () => {
    const s = run(created, pick(0, 0, 0), { type: 'create', name: 'X', players: ['P', 'Q'] })
    expect(s.past).toEqual([])
    expect(s.tournament!.players).toEqual(['P', 'Q'])
  })
})

describe('parseTournament', () => {
  it('accepts a valid saved tournament and prunes its results', () => {
    expect(parseTournament({ name: 'Cup', players: ['A', 'B', 'C'], results: { '0:1': 2, '1:0': 1, bad: 1, '0:0': 'x' } })).toEqual({
      name: 'Cup',
      players: ['A', 'B', 'C'],
      results: { '0:1': 2 },
    })
  })

  it('rejects broken data', () => {
    expect(parseTournament(null)).toBeNull()
    expect(parseTournament({ players: 'A,B' })).toBeNull()
    expect(parseTournament({ players: ['A'] })).toBeNull()
    expect(parseTournament({ players: ['A', 2] })).toBeNull()
    expect(parseTournament({ players: ['A', 'a'] })).toBeNull()
  })

  it('defaults a missing name and results', () => {
    expect(parseTournament({ players: ['A', 'B'] })).toEqual({ name: '', players: ['A', 'B'], results: {} })
  })
})
