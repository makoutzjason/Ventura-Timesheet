# Setup

One-time steps to get this running. Do these in order.

## 1. Create the Supabase project

1. Go to https://supabase.com, sign in, and click **New project**.
2. Pick any name (e.g. "ventura-timesheet") and a strong database password —
   save that password somewhere, you likely won't need it again but it's
   annoying to lose.
3. Wait for the project to finish provisioning (a couple of minutes).
4. In the left sidebar: **Project Settings > API**. You'll need three values
   from this page in step 3 below: **Project URL**, the **anon public** key,
   and the **service_role** key (click "reveal" to see it).

## 2. Run the database schema

1. In the Supabase dashboard, open the **SQL Editor** (left sidebar).
2. Open `supabase/migrations/0001_init.sql` from this project, copy its
   entire contents, paste into the SQL Editor, and click **Run**.
3. This creates every table, security rule, and the private storage bucket
   for bypass-path photos in one shot. You can check **Table Editor** in the
   sidebar afterward to see the new tables.
4. As the app grows, more numbered files show up in `supabase/migrations/`
   (e.g. `0002_...sql`). Run each new one the same way, in order, the first
   time you see it — they're small, additive changes on top of this one.

## 3. Configure environment variables

1. Copy `.env.example` to a new file named `.env.local` in the project root.
2. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from step 1.4 above.
3. Leave the Resend and cron values blank for now if you don't have them yet
   — the app will still start, those features just won't send email until
   they're filled in.

## 4. Create your own admin account

There's no public sign-up page by design — travelers and admins are both
added by an admin. To create the *first* admin (you), before the admin panel
exists to do it for you:

1. In Supabase: **Authentication > Users > Add user**. Create a user with
   your email and a password.
2. Back in the **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin', full_name = 'Your Name'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. That row was created automatically by the `handle_new_user` trigger when
   you added the user in step 1 — this just promotes it from the default
   `traveler` role to `admin`.

## 5. Resend (email)

1. Sign up at https://resend.com and create an API key
   (**API Keys** in the sidebar) — put it in `RESEND_API_KEY`.
2. Add and verify a sending domain (**Domains** in the sidebar) — this
   requires adding a couple of DNS records at your domain registrar. Until
   this is verified, Resend can only send to your own account's email
   address, which is fine for testing but not for real facility managers.
3. Set `EMAIL_FROM` to an address on that verified domain, e.g.
   `"Ventura Timesheets <timesheets@yourdomain.com>"`.

## 6. Seed a test facility + traveler

The admin panel that would normally do this doesn't exist yet, so for now
it's done directly in the **SQL Editor**.

1. Create a test facility (adjust `week_start_day`: 0=Sunday, 1=Monday, ...
   6=Saturday — and set `manager_email` to an address you can actually check,
   since the submit flow will really email it):
   ```sql
   insert into public.facilities (name, manager_email, week_start_day, skip_manager_approval)
   values ('Test Facility', 'you@example.com', 0, false)
   returning id;
   ```
   Copy the returned `id` — you'll need it in step 3.
2. In **Authentication > Users > Add user**, create a second account for
   yourself to sign in as "the traveler" — it can't be the same account as
   your admin login from step 4 above. If you're on Gmail, an address like
   `you+traveler@gmail.com` works and still lands in your normal inbox.
3. Attach that user to the facility as a traveler (there's no auto-created
   row for this one, unlike `profiles` — an admin has to add it explicitly):
   ```sql
   insert into public.travelers (id, facility_id, employee_id, discipline)
   values (
     (select id from auth.users where email = 'you+traveler@gmail.com'),
     '<facility-id-from-step-1>',
     'T-001',
     'RN'
   );
   ```

## 7. Run it locally

```powershell
npm run dev
```

Then open http://localhost:3000 and sign in as the traveler account from step 6.

## 8. Deploying to Vercel (when ready)

1. Push this project to a GitHub repository (you'll need Git installed
   locally first — it wasn't detected on this machine).
2. In Vercel: **Add New > Project**, import that repo.
3. Add all the same environment variables from `.env.local` in the
   Vercel project's **Settings > Environment Variables**. Set
   `NEXT_PUBLIC_APP_URL` to your real deployed URL, and generate a random
   value for `CRON_SECRET`.
4. `vercel.json` already defines the reminder cron job — Vercel picks it up
   automatically on deploy, no extra configuration needed. It's meant to run
   **hourly** (`0 * * * *`), which the reminder logic requires to correctly
   evaluate "is it currently 8am/2pm/etc. in this facility's own time zone"
   for every facility, not just one global trigger time — see
   src/app/api/cron/reminders/route.ts. Hourly cron execution needs a Vercel
   **Pro** plan; the Hobby plan only allows a couple of fixed times a day.

   **Currently set to once daily instead** (`0 14 * * *`) so it can deploy
   on Hobby — this is a temporary, deliberately degraded state, not the
   intended cadence. With only one trigger a day, most of the scheduled
   reminder stages (see src/lib/reminder-schedule.ts) simply won't fire;
   only whichever single stage happens to coincide with that one daily UTC
   hour does. Once you upgrade to Pro, change `vercel.json`'s schedule back
   to `"0 * * * *"` and redeploy — see the comment at the top of
   src/app/api/cron/reminders/route.ts for the full picture.
