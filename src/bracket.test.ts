import { describe, expect, it } from 'vitest'
import {
  bracketSize,
  buildBracket,
  champion,
  matchKey,
  parsePlayers,
  pickWinner,
  progress,
  pruneResults,
  resultsText,
  roundCount,
  roundName,
  seedOrder,
  shuffle,
  validatePlayers,
  type Match,
  type Results,
  type Slot,
} from './bracket'

const seedOf = (s: Slot) => (s.kind === 'player' ? s.seed : s.kind)
const pairs = (round: Match[]) => round.map((m) => [seedOf(m.top), seedOf(m.bottom)])

/** Play a sequence of picks, each as [round, index, seed]. */
function play(players: number, picks: [number, number, number][]): Results {
  return picks.reduce<Results>((r, [round, index, seed]) => pickWinner(players, r, round, index, seed), {})
}

describe('sizes and seeding', () => {
  it('rounds the bracket up to a power of two', () => {
    expect([2, 3, 4, 5, 8, 9, 16, 17, 64].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16, 16, 32, 64])
    expect(roundCount(2)).toBe(1)
    expect(roundCount(12)).toBe(4)
  })

  it('places seeds in the standard order', () => {
    expect(seedOrder(2)).toEqual([1, 2])
    expect(seedOrder(4)).toEqual([1, 4, 2, 3])
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(seedOrder(16).slice(0, 4)).toEqual([1, 16, 8, 9])
  })

  it('seeds 1 and 2 can only meet in the final', () => {
    for (const size of [4, 8, 16, 32, 64]) {
      const order = seedOrder(size)
      expect(order.indexOf(1) < size / 2).toBe(true)
      expect(order.indexOf(2) >= size / 2).toBe(true)
    }
  })

  it('names rounds from the final backwards', () => {
    expect([0, 1, 2, 3, 4, 5].map((r) => roundName(r, 6))).toEqual([
      'Round of 64',
      'Round of 32',
      'Round of 16',
      'Quarterfinals',
      'Semifinals',
      'Final',
    ])
    expect(roundName(0, 1)).toBe('Final')
  })
})

describe('buildBracket', () => {
  it('pairs a full bracket of 8 and leaves later rounds waiting', () => {
    const b = buildBracket(8, {})
    expect(b.map((r) => r.length)).toEqual([4, 2, 1])
    expect(pairs(b[0])).toEqual([
      [0, 7],
      [3, 4],
      [1, 6],
      [2, 5],
    ])
    expect(pairs(b[1])).toEqual([
      ['tbd', 'tbd'],
      ['tbd', 'tbd'],
    ])
    expect(b.flat().every((m) => !m.bye && m.winner === null)).toBe(true)
  })

  it('gives byes to the top seeds and sends them straight through', () => {
    const b = buildBracket(5, {})
    expect(pairs(b[0])).toEqual([
      [0, 'bye'],
      [3, 4],
      [1, 'bye'],
      [2, 'bye'],
    ])
    expect(b[0].map((m) => m.bye)).toEqual([true, false, true, true])
    expect(pairs(b[1])).toEqual([
      [0, 'tbd'],
      [1, 2],
    ])
  })

  it('never puts two byes in one match', () => {
    for (let n = 2; n <= 64; n++) {
      const b = buildBracket(n, {})
      expect(b[0].some((m) => m.top.kind === 'bye' && m.bottom.kind === 'bye')).toBe(false)
      expect(b[0].filter((m) => m.bye)).toHaveLength(bracketSize(n) - n)
    }
  })

  it('ignores a stored result whose winner is not in the match', () => {
    const b = buildBracket(4, { [matchKey(0, 0)]: 2, [matchKey(1, 0)]: 0 })
    expect(b[0][0].winner).toBeNull()
    expect(b[1][0].winner).toBeNull()
  })
})

