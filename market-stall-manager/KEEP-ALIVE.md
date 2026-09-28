# Keep-Alive Setup — Prevent Supabase Free Tier Pausing
# ═══════════════════════════════════════════════════════

Supabase pauses your free database after 7 days of no activity.
This guide sets up two layers of protection so it NEVER pauses.

Layer 1 → App self-ping   (already built into App.js — no setup needed)
Layer 2 → External cron   (5-minute setup below — the important one)

The app self-ping only works when someone has the app open.
The external cron fires every 3 days regardless — this is your safety net.

───────────────────────────────────────────────────────
METHOD A — cron-job.org (FREE, recommended, 5 minutes)
───────────────────────────────────────────────────────

This is the simplest option. An external service calls your Supabase
REST API every 3 days, which counts as "activity" and resets the timer.

1. Go to https://cron-job.org and create a free account

2. Click "CREATE CRONJOB"

3. Fill in the form:
   Title:    Market Stall Manager Keep-Alive
   URL:      https://YOUR_PROJECT_REF.supabase.co/rest/v1/counters?select=key&limit=1
   
   ⚠️  Replace YOUR_PROJECT_REF with your actual project ID
       (found in your Supabase project URL)

4. Add Request Headers (click "Show advanced settings"):
   Header 1:
     Name:  apikey
     Value: YOUR_SUPABASE_ANON_KEY
   
   Header 2:
     Name:  Authorization
     Value: Bearer YOUR_SUPABASE_ANON_KEY
   
   ⚠️  Replace YOUR_SUPABASE_ANON_KEY with your anon key from
       Supabase → Settings → API → Project API Keys → anon/public

5. Set Schedule:
   - Click "Custom" schedule
   - Set to run every 3 days (or every day if you want extra safety)
   - Cron expression for every 3 days at 9am UTC: 0 9 */3 * *

6. Click "CREATE" — done!

7. Test it: click "Run now" and check the response is 200 OK.

You'll get email alerts if the ping ever fails.

───────────────────────────────────────────────────────
METHOD B — Supabase Edge Function (more advanced)
───────────────────────────────────────────────────────

The file supabase/functions/keep-alive/index.ts is already written.
Deploy it to Supabase and then call it from cron-job.org.

Prerequisites:
  - Node.js installed
  - Supabase CLI: npm install -g supabase

Steps:

1. Login to Supabase CLI:
   npx supabase login

2. Link your project:
   npx supabase link --project-ref YOUR_PROJECT_REF

3. Deploy the function:
   npx supabase functions deploy keep-alive

4. Your function URL will be:
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/keep-alive

5. Set up cron-job.org to call this URL every 3 days
   (No headers needed — the function handles auth internally)

───────────────────────────────────────────────────────
METHOD C — GitHub Actions (if you use GitHub, free)
───────────────────────────────────────────────────────

Create this file in your repo: .github/workflows/keep-alive.yml

```yaml
name: Supabase Keep-Alive

on:
  schedule:
    - cron: '0 9 */3 * *'   # Every 3 days at 9am UTC
  workflow_dispatch:          # Manual trigger from GitHub UI

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            "${{ secrets.SUPABASE_URL }}/rest/v1/counters?select=key&limit=1")
          echo "Response: $STATUS"
          if [ "$STATUS" != "200" ]; then exit 1; fi
```

Then in GitHub → your repo → Settings → Secrets → Actions, add:
  SUPABASE_URL      = https://YOUR_PROJECT_REF.supabase.co
  SUPABASE_ANON_KEY = your anon key

This is 100% free with GitHub and very reliable.

───────────────────────────────────────────────────────
VERIFICATION — How to confirm it's working
───────────────────────────────────────────────────────

After setting up any method above:

1. Go to Supabase Dashboard → your project
2. Click Settings → General
3. Look for "Project Status" — should show "Active"
4. Check your cron-job.org dashboard for job history

You can also check Supabase → Logs → API to see the ping requests coming in.

───────────────────────────────────────────────────────
WHAT HAPPENS IF IT DOES PAUSE
───────────────────────────────────────────────────────

If it pauses (you'll know because the app shows "Connecting to database…"
and never loads):

1. Go to https://supabase.com → your project
2. Click the "Restore project" or "Resume" button
3. Wait 1-2 minutes
4. Refresh your app — it will work again

All your data is preserved. Pausing does NOT delete anything.

───────────────────────────────────────────────────────
LONG-TERM RECOMMENDATION
───────────────────────────────────────────────────────

Free tier is great for testing. Once you're using this daily for your market:

  Upgrade Supabase to Pro: $25/month
  ✓ No pausing ever
  ✓ Daily automatic backups
  ✓ 8GB database (vs 500MB free)
  ✓ Priority support

Keep Netlify on the free tier — it's more than enough for this app.

Total cost: $25/month for a fully professional, reliable system.
