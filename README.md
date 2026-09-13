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
- **Roles** — *Admin* (everything), *Organiser* (creates game days and manages the ones they created; can't approve members or edit others' results), *Member* (view + own results).
- **Game days** (admin or organiser) — pick a date, location (free text) and seat the players who showed up. Each card shows the total pot.
- **Results** (players) — each player enters their own bank buy-in (including rebuys) and cash-out. Net = cash-out − buy-in. The session page shows the pot, the night's top winner / biggest loser, and warns when the table doesn't balance.
- **Chip purchases between players** — bought chips off a friend mid-game? Log it (amount + who from) on your result. It raises your buy-in and their cash-out by that amount; the pot is unchanged and the balance check still works.
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

**Permissions.** `server/src/lib/access.ts` has `requireMember` / `requireOrganiser` / `requireAdmin` / `requireSessionManager`. Members see approved members, sessions, leaderboards and player stats and can only write their *own* result row. Organisers can additionally create game days and edit/delete/seat players on the ones they created. Admins can do all of that on any game day, plus see pending requests + the invite code, fill in a result on a player's behalf, approve/reject requests, change roles, and remove members. A group always keeps at least one admin.

**Chip purchases.** `ChipTransfer` rows (session, seller, buyer, amount). The API keeps `SessionResult.chipsBought` / `chipsSold` in sync so every stats query just uses `buyIn + chipsBought` and `cashOut + chipsSold`. A player can only record purchases where *they* are the buyer (admins can record any); buyer, seller or admin can delete one.

**Join flow.** Admin shares `https://<app>/join/<CODE>` or just the code → user requests to join (membership `PENDING`) → admin approves in the group's *Manage* tab.

**Data model** (`server/prisma/schema.prisma`): `User`, `Group`, `Membership` (role ADMIN/ORGANISER/MEMBER + status), `Session`, `SessionResult` (one per seated player; `cashOut` null until submitted; `chipsBought`/`chipsSold` denormalised), `ChipTransfer`, `SoloGame`.

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
| GET/POST | `/api/groups/:id/sessions` | member / admin or organiser |
| GET/PATCH/DELETE | `/api/groups/:id/sessions/:sid` | member / admin or organiser (own) |
| POST/DELETE | `/api/groups/:id/sessions/:sid/players[/:userId]` | admin / organiser (own game days) |
| PUT | `/api/groups/:id/sessions/:sid/results/me` (or `/:userId` for admins) | member |
| POST | `/api/groups/:id/sessions/:sid/transfers` `{fromUserId, amount}` | member (as buyer) / admin |
| DELETE | `/api/groups/:id/sessions/:sid/transfers/:tid` | buyer, seller or admin |
| GET/POST | `/api/solo` · PATCH/DELETE `/api/solo/:id` | me |

## Deploying to Railway (single service)

In production the Express server also serves the built React app, so the whole thing is **one Railway service + one Postgres database**. No separate front-end host needed.

1. **Push the project to GitHub** (make sure `server/prisma/migrations/` is committed — it is created by `npm run db:migrate`).
2. **Railway → New Project → Deploy from GitHub repo.** Pick the repo. `railway.json` already tells Railway to build with `npm run build` and start with `npm start` (which runs `prisma migrate deploy` first, then the server).
3. **Add Postgres:** in the project, *+ New → Database → PostgreSQL*. Then on your app service → *Variables → + Add Reference* → pick the Postgres `DATABASE_URL`.
4. **Set the remaining variables** on the app service (Variables tab → *Raw Editor* is quickest):
   ```
   NODE_ENV=production
   FIREBASE_SERVICE_ACCOUNT_JSON=<paste the whole contents of firebase-service-account.json on one line>
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
   The `VITE_*` values are baked into the React bundle at build time, which is why they live on the same service. Leave `VITE_API_URL` and `CLIENT_ORIGIN` unset — same origin.
5. **Generate a domain:** service → *Settings → Networking → Generate Domain*. You'll get something like `poker-ledger-production.up.railway.app`.
6. **Authorise that domain in Firebase:** Firebase Console → Authentication → Settings → *Authorized domains* → add the Railway domain. Without this, sign-in fails with `auth/unauthorized-domain`.
7. Redeploy once after setting variables (Deployments → ⋮ → Redeploy) so the client build picks up the `VITE_*` values.

Every push to the connected branch redeploys automatically. Migrations run on each start via `prisma migrate deploy`, so schema changes just need `npm run db:migrate` locally and a commit of the new migration folder.

### Splitting the front end out later (optional)

If you ever want the React app on Vercel/Netlify instead: deploy `client/` there with the `VITE_*` vars plus `VITE_API_URL=https://<railway-domain>`, and set `CLIENT_ORIGIN=https://<vercel-domain>` on the Railway service so CORS allows it. Nothing else changes.

## Useful scripts

| Command | What |
|---|---|
| `npm run dev` | client + server together |
| `npm run db:up` | start Postgres (Docker) |
| `npm run db:migrate` | apply schema changes |
| `npm run db:studio` | Prisma Studio — browse the DB |
| `npm run build` | production builds for both |
