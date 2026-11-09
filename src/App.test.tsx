import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { COPIED_FOR } from './App'
import { STORAGE_KEY } from './storage'

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const textbox = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement
const match = (label: string) => screen.getByRole('group', { name: label })
const slot = (label: string, player: string) => within(match(label)).getByRole('button', { name: new RegExp(`^${player} \\(seed`) })
const pick = (label: string, player: string) => fireEvent.click(slot(label, player))
const progress = () => screen.getByTestId('progress').textContent
const champion = () => screen.getByTestId('champion-box').textContent
const type = (name: string, value: string) => fireEvent.change(textbox(name), { target: { value } })

/** Example tournament seeds: Jupiter, Saturn, Neptune, Uranus, Earth, Venus, Mars, Mercury. */
function startExample() {
  render(<App />)
  fireEvent.click(button('Example'))
  fireEvent.click(button('Create bracket'))
}

/** Play the example out: Jupiter beats Saturn in the final. */
function playAll() {
  pick('Quarterfinals, match 1', 'Jupiter')
  pick('Quarterfinals, match 2', 'Uranus')
  pick('Quarterfinals, match 3', 'Saturn')
  pick('Quarterfinals, match 4', 'Neptune')
  pick('Semifinals, match 1', 'Jupiter')
  pick('Semifinals, match 2', 'Saturn')
  pick('Final, match 1', 'Jupiter')
}

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  localStorage.clear()
  writeText = vi.fn(() => Promise.resolve())
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('setup', () => {
  it('starts on the setup form with Create disabled until there are players', () => {
    render(<App />)
    expect(button('Create bracket')).toHaveProperty('disabled', true)
    expect(screen.getByText(/Add at least two players/)).toBeTruthy()
    type('Players', 'Ada')
    expect(screen.getByText('Add at least 2 players.')).toBeTruthy()
    expect(button('Create bracket')).toHaveProperty('disabled', true)
  })

  it('loads the example and describes the bracket it will make', () => {
    render(<App />)
    fireEvent.click(button('Example'))
    expect(textbox('Tournament name').value).toBe('Planet Cup')
    expect(textbox('Players').value.split('\n')).toHaveLength(8)
    expect(screen.getByText('8 players')).toBeTruthy()
    expect(screen.getByText('8-place bracket')).toBeTruthy()
    expect(screen.getByText('3 rounds')).toBeTruthy()
    expect(screen.queryByText(/^\d+ byes?$/)).toBeNull()
  })

  it('counts byes and flags duplicate names', () => {
    render(<App />)
    type('Players', 'A\nB\nC\nD\nE')
    expect(screen.getByText('3 byes')).toBeTruthy()
    type('Players', 'Ada\nBo\nada')
    expect(screen.getByText('"ada" is in the list twice.')).toBeTruthy()
    expect(button('Create bracket')).toHaveProperty('disabled', true)
  })

  it('shuffles the seeds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<App />)
    type('Players', 'a\nb\nc\nd')
    fireEvent.click(button('Shuffle seeds'))
    expect(textbox('Players').value).toBe('b\nc\nd\na')
  })

  it('creates a bracket with seeded first-round pairs', () => {
    startExample()
    expect(screen.getByRole('heading', { name: 'Planet Cup' })).toBeTruthy()
    for (const round of ['Quarterfinals', 'Semifinals', 'Final']) expect(screen.getByRole('group', { name: round })).toBeTruthy()
    const names = (label: string) => within(match(label)).getAllByRole('button').map((b) => b.getAttribute('aria-label'))
    expect(names('Quarterfinals, match 1')).toEqual(['Jupiter (seed 1)', 'Mercury (seed 8)'])
    expect(names('Quarterfinals, match 2')).toEqual(['Uranus (seed 4)', 'Earth (seed 5)'])
    expect(within(match('Semifinals, match 1')).getAllByText('TBD')).toHaveLength(2)
    expect(progress()).toBe('0 of 7 matches played')
  })

  it('sends top seeds through their byes', () => {
    render(<App />)
    type('Players', 'A\nB\nC')
    fireEvent.click(button('Create bracket'))
    expect(within(match('Semifinals, match 1')).getByText('Bye')).toBeTruthy()
    expect(slot('Semifinals, match 1', 'A')).toHaveProperty('disabled', true)
    expect(slot('Final, match 1', 'A')).toHaveProperty('disabled', true) // waiting on B v C
    expect(progress()).toBe('0 of 2 matches played')
    pick('Semifinals, match 2', 'C')
    expect(slot('Final, match 1', 'A')).toHaveProperty('disabled', false)
    pick('Final, match 1', 'A')
    expect(screen.getByRole('status').textContent).toMatch(/Champion\s*A · seed 1/)
  })
})

