# ScoresOnTheDoors

A prediction tracker for the FIFA World Cup. Players predict scores
for every match, results sync automatically from OpenFootball, and points and
leaderboards update as the tournament unfolds.

Right now this is a single tournament (2026) with a single scoring system, but the code has been structured so that support for other tournaments and scoring systems could be added trivially in the future.

## Features

- **Predictions**: enter a scoreline for every match; knockout games also capture who advances.
- **Automatic results**: fixtures and results sync from the OpenFootball feed on a schedule (with a manual sync in the admin area).
- **Scoring and leaderboards**: live leaderboard ranked by points, with a separate "most perfect scores" board. Both can be viewed Overall and broken down by phase (Group Stage, Knockout Stage, Quarter-finals, Semi-finals, Third place, Final).
- **Country flags**: team names show their country flag (via `flag-icons`).
- **Prediction locks**: predictions lock once a match starts, with admin overrides for exceptions.
- **CSV import**: bulk-import predictions from a CSV (admin), with an in-app format guide.
- **Admin tools**: manage users and roles, set starting scores, override results, trigger a sync, manage lock overrides, and recompute all scores.

## Scoring

Per match (points are configurable per tournament):

- **Exact score** (green): predicted 90-minute scoreline matches exactly. Default +2.
- **Correct result** (amber): right outcome but wrong scoreline. Default +1.
  - Group games: correct 90-minute result (home / draw / away).
  - Knockout games: correct team predicted to advance.
- **Wrong** (red): neither. 0 points.

A player's total is their starting score (an admin-set baseline carried over from
pen-and-paper scoring) plus the sum of points from scored predictions.

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env
#    then edit .env (see "Environment variables" below)

# 3. Create and seed the local database
npm run db:reset

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`.

### Default logins (from the seed)

All seeded users share the password `wc2026test`:

| Username | Role   |
| -------- | ------ |
| bob      | Admin  |
| alice    | Player |
| charlie  | Player |

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable        | Description                                                                 |
| --------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`  | SQLite connection string. Use `file:./dev.db` (see note below).             |
| `AUTH_SECRET`   | Secret for Auth.js sessions. Generate with `openssl rand -base64 32`.       |
| `NEXTAUTH_URL`  | The app's public URL, e.g. `http://localhost:3000`.                         |
| `DISABLE_SYNC`  | Set to `"true"` to disable the background OpenFootball sync (handy in dev).  |

> **Note on `DATABASE_URL`**: keep it as `file:./dev.db`. Prisma resolves a relative
> SQLite path relative to the `prisma/` schema directory, so `file:./dev.db` points at
> `prisma/dev.db` for the CLI, the seed, and the app alike. Do not write
> `file:./prisma/dev.db`, that resolves to `prisma/prisma/dev.db` and breaks.

## Scripts

| Script             | What it does                                                            |
| ------------------ | ---------------------------------------------------------------------- |
| `npm run dev`      | Start the Next.js dev server.                                          |
| `npm run build`    | Production build.                                                      |
| `npm run start`    | Run the production build.                                              |
| `npm run lint`     | Run ESLint.                                                            |
| `npm test`         | Run the Vitest suite once.                                             |
| `npm run test:watch` | Run Vitest in watch mode.                                            |
| `npm run db:reset` | Drop, recreate, and reseed the local dev database (destructive).       |
| `npm run db:clean` | Remove the local `dev.db` files.                                       |
| `npm run db:seed`  | Run the seed script against the current database.                      |
| `npm run db:studio`| Open Prisma Studio to browse the database.                             |

## Data source

Fixtures, teams, groups, and results come from the
[openfootball/worldcup.json](https://github.com/openfootball/worldcup.json) 2026 feed.
A background scheduler refreshes them periodically (skipped when `DISABLE_SYNC="true"`),
and admins can trigger a manual sync. Manual result overrides set in the admin area are
never clobbered by a later sync.

## Testing

```powershell
./.build/build.ps1 -Build BuildTestAndCheck
```

Unit tests cover the pure scoring engine (`src/lib/domain/scoring.ts`) and the CSV
import parser (`src/lib/services/csvImportService.ts`).
