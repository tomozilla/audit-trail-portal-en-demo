# audit-trail-portal-en-demo

A small learning demo: **one login per person** and an **activity log that nobody can edit from the app**. A tiny support-request portal (Supabase Auth + RLS + database triggers) shows that a shared login erases "who did it", and that a log written by the database cannot be rewritten, deleted or forged by the people it records.

> **A personal learning project.** Not an official sample of any company and not a model for production. The policies are deliberately broad (any signed-in user can change any request). All users and emails are fictional (`example.com`).

This is the code for the Dev.to article (shared vs personal logins, the log, tamper tests and the portal): TODO-DEVTO-URL

## Files

| File | What it is |
|---|---|
| `sql/01_requests_and_log.sql` | Tables `support_requests` and `activity_log`, RLS, two triggers (stamp who/when, write the log), revoked write access on the log |
| `sql/90_show_log.sql` | Reads the log |
| `sql/99_cleanup.sql` | Drops the tables and functions |
| `scripts/drill.py` | Plays out shared-login and personal-login cases, then tamper attempts, using only the publishable key. Prints status codes only |
| `app/` | The portal page (`index.html`, `app.js`), `activity.js` (pure logic), `test.js` (13 checks), `config.example.js` |

## Cost

- Free project, 3 demo users: $0. Per the pricing page (2026-10-27) monthly active users: 50,000 included on Free, 100,000 on Pro, then $0.00325 per user. The log grows without limit: plan retention and clean-up.
- supabase-js is loaded from a CDN, version pinned to 2.118.0.

## Run

```bash
# 1. SQL editor: run sql/01_requests_and_log.sql
# 2. Authentication -> Users -> Add user -> Create new user (Auto confirm): shared-desk@example.com, staff-sato@example.com, staff-tanaka@example.com (choose your own passwords)
# 3. The drill (values stay in your shell, never in the repo):
SUPABASE_URL=https://<PROJECT_REF>.supabase.co SUPABASE_PUBLISHABLE_KEY=<publishable key> \
PW_SHARED=... PW_SATO=... PW_TANAKA=... python3 scripts/drill.py
# 4. The page:
cd app && cp config.example.js config.js   # fill in the URL and publishable key (config.js is git-ignored)
python3 -m http.server 8000                # open http://localhost:8000/
node test.js
```

## Security notes (read these)

- **Use only the publishable key** in the browser and in `drill.py`. Never put a secret / service_role key in `config.js` or the shell history.
- **Do not paste the error hint blindly.** When the log rejects an edit, the API replies with a hint to `GRANT UPDATE ... TO authenticated`. Doing that would remove the protection.
- The trigger functions use `security definer` with an empty `search_path`, and execute rights are revoked from API roles.
- Broad policies are a demo shortcut. Restrict who can change what before real use.
- The service_role key bypasses RLS: not tested here.

## What was verified (2026-10-27) and what was not

- Verified on a Free project: the drill output (shared login hides who; personal logins show who; `updated_by` forgery overwritten; log update, delete and forge refused with 403; signed-out read returns 0 rows and insert returns 401); the page in a clean copy (sign-in, wrong password, adding a request, shared-account warning); `node test.js`.
- Not verified: service_role behavior, platform (organization) audit logs, Auth log contents, anonymous sign-ins, MFA, many users, phone-width layout.

## Cleanup

Run `sql/99_cleanup.sql`, delete the demo users, stop the local server.

## License

MIT (see `LICENSE`).
