import { beforeEach, describe, expect, it } from 'vitest'
import { defaults, load, save, STORAGE_KEY } from './storage'

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('falls back to defaults when nothing is saved or the data is corrupt', () => {
    expect(load()).toEqual(defaults)
    localStorage.setItem(STORAGE_KEY, '{nope')
    expect(load()).toEqual(defaults)
    localStorage.setItem(STORAGE_KEY, '[1,2]')
    expect(load()).toEqual(defaults)
  })

  it('round-trips a tournament and draft', () => {
    const saved = {
      tournament: { name: 'Cup', players: ['A', 'B'], results: { '0:0': 1 } },
      draft: { name: 'Cup', text: 'A\nB' },
    }
    save(saved)
    expect(load()).toEqual(saved)
  })

  it('keeps the draft when the tournament is damaged', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tournament: { players: 7 }, draft: { name: 'N', text: 'A\nB', extra: 1 } }))
    expect(load()).toEqual({ tournament: null, draft: { name: 'N', text: 'A\nB' } })
  })

  it('survives storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('full')
      },
    } as unknown as Storage
    expect(load(broken)).toEqual(defaults)
    expect(() => save(defaults, broken)).not.toThrow()
  })
})
