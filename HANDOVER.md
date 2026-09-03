# DRIM IMS — Handover Guide

Follow these parts in order. Each one says **Who / Where** — that's whose
laptop the steps happen on. A short **What this does** note follows each
part, for context — you don't need to understand it to complete the step.

There are only two things that ever get typed on the client's laptop
(Part 8's login, and nothing else technical) — everything else with a
terminal happens on **your** laptop.

---

## Part 1 — Create accounts

**Who / Where: Client, their laptop, their browser.**

1. Go to **github.com/join** → create an account.
2. Go to **vercel.com/signup** → click **Continue with GitHub** → use the
   account from step 1.
3. Go to **neon.tech** → create an account (any sign-in method).

> **What this does:** These are the 3 outside companies the app runs on —
> GitHub stores the code, Vercel hosts the live website, Neon holds the
> database. The client needs their own account with each so they own (and
> pay for) their own hosting going forward, instead of it staying on yours.

---

## Part 2 — Create an empty GitHub repo

**Who / Where: Client, their laptop, github.com.**

1. Top-right **+** → **New repository**.
2. Name it `DrimInventorySystem`. Set **Private**. Leave every
   "Add a README / .gitignore / license" box **unchecked** — must be
   completely empty.
3. **Create repository**.

> **What this does:** Makes an empty container on the client's own account
> for the code to go into. It has to start empty because you're about to
> push a clean copy into it — not the same repo you've been working in.

---

## Part 3 — Add you as a collaborator

**Who / Where: Client, their laptop, on the new repo's page.**

1. **Settings** tab → **Collaborators and teams** (left sidebar) →
   **Add people**.
2. Type your GitHub username → select it → **Add**.
3. **You** accept the invite from your own GitHub account/email (check your
   phone if you're mid-AnyDesk-session).

> **What this does:** Gives you permanent write access to the client's new
> repo, so you can keep pushing updates after today — without this, you'd
> lose all access the moment the handover's done.

---

## Part 4 — Push the code (no history)

**Who / Where: You, your own laptop, your own terminal.**

```bash
cd "C:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
git archive -o ../drim-ims-handover.zip HEAD -- . ':!HANDOVER.md' ':!scripts/reset-for-handover.ts'
cd ..
mkdir drim-ims-fresh
```

Extract `drim-ims-handover.zip` into that new `drim-ims-fresh` folder
(right-click the zip → **Extract All** → pick that folder). Then:

```bash
cd drim-ims-fresh
git init
git add -A
git commit -m "Initial commit"
git branch -M master
git remote add origin https://github.com/<CLIENT_USERNAME>/DrimInventorySystem.git
git push -u origin master
```

*(Swap in their actual GitHub username first.)* If prompted to log in, log
in as **yourself** — you're a collaborator from Part 3.

> **What this does:** `git archive` zips up just the current files — no
> `.git` folder, so no commit history comes along. Pushing that into the
> client's empty repo creates it fresh, with exactly one commit. Nothing
> from your development history (past commit messages, notes, iteration) is
> visible to them.

---

## Part 5 — Deploy on Vercel

**Who / Where: Client, their laptop, vercel.com (you read out the values).**

1. **Add New** → **Project** → find `DrimInventorySystem` → **Import**.
2. On that same screen, open **Environment Variables** and add exactly
   these 3 (name on the left, value on the right):

   | Name | Where the value comes from |
   |---|---|
   | `DATABASE_URL` | Copy from **your** `.env` file (open it in a text editor on your laptop) — the line after `DATABASE_URL=`, no quotes |
   | `DIRECT_URL` | Same, from your `.env`'s `DIRECT_URL=` line |
   | `AUTH_SECRET` | Generate a fresh one — on your terminal run: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — paste what it prints |

   Leave everything else blank (`R2_*`, Sentry, Upstash — not needed today).
3. **Deploy**. Takes ~2 minutes.
4. Click **Visit** when done — login page should load. Don't log in yet.

> **What this does:** Builds and hosts the live website under the client's
> own Vercel account. The 3 env vars are how it connects to the (still
> shared) database — `DATABASE_URL`/`DIRECT_URL` point at the same Neon
> database you've been testing on; `AUTH_SECRET` is fresh rather than reused,
> for a clean break from your own deployment.

---

## Part 6 — Upgrade to Vercel Pro

**Who / Where: Client, their laptop, vercel.com.**

1. **Settings** → **Billing** → **Upgrade to Pro**.
2. Client enters their own card, confirms.

*(Can happen before or after Part 5 — order doesn't matter.)*

> **What this does:** Pro removes the execution-time limits Hobby has,
> which this app needs for slower requests (e.g. generating PDF reports).
> This is also where ongoing hosting cost gets billed to the client, not you.

---

## Part 7 — Hand over the database

**Who / Where: You, your own laptop, neon.tech (logged in as yourself).**

1. Open the project → **Settings** → look for **Transfer** (exact wording
   may vary — Neon's UI changes).
2. Enter the client's Neon account/email from Part 1. They accept on their
   side.

> **What this does:** Moves ownership/billing of the database to the client
> without changing anything about it — same host, same data, same
> `DATABASE_URL`/`DIRECT_URL` you already pasted in Part 5. Nothing to
> reconfigure after this.

---

## Part 8 — Wipe test data, create the real login

**Who / Where: You, your own laptop, your own terminal.**

```bash
cd "C:\Users\cedri\OneDrive\Documents\GitHub\DrimInventorySystem"
pnpm run reset-for-handover -- --yes --owner-username=<PICK_A_USERNAME> --owner-name="<CLIENT'S FULL NAME>"
```

*(Ask the client what username/name they want first, then fill those in.)*

It prints the target database host first — check it's the right one. Then
prints a password **once**, at the very end — write it down or screenshot
it immediately, it's shown nowhere else.

> **What this does:** Deletes every demo product, supplier, MRF, stock
> record, activity log entry, and demo user account (`owner`/`admin`/etc.,
> all on the `demo1234` password) — replacing them with one real, working
> Owner login. Company info (name/address) is kept, not wiped.

---

## Part 9 — Client logs in

**Who / Where: Client, their laptop, the live Vercel URL from Part 5.**

1. Log in with the username + password from Part 8.
2. **Profile → Change Password** — set a real password immediately.

> **What this does:** From here on, everything else — adding team members,
> entering the real product catalog, adjusting permissions — happens by
> clicking around inside the app itself. No terminal, no GitHub, no Vercel
> dashboard needed for any of that.

---

## Part 10 — Custom domain (optional, if the client has one via Namecheap)

**Who / Where: Client, their laptop — Vercel first, then Namecheap.**

1. Vercel → the project → **Settings** → **Domains** → type the domain
   (e.g. `driminventory.com`) → **Add**.
2. Vercel displays the exact DNS record(s) needed — usually either its own
   nameservers to point the whole domain at, or a specific A/CNAME record.
   **Use whatever Vercel shows on screen at the time** — don't guess values.
3. In Namecheap → **Domain List** → **Manage** → **Advanced DNS** → add
   whichever record(s) Vercel gave you.
4. Wait for it to go green in Vercel's Domains screen (minutes to a few
   hours) — HTTPS is issued automatically once it does, no extra step.

> **What this does:** Makes the app reachable at the client's own domain
> instead of the default `<project>.vercel.app` address. Entirely optional
> and can be done anytime after Part 5 — doesn't affect anything else in
> this guide.

---

## After today — where you keep developing from

Your original folder (this one, full history) stays exactly as it is —
nothing about today touches it. But for **this client's project** going
forward, your working folder becomes `drim-ims-fresh` from Part 4 (already
pointed at their repo with `origin`) — not this one. Make future changes
there, `git add` / `git commit` / `git push` normally; it just keeps building
fresh history from that one clean commit onward.

Don't try to push from *this* folder to their repo later — the histories
don't match, so git will refuse it, or if forced, will dump your entire old
history into their repo, which is exactly what today avoided.

---

## Reference

**Ongoing costs, client-billed:**

| Service | Plan | Cost |
|---|---|---|
| Vercel | Pro | Paid monthly — vercel.com/pricing |
| Neon | Free tier | $0, up to 0.5GB — fine for a 10-person warehouse |
| Sentry / Upstash | Free tier, if ever enabled | $0 at this scale |

**When something breaks later:**
- App error: Vercel dashboard → project → **Logs**, or **Deployments** →
  pick one → **Functions** tab.
- Is it up at all: visit `<production-url>/api/health` — `200` with
  `{"status":"ok"}` means app + database are both reachable.
- Database looks wrong: Neon console → project → **Tables** / SQL Editor.

**Local dev setup** (only if the client — or whoever maintains this later —
wants to run the app on their own machine, not just use the hosted site):

```powershell
# Windows
winget install OpenJS.NodeJS.LTS
winget install Git.Git
# new terminal, then:
corepack enable
corepack prepare pnpm@latest --activate
git clone https://github.com/<client-username>/DrimInventorySystem.git
cd DrimInventorySystem
cp .env.example .env
# edit .env with real values (DATABASE_URL, DIRECT_URL, AUTH_SECRET)
pnpm install
pnpm run dev
```

Opens at `http://localhost:3000`. Not needed for day-to-day use of the app.
