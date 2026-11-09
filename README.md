# 🏆 Bracket Maker

[![Test and deploy](https://github.com/mchamow/bracket-maker/actions/workflows/deploy.yml/badge.svg)](https://github.com/mchamow/bracket-maker/actions/workflows/deploy.yml)

**Day 39 of [100 Days of React](https://github.com/mchamow?tab=repositories)**: Build single-elimination tournament brackets and click winners through to the champion.

**Live demo:** https://mchamow.github.io/bracket-maker/

## Features

- **Set up in seconds**: a tournament name and 2–64 players or teams, one per line. The order is the seeding; *Shuffle seeds* randomises it and *Example* loads an eight-planet cup. It tells you the bracket size, rounds and byes as you type, and flags duplicate names
- **Proper seeding**: standard bracket placement (1 v 8, 4 v 5, 2 v 7, 3 v 6, …), so the top two seeds can only meet in the final. When the count isn't a power of two the top seeds get byes and go straight through
- **Click winners through**: click a player to send them to the next round; click them again to take it back. Change an early result and every later match that depended on it is cleared
- **Bracket view**: rounds named from the final backwards (Round of 16, Quarterfinals, Semifinals, Final), connector lines that light up as winners advance, a champion box and banner, and a progress count of matches played (byes don't count). Hover or focus a player to trace their path
- **Undo and redo** every result: buttons, or <kbd>⌘/Ctrl</kbd> + <kbd>Z</kbd> and <kbd>⇧</kbd> + <kbd>⌘</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd>. *Reset results* is undoable too
- **Copy results** as plain text: the champion, then every round from the final down, with seeds
- **Edit players** at any time; replacing a bracket that has results asks first
- The bracket, its results and an unfinished setup are saved in this browser
- Light and dark themes that follow the system, and a phone layout (the bracket scrolls sideways)

## How it works

- [`src/bracket.ts`](src/bracket.ts): pure bracket logic. Only decided matches are stored (`"round:match" → winner seed`); who plays whom, byes and the champion are derived from the player count and those results, and any result whose winner is no longer in its match drops out
- [`src/tournament.ts`](src/tournament.ts): the reducer with undo/redo history, and the guarded parser for saved tournaments
- [`src/storage.ts`](src/storage.ts): `localStorage` load that checks each part on its own and falls back to defaults
- [`src/components/BracketView.tsx`](src/components/BracketView.tsx): matches positioned by arithmetic (each sits halfway between its two feeders), with the SVG connectors computed from the same numbers, so nothing has to be measured

## Tech

React 19 · TypeScript · Vite · Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI) · lucide icons · Vitest + Testing Library · deployed to GitHub Pages with GitHub Actions.

## Run locally

```bash
pnpm install
pnpm dev
pnpm test   # 57 unit and component tests (Vitest)
```
