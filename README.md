# Manager 2D

A football manager game for the browser (desktop and mobile). Fictional clubs,
leagues and players. Swedish, English and Spanish.

## Run it locally

Needs Node.js 20 or newer.

```sh
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). To test on a
phone, open the "Network" address it prints while the phone is on the same wifi.

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Development server with hot reload              |
| `npm test`          | Engine, balance, replay and UI smoke tests      |
| `npm run typecheck` | TypeScript check                                |
| `npm run build`     | Production build in `dist/`                     |

The game saves automatically in the browser (localStorage). Settings has
export and import of the save as a file.

## How it fits together

```
src/
  game/        The engine: plain TypeScript, no React
    types.ts       Everything in a save (GameState)
    constants.ts   Balance knobs: economy, training, energy, formations
    generate.ts    New world: clubs, squads, free agents
    match.ts       Match simulation + replay touches; createMatch can pause at set pieces
    setpieces.ts   Penalties and free kicks: aim, accuracy, keeper reach
    live.ts        Drives the user's match live in the viewer; stops at set pieces, injuries and half-time
    clock.ts       Added time: running match minutes to "45+2'" on the scoreboard
    week.ts        The weekly loop: startWeek -> live match -> finishWeek
    training.ts    Development and decline
    morale.ts      Happiness, talks, promises, transfer requests
    contracts.ts   Demands and negotiation
    transfers.ts   Scouting, bids, loans, AI market
    finance.ts     Weekly money and budgets
    monetization.ts Energy, diamonds, mock shop
  i18n/        sv.ts is the reference; en.ts and es.ts must have the same keys
  ui/          React screens; MatchViewer.tsx draws the 2D match
  store.ts     App state; every game change goes through act()
```

All randomness comes from a seeded generator stored in the save, so a match
replays identically from its seed and the user's set-piece choices. Reloading
mid-match resumes the same match.

## Money

Energy and diamonds work, but buying diamonds goes through a mock payment
provider (`mockPaymentProvider` in `src/game/monetization.ts`) that approves
everything for free. Before real payments: use Stripe on the web or Apple/Google
in-app purchases in the apps, and move balances to a server, since local saves
can be edited.
