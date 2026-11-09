/**
 * Single-elimination bracket logic, as pure functions.
 *
 * Players are identified by their seed index (0 = top seed). The bracket size is the next power of
 * two; the missing places are byes, which go to the top seeds thanks to the standard seed order
 * (1 v 8, 4 v 5, 2 v 7, 3 v 6, …), so a first-round match never has two byes.
 *
 * Only decided matches are stored, as `results["round:match"] = winner seed`. Everything else
 * (who plays whom, byes, the champion) is derived from the player count and those results.
 */

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 64

export type Results = Record<string, number>

/** A match slot: a player (seed index), a bye, or a place still waiting on an earlier match. */
export type Slot = { kind: 'player'; seed: number } | { kind: 'bye' } | { kind: 'tbd' }

export interface Match {
  round: number
  index: number
  top: Slot
  bottom: Slot
  /** The winner's seed, decided or (for a bye) automatic. */
  winner: number | null
  /** One side is a bye: the other player goes through without playing. */
  bye: boolean
}

export const matchKey = (round: number, index: number) => `${round}:${index}`

/** Smallest power of two that fits `players` (at least 2). */
export function bracketSize(players: number): number {
  let size = 2
  while (size < players) size *= 2
  return size
}

/** Standard seed placement for a bracket of `size`, as 1-based seeds: [1, 8, 4, 5, 2, 7, 3, 6] for 8. */
export function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const n = order.length * 2
    order = order.flatMap((s) => [s, n + 1 - s])
  }
  return order
}

export function roundCount(players: number): number {
  return Math.log2(bracketSize(players))
}

/** "Final", "Semifinals", "Quarterfinals", then "Round of 16", "Round of 32", … */
export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - 1 - round
  if (fromEnd === 0) return 'Final'
  if (fromEnd === 1) return 'Semifinals'
  if (fromEnd === 2) return 'Quarterfinals'
  return `Round of ${2 ** (fromEnd + 1)}`
}

const winnerSlot = (m: Match | undefined): Slot => (m?.winner == null ? { kind: 'tbd' } : { kind: 'player', seed: m.winner })

/**
 * Every match, round by round. A stored result only counts if its winner is actually playing in
 * that match, so results that an earlier change made impossible simply drop out.
 */
export function buildBracket(players: number, results: Results): Match[][] {
  const size = bracketSize(players)
  const order = seedOrder(size)
  const rounds: Match[][] = []
  for (let round = 0; size >> (round + 1) >= 1; round++) {
    const count = size >> (round + 1)
    const matches: Match[] = []
    for (let index = 0; index < count; index++) {
      let top: Slot
      let bottom: Slot
      if (round === 0) {
        const place = (seed: number): Slot => (seed <= players ? { kind: 'player', seed: seed - 1 } : { kind: 'bye' })
        top = place(order[2 * index])
        bottom = place(order[2 * index + 1])
      } else {
        top = winnerSlot(rounds[round - 1][2 * index])
        bottom = winnerSlot(rounds[round - 1][2 * index + 1])
      }
      const bye = top.kind === 'bye' || bottom.kind === 'bye'
      let winner: number | null = null
      if (bye) {
        const player = top.kind === 'player' ? top : bottom.kind === 'player' ? bottom : null
        winner = player ? player.seed : null
      } else if (top.kind === 'player' && bottom.kind === 'player') {
        const stored = results[matchKey(round, index)]
        if (stored === top.seed || stored === bottom.seed) winner = stored
      }
      matches.push({ round, index, top, bottom, winner, bye })
    }
    rounds.push(matches)
  }
  return rounds
}

/** Results with every no-longer-possible entry removed. */
export function pruneResults(players: number, results: Results): Results {
  const kept: Results = {}
  for (const round of buildBracket(players, results)) {
    for (const m of round) {
      if (!m.bye && m.winner !== null) kept[matchKey(m.round, m.index)] = m.winner
    }
  }
  return kept
}

/**
 * Pick `seed` as the winner of a match; picking the current winner again clears it. Later matches
 * that depended on the old result are cleared too. Returns the results unchanged if the match
 * can't be decided (a bye, a place still waiting, or a seed that isn't playing in it).
 */
export function pickWinner(players: number, results: Results, round: number, index: number, seed: number): Results {
  const match = buildBracket(players, results)[round]?.[index]
  if (!match || match.bye || !isPlayable(match)) return results
  const playing = [match.top, match.bottom].some((s) => s.kind === 'player' && s.seed === seed)
  if (!playing) return results
  const next = { ...results }
  if (match.winner === seed) delete next[matchKey(round, index)]
  else next[matchKey(round, index)] = seed
  return pruneResults(players, next)
}

export function isPlayable(m: Match): boolean {
  return !m.bye && m.top.kind === 'player' && m.bottom.kind === 'player'
}

export function champion(bracket: Match[][]): number | null {
  return bracket.at(-1)?.[0]?.winner ?? null
}

/** Matches that need playing (byes excluded), and how many of them are decided. */
export function progress(bracket: Match[][]): { decided: number; total: number } {
  let decided = 0
  let total = 0
  for (const m of bracket.flat()) {
    if (m.bye) continue
    total++
    if (m.winner !== null) decided++
  }
  return { decided, total }
}

/** Seed indices of the players a match was between, when both are known. */
function pair(m: Match): [number, number] | null {
  return m.top.kind === 'player' && m.bottom.kind === 'player' ? [m.top.seed, m.bottom.seed] : null
}

/** Plain-text summary: title, champion, then each round's results from the final backwards. */
export function resultsText(name: string, players: string[], bracket: Match[][]): string {
  const label = (seed: number) => `(${seed + 1}) ${players[seed]}`
  const lines = [name.trim() || 'Tournament']
  const champ = champion(bracket)
  if (champ !== null) lines.push(`Champion: ${label(champ)}`)
  for (let r = bracket.length - 1; r >= 0; r--) {
    const played = bracket[r].filter((m) => !m.bye && m.winner !== null)
    if (played.length === 0) continue
    lines.push('', roundName(r, bracket.length))
    for (const m of played) {
      const [a, b] = pair(m)!
      const loser = m.winner === a ? b : a
      lines.push(`  ${label(m.winner!)} def. ${label(loser)}`)
    }
  }
  return lines.join('\n')
}

/** One name per line, trimmed, blanks dropped, each cut to 40 characters. */
export function parsePlayers(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().slice(0, 40))
    .filter(Boolean)
}

/** Why a player list can't make a bracket, or null if it can. */
export function validatePlayers(players: string[]): string | null {
  if (players.length < MIN_PLAYERS) return `Add at least ${MIN_PLAYERS} players.`
  if (players.length > MAX_PLAYERS) return `At most ${MAX_PLAYERS} players (you have ${players.length}).`
  const seen = new Set<string>()
  for (const p of players) {
    const k = p.toLowerCase()
    if (seen.has(k)) return `"${p}" is in the list twice.`
    seen.add(k)
  }
  return null
}

/** Fisher–Yates shuffle, with an injectable random source for tests. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
