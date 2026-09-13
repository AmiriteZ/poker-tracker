# Poker Ledger

A poker winnings/loss tracker for friends. React + TypeScript + Tailwind on the front, Express + Prisma + PostgreSQL on the back, Firebase for sign-in, Cloudinary for profile pictures.

```
poker-tracker/
├── client/   Vite + React 18 + TypeScript + Tailwind + shadcn-style UI + Recharts
├── server/   Express 4 + Prisma 7 (Postgres) + Firebase Admin token verification
└── docker-compose.yml   local PostgreSQL
```

## What it does

- **Accounts** via Firebase Auth (email/password + Google).
- **Groups** — create one, get a 7-character code + invite link. Friends enter the code, the admin confirms them. You can be in as many groups as you like.
- **Game days** (admin) — pick a date, location (free text) and seat the players who showed up.
- **Results** (players) — each player enters their own buy-in (including rebuys) and cash-out. Net = cash-out − buy-in. The session page shows the night's top winner / biggest loser and warns when the table doesn't balance.
- **Player profiles** — stats + cumulative profit chart + per-session bars, filterable by 30d / 90d / 1y / all.
- **Leaderboard** per group.
- **Your profile** — all-time totals across every group and solo games, per-group breakdown, Cloudinary avatar upload, display-name edit.
- **Solo games** tab for games outside any group (with a reminder not to double-log group sessions).
- **Dark / light / system** theme, responsive down to phone width.

## Setup

### 1. Prerequisites

- Node 20+ and npm
- Docker Desktop (for the local Postgres) — or any Postgres you can reach
- A Firebase project and a Cloudinary account (both free tiers are fine)

### 2. Install

```bash
npm install
```

(This installs both workspaces and generates the Prisma client.)

### 3. Firebase

1. Firebase Console → create a project → **Authentication** → enable *Email/Password* and *Google*.
2. **Project settings → General → Your apps → Add web app**. Copy the config into `client/.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_APP_ID=...
   ```
3. **Project settings → Service accounts → Generate new private key**. Save the JSON as `server/firebase-service-account.json` (it's git-ignored).

### 4. Cloudinary

Dashboard → *Product Environment Credentials*. Put cloud name, API key and API secret in `server/.env`.

### 5. Server env

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in the values described above. The default `DATABASE_URL` matches `docker-compose.yml`.

### 6. Database

```bash
npm run db:up        # starts Postgres in Docker
npm run db:migrate   # creates the tables (prompts for a migration name the first time — "init" is fine)
```

### 7. Run

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:4000 (the Vite dev server proxies `/api` to it)

## How the pieces fit

**Auth flow.** The React app signs in with the Firebase Web SDK and attaches the ID token as `Authorization: Bearer …` to every `/api` call. `server/src/middleware/auth.ts` verifies it with the Firebase Admin SDK and upserts a `User` row, so the rest of the API works with our own user ids. Nothing under `/api` is reachable without a valid token.

**Permissions.** `server/src/lib/access.ts` has `requireMember` / `requireAdmin`. Members see approved members, sessions, leaderboards and player stats. Admins additionally see pending requests + the invite code, and can create/edit/delete sessions, seat/unseat players, fill in a result on a player's behalf, approve/reject requests, promote/demote, and remove members. Players can only write their *own* result row.

**Join flow.** Admin shares `https://<app>/join/<CODE>` or just the code → user requests to join (membership `PENDING`) → admin approves in the group's *Manage* tab.

**Data model** (`server/prisma/schema.prisma`): `User`, `Group`, `Membership` (role + status), `Session`, `SessionResult` (one per seated player; `cashOut` null until submitted), `SoloGame`.

**Avatars.** The API signs a Cloudinary upload (`POST /api/me/avatar/sign`); the browser uploads straight to Cloudinary, then saves the returned URL via `PATCH /api/me`. The API secret never leaves the server.

## API summary

| Method | Path | Who |
|---|---|---|
| GET/PATCH | `/api/me` | me |
| GET | `/api/me/stats` | me — all-time, groups, solo, by-group |
| POST | `/api/me/avatar/sign` | me |
| GET/POST | `/api/groups` | list mine / create |
| POST | `/api/groups/join` `{code}` | request to join |
| GET | `/api/groups/preview/:code` | invite landing page |
| GET/PATCH | `/api/groups/:id` | member / admin |
| POST | `/api/groups/:id/regenerate-code` | admin |
| POST | `/api/groups/:id/members/:mid/approve` · `/reject` | admin |
| PATCH/DELETE | `/api/groups/:id/members/:mid` | admin (or self-leave) |
| GET | `/api/groups/:id/leaderboard` | member |
| GET | `/api/groups/:id/players/:userId/stats` | member |
| GET/POST | `/api/groups/:id/sessions` | member / admin |
| GET/PATCH/DELETE | `/api/groups/:id/sessions/:sid` | member / admin |
| POST/DELETE | `/api/groups/:id/sessions/:sid/players[/:userId]` | admin |
| PUT | `/api/groups/:id/sessions/:sid/results/me` (or `/:userId` for admins) | member |
| GET/POST | `/api/solo` · PATCH/DELETE `/api/solo/:id` | me |

## Deploying

- **Database:** Neon, Supabase, Railway or Render Postgres. Set `DATABASE_URL`, run `npm run prisma:deploy -w server`.
- **API:** Railway / Render / Fly. Set `PORT`, `CLIENT_ORIGIN` (your frontend URL), `DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the JSON inline instead of a file), and the Cloudinary vars. Build with `npm run build -w server`, start with `npm start -w server`.
- **Client:** Vercel / Netlify / Firebase Hosting. Set the `VITE_*` vars plus `VITE_API_URL=https://your-api`. Build with `npm run build -w client`, publish `client/dist`. Add your production domain to Firebase Auth → *Authorized domains*.

## Useful scripts

| Command | What |
|---|---|
| `npm run dev` | client + server together |
| `npm run db:up` | start Postgres (Docker) |
| `npm run db:migrate` | apply schema changes |
| `npm run db:studio` | Prisma Studio — browse the DB |
| `npm run build` | production builds for both |
