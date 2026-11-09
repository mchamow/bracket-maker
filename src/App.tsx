import { useEffect, useMemo, useReducer, useState } from 'react'
import { Check, ClipboardCopy, PencilLine, Redo2, RotateCcw, Trophy, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { buildBracket, champion, progress, resultsText } from './bracket'
import { BracketView } from './components/BracketView'
import { Setup } from './components/Setup'
import { load, save, type Draft } from './storage'
import { reducer } from './tournament'

export const COPIED_FOR = 2000

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

export default function App() {
  const [initial] = useState(load)
  const [state, dispatch] = useReducer(reducer, { tournament: initial.tournament, past: [], future: [] })
  const [draft, setDraft] = useState<Draft>(initial.draft)
  const [editing, setEditing] = useState(initial.tournament === null)
  const [pending, setPending] = useState<{ name: string; players: string[] } | null>(null)
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const t = state.tournament

  useEffect(() => save({ tournament: t, draft }), [t, draft])

  const bracket = useMemo(() => (t ? buildBracket(t.players.length, t.results) : null), [t])
  const showBracket = t && bracket && !editing

  useEffect(() => {
    if (!showBracket) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return
      if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')) return
      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' })
      } else if (key === 'y' && !e.shiftKey) {
        e.preventDefault()
        dispatch({ type: 'redo' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showBracket])

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(null), COPIED_FOR)
    return () => clearTimeout(id)
  }, [copied])

  const create = (name: string, players: string[]) => {
    dispatch({ type: 'create', name, players })
    setEditing(false)
    setPending(null)
  }

  const requestCreate = (name: string, players: string[]) => {
    if (t && Object.keys(t.results).length > 0) setPending({ name, players })
    else create(name, players)
  }

  const edit = () => {
    if (t) setDraft({ name: t.name, text: t.players.join('\n') })
    setEditing(true)
  }

  const copy = async () => {
    if (!t || !bracket) return
    try {
      await navigator.clipboard.writeText(resultsText(t.name, t.players, bracket))
      setCopied('ok')
    } catch {
      setCopied('failed')
    }
  }

  const champ = bracket ? champion(bracket) : null
  const done = bracket ? progress(bracket) : null

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <header className="border-b bg-muted/30">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4">
            <span className="text-2xl" aria-hidden>
              🏆
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">Bracket Maker</h1>
              <p className="text-sm text-muted-foreground">Single-elimination brackets: seed, click winners, crown a champion.</p>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">
          {showBracket ? (
            <section className="grid gap-4" aria-labelledby="tournament-name">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h2 id="tournament-name" className="min-w-0 truncate text-lg font-semibold">
                  {t.name || 'Tournament'}
                </h2>
                <Badge variant="secondary" data-testid="progress">
                  {done!.decided} of {done!.total} matches played
                </Badge>
                <div className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto">
                  <IconButton label="Undo" shortcut={`${mod}Z`} disabled={state.past.length === 0} onClick={() => dispatch({ type: 'undo' })}>
                    <Undo2 />
                  </IconButton>
                  <IconButton
                    label="Redo"
                    shortcut={isMac ? '⇧⌘Z' : 'Ctrl+Y'}
                    disabled={state.future.length === 0}
                    onClick={() => dispatch({ type: 'redo' })}
                  >
                    <Redo2 />
                  </IconButton>
                  <IconButton label="Reset results" disabled={done!.decided === 0} onClick={() => dispatch({ type: 'reset' })}>
                    <RotateCcw />
                  </IconButton>
                  <Button variant="outline" onClick={copy}>
                    {copied === 'ok' ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
                    <span aria-live="polite">{copied === 'ok' ? 'Copied' : copied === 'failed' ? "Couldn't copy" : 'Copy results'}</span>
                  </Button>
                  <Button variant="outline" onClick={edit} aria-label="Edit players" className="max-sm:size-8 max-sm:px-0">
                    <PencilLine aria-hidden />
                    <span className="hidden sm:inline">Edit players</span>
                  </Button>
                </div>
              </div>

              <div
                role="status"
                className={
                  champ === null
                    ? 'rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'
                    : 'flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3'
                }
              >
                {champ === null ? (
                  'Click a player in a match to send them through to the next round. Click again to take it back.'
                ) : (
                  <>
                    <Trophy className="size-6 shrink-0 text-amber-500" aria-hidden />
                    <span>
                      <span className="text-sm text-muted-foreground">Champion</span>
                      <br />
                      <strong className="text-lg">{t.players[champ]}</strong>
                      <span className="text-sm text-muted-foreground"> · seed {champ + 1}</span>
                    </span>
                  </>
                )}
              </div>

              <BracketView bracket={bracket} players={t.players} onPick={(round, index, seed) => dispatch({ type: 'pick', round, index, seed })} />
            </section>
          ) : (
            <Setup draft={draft} onDraft={setDraft} onCreate={requestCreate} onCancel={t ? () => setEditing(false) : undefined} />
          )}
        </main>

        <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start a new bracket?</DialogTitle>
              <DialogDescription>The results in the current bracket will be lost. This can't be undone.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button onClick={() => pending && create(pending.name, pending.players)}>Start new bracket</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

function IconButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="text-background/70">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
