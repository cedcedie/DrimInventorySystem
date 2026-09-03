# DRIM IMS — Handover Guide

Purpose: walk through moving the app from your (developer) accounts to the
client's own GitHub / Vercel / Neon accounts, so they own their hosting,
billing, and data going forward — and to reset the database from demo/mock
data to a clean production start with one real login.

Two paths, pick one for the meeting:

- **Path A — Transfer what's already running (recommended).** The GitHub
  repo, Vercel project, and Neon database that were just tested stay exactly
  as they are — you just hand the keys to the client's own accounts. Fastest,
  fewest moving parts, nothing to re-migrate live.
- **Path B — Fresh setup from scratch.** Client's own brand-new GitHub repo,
  Vercel project, and Neon database, all wired up from zero. More steps, more
  that can go wrong live — only use this if Path A isn't possible for some
  reason (e.g. you want to fully sever the current infra).

This doc covers Path A in full, with a condensed note for Path B at the end
reusing the same steps.

---

## 0. Before the meeting

Confirm you (the developer) still have:
- Push access to the current GitHub repo (`github.com/cedcedie/DrimInventorySystem`)
- Owner access on the current Vercel project
- Owner/Admin access on the current Neon project
- This repo checked out locally with `master` up to date

And have on hand: the current `.env` values (`DATABASE_URL`, `DIRECT_URL`,
`AUTH_SECRET`) — you'll need to confirm these still work after the Vercel
transfer, not retype them (see step 3).

---

## 1. Accounts the client needs

All free to create (Vercel needs a paid Pro upgrade — see step 2b):

| Service | URL | Needed for |
|---|---|---|
| GitHub | github.com/join | Owns the source code |
| Vercel | vercel.com/signup | Hosting — sign up with the GitHub account above for the smoothest connection |
| Neon | neon.tech | Database |
| Sentry *(optional)* | sentry.io | Error tracking — safe to skip for now, wire in later |
| Upstash *(optional)* | upstash.com | Rate limiting — safe to skip for now, wire in later |

None of these require a credit card to sign up (Vercel Pro is the one paid
step, billed after upgrade — see 2b).

---

## 2. Transfer the GitHub repo

