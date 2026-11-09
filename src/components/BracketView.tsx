import { useState } from 'react'
import { Check, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isPlayable, roundName, type Match, type Slot } from '../bracket'

/** Layout, in px. Each first-round match gets PITCH of height; later rounds sit centred between their feeders. */
const SLOT_H = 36
const CARD_H = SLOT_H * 2 + 1
const PITCH = CARD_H + 16
const COL_W = 196
const GAP = 36
const HEAD_H = 28

interface Props {
  bracket: Match[][]
  players: string[]
  onPick: (round: number, index: number, seed: number) => void
}

/** Vertical centre of match `index` in a round of `count` matches, in a body of `height`. */
const centre = (height: number, count: number, index: number) => (height * (2 * index + 1)) / (2 * count)
const colX = (round: number) => round * (COL_W + GAP)

export function BracketView({ bracket, players, onPick }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const rounds = bracket.length
  const height = bracket[0].length * PITCH
  const champ = bracket[rounds - 1][0].winner
  const width = colX(rounds) + COL_W

  const connectors: { d: string; live: boolean }[] = []
  for (let r = 0; r <= rounds - 1; r++) {
    bracket[r].forEach((m, i) => {
      const x = colX(r) + COL_W
      const y = centre(height, bracket[r].length, i)
      const last = r === rounds - 1
      const y2 = last ? y : centre(height, bracket[r + 1].length, Math.floor(i / 2))
      const mid = x + GAP / 2
      connectors.push({ d: `M${x} ${y} H${mid} V${y2} H${x + GAP}`, live: m.winner !== null })
    })
  }

  return (
    <div className="overflow-x-auto pb-2" data-testid="bracket-scroll">
      <div className="relative mx-auto" style={{ width, height: height + HEAD_H }}>
        {bracket.map((round, r) => (
          <div
            key={r}
            role="group"
            aria-label={roundName(r, rounds)}
            className="absolute top-0"
            style={{ left: colX(r), width: COL_W, height: height + HEAD_H }}
          >
            <h3 className="h-7 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">{roundName(r, rounds)}</h3>
            {round.map((m, i) => (
              <MatchCard
                key={i}
                match={m}
                label={`${roundName(r, rounds)}, match ${i + 1}`}
                players={players}
                hovered={hovered}
                onHover={setHovered}
                onPick={onPick}
                top={HEAD_H + centre(height, round.length, i) - CARD_H / 2}
              />
            ))}
          </div>
        ))}

        <svg className="pointer-events-none absolute left-0" style={{ top: HEAD_H }} width={width} height={height} aria-hidden>
          {/* Decided lines last, so they sit on top where they share a segment with an undecided one. */}
          {connectors.toSorted((a, b) => Number(a.live) - Number(b.live)).map((c, i) => (
            <path
              key={i}
              d={c.d}
              fill="none"
              strokeWidth={c.live ? 2 : 1.5}
              className={c.live ? 'stroke-emerald-500 dark:stroke-emerald-400' : 'stroke-border'}
            />
          ))}
        </svg>

        <div className="absolute top-0" style={{ left: colX(rounds), width: COL_W }}>
          <h3 className="h-7 text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">Champion</h3>
          <div
            className={cn(
              'absolute flex w-full items-center gap-2 rounded-lg border px-3 transition-colors',
              champ === null ? 'border-dashed text-muted-foreground' : 'border-amber-500/60 bg-amber-500/10 font-semibold shadow-sm',
            )}
            style={{ top: HEAD_H + height / 2 - CARD_H / 2, height: CARD_H }}
            data-testid="champion-box"
          >
            <Trophy className={cn('size-5 shrink-0', champ === null ? 'opacity-40' : 'text-amber-500')} aria-hidden />
            <span className="truncate">{champ === null ? 'To be decided' : players[champ]}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CardProps {
  match: Match
  label: string
  players: string[]
  hovered: number | null
  onHover: (seed: number | null) => void
  onPick: Props['onPick']
  top: number
}

function MatchCard({ match, label, players, hovered, onHover, onPick, top }: CardProps) {
  const playable = isPlayable(match)
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('absolute w-full overflow-hidden rounded-lg border bg-card shadow-xs', match.bye && 'opacity-60 shadow-none')}
      style={{ top, height: CARD_H }}
    >
      <SlotRow slot={match.top} {...{ match, players, hovered, onHover, onPick, playable }} />
      <div className="h-px bg-border" />
      <SlotRow slot={match.bottom} {...{ match, players, hovered, onHover, onPick, playable }} />
    </div>
  )
}

interface SlotProps {
  slot: Slot
  match: Match
  players: string[]
  hovered: number | null
  onHover: (seed: number | null) => void
  onPick: Props['onPick']
  playable: boolean
}

function SlotRow({ slot, match, players, hovered, onHover, onPick, playable }: SlotProps) {
  if (slot.kind !== 'player') {
    return (
      <div className="flex items-center px-2.5 text-sm text-muted-foreground italic" style={{ height: SLOT_H }}>
        {slot.kind === 'bye' ? 'Bye' : 'TBD'}
      </div>
    )
  }
  const { seed } = slot
  const won = match.winner === seed
  const lost = match.winner !== null && !won
  const name = players[seed]
  return (
    <button
      type="button"
      aria-label={`${name} (seed ${seed + 1})`}
      aria-pressed={playable ? won : undefined}
      data-highlight={hovered === seed || undefined}
      disabled={!playable}
      title={playable ? (won ? `Undo ${name}'s win` : `${name} wins`) : undefined}
      onClick={() => onPick(match.round, match.index, seed)}
      onMouseEnter={() => onHover(seed)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(seed)}
      onBlur={() => onHover(null)}
      className={cn(
        'flex w-full items-center gap-2 px-2.5 text-left text-sm transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        playable && 'cursor-pointer hover:bg-muted',
        !playable && 'cursor-default',
        won && 'bg-emerald-500/10 font-semibold hover:bg-emerald-500/15 dark:bg-emerald-400/10',
        lost && 'text-muted-foreground',
        hovered === seed && !won && 'bg-accent',
        hovered === seed && 'ring-1 ring-emerald-500/50 ring-inset',
      )}
      style={{ height: SLOT_H }}
    >
      <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">{seed + 1}</span>
      <span className={cn('min-w-0 flex-1 truncate', lost && 'line-through decoration-muted-foreground/60')}>{name}</span>
      {won && !match.bye && <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
    </button>
  )
}
