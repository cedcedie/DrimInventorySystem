# DRIM IMS — Handover Guide

Purpose: walk through moving the app from your (developer) accounts to the
client's own GitHub / Vercel / Neon accounts, so they own their hosting,
billing, and data going forward — and to reset the database from demo/mock
data to a clean production start with one real login.

**Code handoff method: clean export, no commit history.** The client gets a
zip of the current code with a single fresh commit — not your actual git
history (which may reference internal notes, iteration, things not meant for
them to see). This means GitHub and Vercel are both set up fresh under the
client's account rather than transferred — a transferred Vercel project would
still show every past commit message/SHA in its Deployments tab even if
GitHub itself were clean, so both have to be fresh together. Neon is still
reused as-is (a database has no "commit history" to worry about, and reusing
it means no live re-migration).

**You stay on as a collaborator.** This isn't a clean break — you're doing
this live, on their laptop, and you'll keep maintaining the app afterward. So
the client adds you as a **Collaborator** on their new GitHub repo (step 2a)
before the first push, rather than you walking away with no access. From
then on you push updates from your own machine, under your own GitHub
account, same as any normal repo you have write access to — no AnyDesk
needed for future changes, just this one session to get everything stood up.

---

## 0. Before the meeting

Confirm you (the developer) have:
- This repo checked out locally with `master` up to date
- Owner/Admin access on the current Neon project (still being reused)
- The current `.env` values on hand — `DATABASE_URL`, `DIRECT_URL`,
  `AUTH_SECRET` — you'll be pasting these into the client's new Vercel
  project's env vars in step 3, not retyping them from scratch.
- Your own GitHub username handy, to give the client when they add you as a
  collaborator (step 2a).

The current GitHub repo and Vercel project (under your account) are left
behind, untouched, once the client's fresh copies are live — nothing to
clean up there, keep or delete later as you like. What *doesn't* get left
behind is your access: you're staying on the new repo as a collaborator.

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

## 2. Package the code and push it fresh under the client's GitHub

**a. Client creates their GitHub account** (if they don't have one already),
and a new **empty** repository (no README/license — literally empty) —
e.g. `DrimInventorySystem`, visibility Private.

**b. Client adds you as a Collaborator, right away** — repo → **Settings**
→ **Collaborators and teams** → **Add people** → your GitHub username →
send invite. Accept it from your own GitHub account (check your email or
github.com/notifications — do this on your phone if you're deep in the
AnyDesk session). This is what gives you write access going forward, not
just for today's initial push.

**c. Do the actual export + push from your own machine, not theirs** —
you already have Node/git/this repo set up, no reason to install anything
new just to run a `git push`. (The Appendix below covers installing Node/git
on the client's laptop too, if you want them able to run the app locally
later — that's a separate, optional thing you can do in the same session,
not a requirement for this step.)

```bash
cd DrimInventorySystem
git archive -o ../drim-ims-handover.zip HEAD
```

`git archive` only includes files git actually tracks — `.gitignore`d stuff
(`.env`, `node_modules`, `.next`, etc.) is never in the zip, and there's no
`.git` folder in it at all, so no commit history travels with it.

*(Optional: if you don't want the client to see `HANDOVER.md` or
`scripts/reset-for-handover.ts` either — they're your internal notes, not
end-user docs — exclude them from the archive instead of deleting them from
your own copy:)*
```bash
git archive -o ../drim-ims-handover.zip HEAD -- . ':!HANDOVER.md' ':!scripts/reset-for-handover.ts'
```

Turn that zip into the client's first commit, on their new repo:

```bash
cd ..
mkdir drim-ims-fresh && cd drim-ims-fresh
unzip ../drim-ims-handover.zip
git init
git add -A
git commit -m "Initial commit"
git branch -M master
git remote add origin https://github.com/<client-username>/DrimInventorySystem.git
git push -u origin master
```

Since you accepted the collaborator invite in step b, this push authenticates
as **you** (your own GitHub login) — no need to borrow the client's session.
The repo now has exactly one commit, no trace of your development history,
and you have standing write access to keep pushing updates after today.

---

## 3. Set up the Vercel project

**Not a transfer** — a transferred Vercel project would still show every past
deployment's commit message/SHA in its Deployments tab, which defeats the
point of giving them a clean repo. Instead, the client makes a **new**
Vercel project pointed at their new (clean) repo:

1. Client logs into Vercel (sign up with GitHub in step 1 makes this one
   click) → **Add New** → **Project** → import
   `<client-username>/DrimInventorySystem` (the repo from step 2).
2. Before the first deploy, add the env vars — **Settings** →
   **Environment Variables** (or the import screen offers this directly):
   paste in `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (the values you
   brought from step 0 — same Neon database as before, so these are
   unchanged). Leave `R2_*`, Sentry, and Upstash vars blank for now — see
   `.env.example` in the repo for what each does if you want them later.
3. Deploy. First build takes a couple minutes.

**b. Upgrade to Pro** (needed for real production use — better uptime,
no execution timeouts on longer requests like PDF export):
Project/Account → **Settings** → **Billing** → upgrade to **Pro**. This is
where the client's card goes on file, before or after the first deploy.

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