describe('playing', () => {
  it('advances winners round by round to a champion', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    expect(slot('Quarterfinals, match 1', 'Jupiter').getAttribute('aria-pressed')).toBe('true')
    expect(slot('Quarterfinals, match 1', 'Mercury').getAttribute('aria-pressed')).toBe('false')
    expect(slot('Semifinals, match 1', 'Jupiter')).toHaveProperty('disabled', true)
    pick('Quarterfinals, match 2', 'Earth')
    expect(slot('Semifinals, match 1', 'Earth')).toHaveProperty('disabled', false)
    expect(progress()).toBe('2 of 7 matches played')
    expect(champion()).toBe('To be decided')

    pick('Quarterfinals, match 3', 'Saturn')
    pick('Quarterfinals, match 4', 'Venus')
    pick('Semifinals, match 1', 'Earth')
    pick('Semifinals, match 2', 'Venus')
    pick('Final, match 1', 'Venus')
    expect(progress()).toBe('7 of 7 matches played')
    expect(champion()).toBe('Venus')
    expect(screen.getByRole('status').textContent).toMatch(/Venus · seed 6/)
  })

  it('takes a win back when the winner is clicked again', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    pick('Quarterfinals, match 1', 'Jupiter')
    expect(slot('Quarterfinals, match 1', 'Jupiter').getAttribute('aria-pressed')).toBe('false')
    expect(within(match('Semifinals, match 1')).getAllByText('TBD')).toHaveLength(2)
  })

  it('clears later results that depended on a changed one', () => {
    startExample()
    playAll()
    expect(champion()).toBe('Jupiter')
    pick('Quarterfinals, match 1', 'Mercury')
    expect(champion()).toBe('To be decided')
    expect(slot('Semifinals, match 1', 'Mercury').getAttribute('aria-pressed')).toBe('false')
    expect(within(match('Final, match 1')).getByText('TBD')).toBeTruthy()
    expect(slot('Final, match 1', 'Saturn')).toHaveProperty('disabled', true)
    expect(progress()).toBe('5 of 7 matches played')
  })

  it("highlights a player's other matches on hover", () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    fireEvent.mouseEnter(slot('Quarterfinals, match 1', 'Jupiter'))
    expect(slot('Semifinals, match 1', 'Jupiter').hasAttribute('data-highlight')).toBe(true)
    expect(slot('Quarterfinals, match 2', 'Uranus').hasAttribute('data-highlight')).toBe(false)
    fireEvent.mouseLeave(slot('Quarterfinals, match 1', 'Jupiter'))
    expect(slot('Semifinals, match 1', 'Jupiter').hasAttribute('data-highlight')).toBe(false)
  })
})

describe('history', () => {
  it('undoes and redoes with the buttons', () => {
    startExample()
    expect(button('Undo')).toHaveProperty('disabled', true)
    pick('Quarterfinals, match 1', 'Jupiter')
    pick('Quarterfinals, match 2', 'Earth')
    fireEvent.click(button('Undo'))
    expect(progress()).toBe('1 of 7 matches played')
    fireEvent.click(button('Redo'))
    expect(progress()).toBe('2 of 7 matches played')
    expect(button('Redo')).toHaveProperty('disabled', true)
  })

  it('undoes with Ctrl/⌘+Z and redoes with Shift+Z or Ctrl+Y, but not while typing', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(progress()).toBe('0 of 7 matches played')
    fireEvent.keyDown(window, { key: 'Z', metaKey: true, shiftKey: true })
    expect(progress()).toBe('1 of 7 matches played')
    fireEvent.keyDown(window, { key: 'z', metaKey: true })
    fireEvent.keyDown(window, { key: 'y', ctrlKey: true })
    expect(progress()).toBe('1 of 7 matches played')
    fireEvent.keyDown(window, { key: 'z' })
    expect(progress()).toBe('1 of 7 matches played')

    fireEvent.click(button('Edit players'))
    fireEvent.keyDown(textbox('Players'), { key: 'z', ctrlKey: true })
    fireEvent.click(button('Back to bracket'))
    expect(progress()).toBe('1 of 7 matches played')
  })

  it('resets every result as one undoable step', () => {
    startExample()
    playAll()
    fireEvent.click(button('Reset results'))
    expect(progress()).toBe('0 of 7 matches played')
    expect(button('Reset results')).toHaveProperty('disabled', true)
    fireEvent.click(button('Undo'))
    expect(champion()).toBe('Jupiter')
  })
})

