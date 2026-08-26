# Deploy on Render + GitHub
# Market Stall Manager — Complete Step-by-Step Guide
# ════════════════════════════════════════════════════════

## What you'll end up with
- Live URL:  https://market-stall-manager.onrender.com
- Every time you push code to GitHub → Render auto-deploys
- GitHub Actions pings Supabase every 3 days → database never pauses
- Free SSL certificate (HTTPS) included
- Total cost: $0

────────────────────────────────────────────────────────
PREREQUISITES — Install these first (one time only)
────────────────────────────────────────────────────────

1. Node.js (if not installed)
   → https://nodejs.org  →  download "LTS" version  →  install

2. Git (if not installed)
   → https://git-scm.com/downloads  →  install
   → Open a terminal and run:  git --version   (should show a version number)

3. A GitHub account (free)
   → https://github.com  →  Sign up

4. A Render account (free)
   → https://render.com  →  Sign up with GitHub (easiest)

────────────────────────────────────────────────────────
STEP 1 — Set up Supabase database (10 min)
────────────────────────────────────────────────────────

If you've already done this, skip to Step 2.

1. Go to https://supabase.com → Start your project → Sign up free

2. Click "New Project"
   - Name:     market-stall-manager
   - Password: pick a strong one and save it somewhere
   - Region:   US East (N. Virginia) — closest to Guyana
   - Click "Create new project" — takes about 2 minutes

3. Go to SQL Editor (left sidebar)  →  New Query
   - Open the file: supabase-schema.sql (from this folder)
   - Copy ALL of its contents
   - Paste into the SQL editor
   - Click RUN (green button)
   - You should see "Success. No rows returned"

4. Get your API keys:
   - Left sidebar → Settings → API
   - Copy "Project URL"  →  looks like: https://abcdefgh.supabase.co
   - Copy "anon / public" key under "Project API Keys"
   - Save both — you'll need them in Steps 2 and 3

────────────────────────────────────────────────────────
STEP 2 — Push your code to GitHub (5 min)
────────────────────────────────────────────────────────

1. Open a terminal (Command Prompt on Windows, Terminal on Mac/Linux)

2. Navigate to your project folder:
   cd path/to/market-stall-manager

   Windows example:   cd C:\Users\YourName\Downloads\market-stall-manager
   Mac/Linux example: cd ~/Downloads/market-stall-manager

3. Set up git and create your first commit:
   git init
   git add .
   git commit -m "Initial commit — Market Stall Manager"

4. Create a new repo on GitHub:
   - Go to https://github.com/new
   - Repository name:  market-stall-manager
   - Keep it Public or Private (both work)
   - Do NOT tick "Add README" or any other checkbox
   - Click "Create repository"

5. GitHub shows you commands. Run these two (copy from your GitHub page):
   git remote add origin https://github.com/YOUR_USERNAME/market-stall-manager.git
   git push -u origin main

   (Replace YOUR_USERNAME with your actual GitHub username)

6. Refresh your GitHub page — you should see all your files there. ✅

────────────────────────────────────────────────────────
STEP 3 — Add GitHub Secrets (2 min)
────────────────────────────────────────────────────────

GitHub Secrets store your API keys safely — they're never visible in your code.

1. On your GitHub repo page, click Settings (top tabs)

2. Left sidebar → Security → Secrets and variables → Actions

3. Click "New repository secret" and add these one at a time:

   Secret 1:
   Name:   SUPABASE_URL
   Value:  https://your-project-id.supabase.co    ← your actual URL from Step 1

   Secret 2:
   Name:   SUPABASE_ANON_KEY
   Value:  your-anon-key-here                      ← your actual key from Step 1

4. Click "Add secret" after each one.

The keep-alive.yml workflow will use these automatically.

────────────────────────────────────────────────────────
STEP 4 — Deploy on Render (5 min)
────────────────────────────────────────────────────────

1. Go to https://render.com and sign in (use "Sign in with GitHub" — easiest)

2. Click "New +"  →  "Static Site"

3. Connect your GitHub repo:
   - Click "Connect account" if first time
   - Find and select "market-stall-manager"
   - Click "Connect"

4. Fill in the build settings:
   Name:               market-stall-manager
   Branch:             main
   Build Command:      npm install && npm run build
   Publish Directory:  build

5. Add Environment Variables (click "Advanced" to find this section):
   Click "Add Environment Variable" for each:

   Key:   REACT_APP_SUPABASE_URL
   Value: https://your-project-id.supabase.co

   Key:   REACT_APP_SUPABASE_ANON_KEY
   Value: your-anon-key-here

6. Click "Create Static Site"

7. Render starts building — watch the build log (takes 2-3 minutes)
   You'll see lines like:
   → Installing dependencies...
   → Creating an optimized production build...
   → Build successful!

8. Your live URL appears at the top:
   https://market-stall-manager.onrender.com

   Open it in your browser and log in! 🎉

────────────────────────────────────────────────────────
STEP 5 — Add Render Deploy Hook to GitHub (2 min)
────────────────────────────────────────────────────────

This makes GitHub automatically trigger a new deploy when you push changes.

