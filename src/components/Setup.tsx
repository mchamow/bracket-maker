import { ListOrdered, Shuffle, Sparkles, Swords } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { bracketSize, MAX_PLAYERS, parsePlayers, roundCount, shuffle, validatePlayers } from '../bracket'
import { EXAMPLE } from '../example'
import type { Draft } from '../storage'

interface Props {
  draft: Draft
  onDraft: (draft: Draft) => void
  onCreate: (name: string, players: string[]) => void
  /** Present when there's a bracket to go back to. */
  onCancel?: () => void
}

export function Setup({ draft, onDraft, onCreate, onCancel }: Props) {
  const players = parsePlayers(draft.text)
  const error = players.length === 0 ? null : validatePlayers(players)
  const size = bracketSize(players.length)
  const byes = size - players.length
  const ready = players.length > 0 && !error

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (ready) onCreate(draft.name, players)
  }

  return (
    <Card className="mx-auto w-full max-w-xl">
      <form onSubmit={submit} className="contents">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListOrdered className="size-5 text-primary" aria-hidden />
            Set up the tournament
          </CardTitle>
          <CardDescription>
            One player or team per line, {MAX_PLAYERS} at most. The order is the seeding: the first line is the top seed. Top seeds get the byes
            when the count isn't a power of two.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Tournament name</Label>
            <Input
              id="name"
              value={draft.name}
              maxLength={80}
              placeholder="Office ping-pong open"
              onChange={(e) => onDraft({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="players">Players</Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => onDraft(EXAMPLE)}>
                  <Sparkles aria-hidden />
                  Example
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={players.length < 2}
                  onClick={() => onDraft({ ...draft, text: shuffle(players).join('\n') })}
                >
                  <Shuffle aria-hidden />
                  Shuffle seeds
                </Button>
              </div>
            </div>
            <Textarea
              id="players"
              value={draft.text}
              rows={10}
              placeholder={'Ada\nGrace\nAlan\nLinus'}
              className="min-h-48 font-mono text-sm"
              aria-invalid={error ? true : undefined}
              aria-describedby="players-status"
              onChange={(e) => onDraft({ ...draft, text: e.target.value })}
            />
            <p id="players-status" className="min-h-5 text-sm" aria-live="polite">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : players.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                  <Badge variant="secondary">{players.length} players</Badge>
                  <Badge variant="outline">{size}-place bracket</Badge>
                  <Badge variant="outline">
                    {roundCount(players.length)} {roundCount(players.length) === 1 ? 'round' : 'rounds'}
                  </Badge>
                  {byes > 0 && <Badge variant="outline">{byes === 1 ? '1 bye' : `${byes} byes`}</Badge>}
                </span>
              ) : (
                <span className="text-muted-foreground">Add at least two players, or load the example.</span>
              )}
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Back to bracket
            </Button>
          )}
          <Button type="submit" disabled={!ready}>
            <Swords aria-hidden />
            Create bracket
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