describe('copy, edit and save', () => {
  it('copies the results as text', async () => {
    vi.useFakeTimers()
    startExample()
    playAll()
    await act(async () => fireEvent.click(button('Copy results')))
    const text = writeText.mock.calls[0][0] as string
    expect(text.split('\n').slice(0, 5)).toEqual(['Planet Cup', 'Champion: (1) Jupiter', '', 'Final', '  (1) Jupiter def. (2) Saturn'])
    expect(text).toContain('Quarterfinals\n  (1) Jupiter def. (8) Mercury\n  (4) Uranus def. (5) Earth')
    expect(button('Copied')).toBeTruthy()
    act(() => vi.advanceTimersByTime(COPIED_FOR))
    expect(button('Copy results')).toBeTruthy()
  })

  it("says so when the clipboard isn't available", async () => {
    writeText.mockRejectedValue(new Error('denied'))
    startExample()
    await act(async () => fireEvent.click(button('Copy results')))
    expect(button("Couldn't copy")).toBeTruthy()
  })

  it('edits players and goes back without losing results', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    fireEvent.click(button('Edit players'))
    expect(textbox('Players').value.split('\n')[0]).toBe('Jupiter')
    fireEvent.click(button('Back to bracket'))
    expect(progress()).toBe('1 of 7 matches played')
  })

  it('asks before replacing a bracket that has results', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Jupiter')
    fireEvent.click(button('Edit players'))
    type('Players', 'Pluto\nCeres')
    fireEvent.click(button('Create bracket'))
    expect(screen.getByRole('dialog', { name: 'Start a new bracket?' })).toBeTruthy()
    fireEvent.click(button('Cancel'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(textbox('Players').value).toBe('Pluto\nCeres')

    fireEvent.click(button('Create bracket'))
    fireEvent.click(button('Start new bracket'))
    expect(screen.getByRole('group', { name: 'Final' })).toBeTruthy()
    expect(slot('Final, match 1', 'Pluto')).toHaveProperty('disabled', false)
    expect(button('Undo')).toHaveProperty('disabled', true)
  })

  it('replaces a bracket with no results without asking', () => {
    startExample()
    fireEvent.click(button('Edit players'))
    type('Players', 'Pluto\nCeres')
    fireEvent.click(button('Create bracket'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(progress()).toBe('0 of 1 matches played')
  })

  it('remembers the bracket and its results after a reload', () => {
    startExample()
    pick('Quarterfinals, match 1', 'Mercury')
    pick('Quarterfinals, match 2', 'Uranus')
    cleanup()
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Planet Cup' })).toBeTruthy()
    expect(progress()).toBe('2 of 7 matches played')
    expect(slot('Semifinals, match 1', 'Mercury')).toHaveProperty('disabled', false)
  })

  it('remembers an unfinished draft', () => {
    render(<App />)
    type('Tournament name', 'Chess club')
    type('Players', 'Magnus\nHikaru')
    cleanup()
    render(<App />)
    expect(textbox('Tournament name').value).toBe('Chess club')
    expect(textbox('Players').value).toBe('Magnus\nHikaru')
  })

  it('falls back to a fresh setup when saved data is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{"tournament":{"players":"oops"}')
    render(<App />)
    expect(button('Create bracket')).toHaveProperty('disabled', true)
  })
})