describe('pickWinner', () => {
  it('advances the winner into the next round', () => {
    const r = play(4, [[0, 0, 3]])
    expect(r).toEqual({ '0:0': 3 })
    expect(buildBracket(4, r)[1][0].top).toEqual({ kind: 'player', seed: 3 })
  })

  it('plays a 4-player bracket to a champion', () => {
    const r = play(4, [
      [0, 0, 0],
      [0, 1, 2],
      [1, 0, 2],
    ])
    const b = buildBracket(4, r)
    expect(champion(b)).toBe(2)
    expect(progress(b)).toEqual({ decided: 3, total: 3 })
  })

  it('picking the winner again clears the result', () => {
    const r = play(4, [
      [0, 0, 0],
      [0, 0, 0],
    ])
    expect(r).toEqual({})
  })

  it('changing a result clears the later matches that depended on it', () => {
    const r = play(8, [
      [0, 0, 0],
      [0, 1, 3],
      [1, 0, 0],
      [0, 2, 1],
      [0, 3, 2],
      [1, 1, 2],
      [2, 0, 0],
    ])
    expect(champion(buildBracket(8, r))).toBe(0)
    const changed = pickWinner(8, r, 0, 0, 7)
    expect(changed).toEqual({ '0:0': 7, '0:1': 3, '0:2': 1, '0:3': 2, '1:1': 2 })
    expect(champion(buildBracket(8, changed))).toBeNull()
  })

  it('does nothing for byes, waiting places or players not in the match', () => {
    const r = play(3, [])
    expect(pickWinner(3, r, 0, 0, 0)).toBe(r) // seed 1 has a bye
    expect(pickWinner(3, r, 1, 0, 0)).toBe(r) // final still waiting on 2 v 3
    expect(pickWinner(3, r, 0, 1, 0)).toBe(r) // seed 1 isn't in 2 v 3
    expect(pickWinner(3, r, 5, 0, 0)).toBe(r) // no such round
  })

  it('counts progress without byes', () => {
    expect(progress(buildBracket(5, {}))).toEqual({ decided: 0, total: 4 })
    expect(progress(buildBracket(5, play(5, [[0, 1, 4]])))).toEqual({ decided: 1, total: 4 })
  })
})

describe('pruneResults', () => {
  it('drops impossible and bye results', () => {
    expect(pruneResults(4, { '0:0': 0, '1:0': 1, '0:1': 9 })).toEqual({ '0:0': 0 })
    expect(pruneResults(3, { '0:0': 0 })).toEqual({})
  })
})

describe('resultsText', () => {
  it('lists the champion and each round from the final down', () => {
    const players = ['Ada', 'Bo', 'Cy', 'Di']
    const r = play(4, [
      [0, 0, 0],
      [0, 1, 2],
      [1, 0, 2],
    ])
    expect(resultsText(' Spring Cup ', players, buildBracket(4, r))).toBe(
      [
        'Spring Cup',
        'Champion: (3) Cy',
        '',
        'Final',
        '  (3) Cy def. (1) Ada',
        '',
        'Semifinals',
        '  (1) Ada def. (4) Di',
        '  (3) Cy def. (2) Bo',
      ].join('\n'),
    )
  })

  it('falls back to a default title and skips rounds with no results', () => {
    expect(resultsText('', ['A', 'B', 'C'], buildBracket(3, {}))).toBe('Tournament')
  })
})

describe('players', () => {
  it('parses one name per line', () => {
    expect(parsePlayers('  Ada \n\n Bo\n' + 'x'.repeat(50))).toEqual(['Ada', 'Bo', 'x'.repeat(40)])
  })

  it('validates count and duplicates', () => {
    expect(validatePlayers(['A'])).toMatch(/at least 2/)
    expect(validatePlayers(Array.from({ length: 65 }, (_, i) => `P${i}`))).toMatch(/At most 64/)
    expect(validatePlayers(['Ada', 'Bo', 'ada'])).toMatch(/"ada" is in the list twice/)
    expect(validatePlayers(['Ada', 'Bo'])).toBeNull()
  })

  it('shuffles without losing anyone', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const out = shuffle(items, () => 0)
    expect(out).toEqual(['b', 'c', 'd', 'e', 'a'])
    expect(items).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect([...shuffle(items)].sort()).toEqual(items)
  })
})