1. In your Render dashboard → your site → Settings
2. Scroll down to "Deploy Hook"
3. Click "Generate Deploy Hook" — copy the URL (looks like https://api.render.com/deploy/srv-xxxx?key=yyyy)

4. Go back to GitHub → your repo → Settings → Secrets → Actions
5. Add a new secret:
   Name:   RENDER_DEPLOY_HOOK_URL
   Value:  paste the deploy hook URL

Now whenever you push to GitHub, the .github/workflows/deploy.yml workflow
will automatically tell Render to deploy the latest version.

────────────────────────────────────────────────────────
STEP 6 — Verify Keep-Alive is Working (1 min)
────────────────────────────────────────────────────────

1. Go to your GitHub repo → Actions tab (top menu)

2. You should see two workflows:
   - "Deploy to Render"      — runs on every push
   - "Supabase Keep-Alive"   — runs every 3 days

3. Click "Supabase Keep-Alive" → "Run workflow" → "Run workflow"
   This runs it manually right now to test.

4. Click the running workflow to watch it:
   You should see: ✅ Supabase is active and responding

If it shows ✅ — your keep-alive is set up correctly! GitHub will now
automatically ping Supabase every 3 days forever.

────────────────────────────────────────────────────────
STEP 7 — Custom Domain (optional, ~$10/year)
────────────────────────────────────────────────────────

To use a domain like https://marketmanager.yourbusiness.com:

1. Buy a domain from:
   - Namecheap.com (cheapest, ~$8-10/year)
   - Google Domains (~$12/year)
   - GoDaddy (~$12/year)

2. In Render: Dashboard → your site → Settings → Custom Domain
3. Click "Add Custom Domain" → enter your domain
4. Render gives you DNS records to add
5. Log into your domain registrar → DNS settings → add the records
6. Wait 10-30 minutes for DNS to propagate
7. Render automatically provisions a free SSL certificate

────────────────────────────────────────────────────────
HOW AUTO-DEPLOY WORKS (after setup)
────────────────────────────────────────────────────────

Once everything is set up, your workflow is:

1. Make changes to your code on your computer
2. Run these 3 commands in terminal:
   git add .
   git commit -m "describe what you changed"
   git push

3. GitHub receives the push
4. GitHub Actions triggers the deploy hook
5. Render pulls the latest code and rebuilds automatically
6. ~2-3 minutes later, your live site is updated

That's it. No manual uploading, no FTP, no dragging files anywhere.

────────────────────────────────────────────────────────
TROUBLESHOOTING
────────────────────────────────────────────────────────

App shows blank white page
→ Check Render build log for errors
→ Make sure environment variables are set in Render dashboard
→ Check browser console (F12) for JavaScript errors

"Failed to connect to database"
→ Check REACT_APP_SUPABASE_URL is correct (no trailing slash)
→ Check REACT_APP_SUPABASE_ANON_KEY is the "anon" key, not "service_role"
→ Go to Supabase dashboard — check project is not paused

Keep-alive workflow fails
→ Check GitHub Secrets are set correctly
→ Run it manually from Actions tab to see the error message
→ Make sure SUPABASE_URL doesn't have a trailing slash

Render build fails
→ Check that package.json is in the ROOT folder (not inside src/)
→ Make sure node_modules is in .gitignore (it should be)
→ Check build command is exactly: npm install && npm run build

Push rejected / permission error
→ Run: git config --global user.email "you@email.com"
→ Run: git config --global user.name "Your Name"
→ Then try git push again

────────────────────────────────────────────────────────
FILE SUMMARY — What each file does
────────────────────────────────────────────────────────

market-stall-manager/
├── .github/
│   └── workflows/
│       ├── deploy.yml       ← Auto-deploys to Render on git push
│       └── keep-alive.yml   ← Pings Supabase every 3 days
├── public/
│   ├── index.html           ← HTML shell
│   ├── manifest.json        ← Makes app installable on phones
│   └── _redirects           ← Routing (for Netlify if you switch)
├── src/
│   ├── App.js               ← Complete React application
│   ├── index.js             ← React entry point
│   └── supabaseClient.js    ← Database connection
├── supabase/
│   └── functions/
│       └── keep-alive/
│           └── index.ts     ← Optional Supabase Edge Function
├── .env.example             ← Template for your .env file
├── .gitignore               ← Files Git should NOT track
├── package.json             ← App dependencies
├── render.yaml              ← Render configuration
├── supabase-schema.sql      ← Database setup (run once in Supabase)
├── DEPLOY.md                ← Original Netlify deploy guide
├── KEEP-ALIVE.md            ← Keep-alive options explained
└── RENDER-GITHUB.md         ← This file

────────────────────────────────────────────────────────
QUICK REFERENCE — Useful links
────────────────────────────────────────────────────────

Your GitHub repo:      https://github.com/YOUR_USERNAME/market-stall-manager
Your live app:         https://market-stall-manager.onrender.com
Render dashboard:      https://dashboard.render.com
Supabase dashboard:    https://supabase.com/dashboard
GitHub Actions:        https://github.com/YOUR_USERNAME/market-stall-manager/actions

Built with React + Supabase + Render + GitHub Actions
SFN TechGeek · Market Stall Manager v3.0.0