**a. Client creates their GitHub account** (if they don't have one already).

**b. You transfer the repo to them:**

1. Go to `github.com/cedcedie/DrimInventorySystem` → **Settings** → scroll to
   **Danger Zone** → **Transfer ownership**.
2. Enter the client's GitHub username, confirm.
3. GitHub emails the client a transfer request — have them accept it from
   their own account, right there in the meeting.

The repo URL becomes `github.com/<client-username>/DrimInventorySystem` (or
whatever they rename it to). Once accepted, on your own machine:

```bash
git remote set-url origin https://github.com/<client-username>/DrimInventorySystem.git
git push origin master
```

*(Only needed if you plan to keep contributing from this local checkout —
otherwise this remote no longer matters to you.)*

---

## 3. Transfer the Vercel project

1. In the **current** Vercel project → **Settings** → **Transfer** (near the
   bottom, "Transfer Project").
2. Enter the client's Vercel account/team. This sends a transfer request.
3. Client logs into their new Vercel account (sign up with GitHub in step 1
   makes this one click) and accepts the transfer from their dashboard
   notifications.

**Environment variables carry over automatically** — they belong to the
project, not the account. After the transfer, sanity-check them:
Vercel dashboard → the project → **Settings** → **Environment Variables** —
confirm `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` are still there.

**b. Upgrade to Pro** (needed for real production use — better uptime,
no execution timeouts on longer requests like PDF export):
Project/Account → **Settings** → **Billing** → upgrade to **Pro**. This is
where the client's card goes on file. Do this either just before or right
after accepting the transfer — Vercel allows both orders.

**c. Reconnect the Git integration** if it didn't carry over automatically:
Project → **Settings** → **Git** → connect to the repo at its new location
(`github.com/<client-username>/DrimInventorySystem`). A push to `master`
should trigger a new deployment to confirm this works.

---

## 4. Transfer the Neon database

1. Neon console → the project → **Settings** → **Transfer project** (exact
   wording may vary — Neon's UI changes; look under project settings for a
   transfer/ownership option).
2. Enter the client's Neon account, they accept from their side.

The connection strings (`DATABASE_URL`, `DIRECT_URL`) **do not change** —
same host, same database, just a different owner. So nothing needs updating
in Vercel's env vars after this step.

*If Neon's transfer flow isn't available or is giving trouble live*: fall
back to having the client create a fresh Neon project (free tier, Singapore
region — same as the current one, for low latency to Vercel's region), then:

```bash
# from your local checkout, pointed at the NEW Neon project's connection strings
DATABASE_URL="<new pooled url>" DIRECT_URL="<new direct url>" pnpm prisma migrate deploy
```

This creates the schema fresh (empty — no data to wipe, skip step 6). Update
`DATABASE_URL`/`DIRECT_URL` in Vercel's env vars to the new strings, and
redeploy.

---

## 5. Confirm the live site works

Visit the production URL (find it on the Vercel project's Overview tab).
Should load the login screen. Don't log in with the demo accounts yet if
you're about to wipe them in the next step — that's expected to be the last
time they work.

Also check `/api/health` returns `{"status":"ok"}` — confirms the app can
reach the (now client-owned) database.

---

## 6. Wipe demo data, create the client's real login

**Do this once, after everyone's done testing/exploring with the demo
accounts.** It deletes every mock product, supplier, technician, MRF, stock
record, purchase order/request, activity log entry, notification, and every
demo user account (`owner` / `admin` / `warehouse` / `technician`, all on the
`demo1234` password) — and creates one new, real Owner account with a freshly
generated password. Company info (name/address/currency) is kept as-is.

This is the **only** step in this whole handover that touches a terminal —
run it from **your own machine** (already has Node/pnpm/this repo set up),
not the client's laptop. Point it at the (now client-owned, but still the
same) database via the env vars below; the client's laptop doesn't need
anything installed for this. Every account after this one is created by the
Owner clicking around in **Users → Add User** on the live website — no
terminal, no Prisma, ever again.

```bash
pnpm run reset-for-handover -- --yes --owner-username=<their-username> --owner-name="<Their Full Name>"
```

It prints the target database host first — **check it's the right one**
before it runs. It prints a generated password **once**, at the very end —
it isn't saved anywhere, so screenshot or write it down immediately. Log in
with it right there in the meeting, then change it immediately: **Profile →
Change Password**.

*(Skip this step entirely if you went the "fresh Neon project" fallback in
step 4 — that database is already empty. Run the same command anyway,
though — you still need it to create the first Owner login.)*

---

## 7. What the client can do from here

Once logged in as the new Owner:
- **Users** — create real accounts for the rest of the team (Admin,
  Warehouse Staff, Technician roles).
- **Products / Suppliers / Technicians** — start entering the real catalog.
- **Permissions** — the role/module access matrix; defaults are sane
  out of the box, only touch this if a role needs adjusting.
- **Settings** — company name/address/currency, already pre-filled.

---

## 8. Ongoing costs (client-billed, after transfer)

| Service | Plan | Cost |
|---|---|---|
| Vercel | Pro | Paid monthly — see vercel.com/pricing |
| Neon | Free tier | $0, up to 0.5GB storage — fine for a 10-person warehouse; upgrade if it's ever approached |
| Sentry *(if enabled)* | Free tier | $0 at this scale |
| Upstash *(if enabled)* | Free tier | $0 at this scale |

---

## 9. Where to look when something breaks

- **App error, no idea why**: Vercel dashboard → project → **Logs** tab
  (real-time function logs) or **Deployments** → pick one → **Functions**
  tab for a specific request's logs.
- **If Sentry was wired up** (`NEXT_PUBLIC_SENTRY_DSN` set): sentry.io →
  project → **Issues** — every server/client error lands here with a stack
  trace, searchable and alertable.
- **Is the app up at all**: hit `<production-url>/api/health` — `200` with
  `{"status":"ok"}` means the app and database are both reachable.
- **Database looks wrong**: Neon console → project → **Tables** (or SQL
  Editor) to inspect data directly.

---

## Path B — fresh setup from scratch (condensed)

If reusing the existing infra (Path A) isn't an option:

1. Client creates GitHub, Vercel, Neon accounts (section 1).
2. You push a copy of this repo to a **new** repo under the client's GitHub
   account (`git remote add client <new-repo-url> && git push client master`).
3. Client imports that repo into a new Vercel project, upgrades to Pro.
4. Client creates a new Neon project (Singapore region).
5. Set env vars in Vercel (**Settings → Environment Variables**) — see
   `.env.example` in the repo root for the full list and what each is for.
   At minimum: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (generate with
   `npx auth secret`). Sentry/Upstash vars are optional — leave blank to skip.
6. Run migrations against the new database:
   ```bash
   DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" pnpm prisma migrate deploy
   ```
7. Create the first Owner login (database is already empty, so this just
   creates the account — nothing to wipe):
   ```bash
   DATABASE_URL="<pooled url>" DIRECT_URL="<direct url>" pnpm run reset-for-handover -- --yes --owner-username=<their-username> --owner-name="<Their Full Name>"
   ```
8. Continue from section 7 above.

---

## Appendix — local dev environment (only if the client wants to run/build the app locally, not just use the hosted site)

Windows (PowerShell), using `winget`:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```

Then in a new terminal (so PATH picks up the installs):

```powershell
corepack enable
corepack prepare pnpm@latest --activate
git clone https://github.com/<client-username>/DrimInventorySystem.git
cd DrimInventorySystem
cp .env.example .env
# edit .env with real values (DATABASE_URL, DIRECT_URL, AUTH_SECRET — see .env.example)
pnpm install
pnpm run dev
```

Mac (Homebrew):

```bash
brew install node git
corepack enable
corepack prepare pnpm@latest --activate
git clone https://github.com/<client-username>/DrimInventorySystem.git
cd DrimInventorySystem
cp .env.example .env
# edit .env with real values
pnpm install
pnpm run dev
```

Opens at `http://localhost:3000`. This is only needed for local development
work (e.g. if the client hires someone to keep building on the app) — day to
day use of DRIM IMS is just the hosted Vercel URL, no local setup required.
