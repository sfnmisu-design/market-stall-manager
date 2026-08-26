# Market Stall Manager — Deployment Guide
# From zero to live on the internet in ~20 minutes

## What You'll Get
- A live URL like: https://your-market.netlify.app
- Accessible from any phone, PC, or tablet anywhere in the world
- Real-time sync — all users see live updates instantly
- Free hosting (Netlify) + Free database (Supabase)

---

## STEP 1 — Create Your Supabase Database (10 min)

1. Go to https://supabase.com and click **Start your project**
2. Sign up with GitHub or email (free)
3. Click **New Project**
   - Name: `market-stall-manager`
   - Database password: choose a strong password (save it!)
   - Region: choose closest to Guyana (US East or South America)
   - Click **Create new project** (takes ~2 minutes to provision)

4. Once ready, go to **SQL Editor** (left sidebar, looks like `</>`)
5. Click **New Query**
6. Open the file `supabase-schema.sql` from this folder
7. Copy ALL of its contents and paste into the SQL editor
8. Click the green **RUN** button
9. You should see "Success" — your database tables and seed data are created!

10. Get your API keys:
    - Go to **Settings** → **API** (left sidebar)
    - Copy **Project URL** (looks like `https://xxxxx.supabase.co`)
    - Copy **Project API Keys → anon / public** key

---

## STEP 2 — Set Up Your Environment File (2 min)

1. In the `market-stall-manager` folder, find `.env.example`
2. Make a copy and name it exactly `.env` (no .example)
3. Open `.env` and replace the placeholder values:

```
REACT_APP_SUPABASE_URL=https://your-project-id.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-public-key-here
```

Replace `your-project-id` and `your-anon-public-key-here` with the values from Step 1.

---

## STEP 3 — Install and Test Locally (5 min)

Make sure you have Node.js installed (https://nodejs.org — download LTS version).

Open a terminal / command prompt in the `market-stall-manager` folder:

```bash
# Install dependencies
npm install

# Start the local development server
npm start
```

Your browser should open at http://localhost:3000
- Log in with: admin@market.com / admin123
- Try creating a booking — it should save to Supabase!
- Open another browser window and log in as manager — you'll see the same data.

If it works, you're ready to deploy!

---

## STEP 4 — Deploy to Netlify (5 min)

### Option A — Drag and Drop (easiest, no account needed initially)

1. Build the production files:
```bash
npm run build
```
This creates a `build/` folder with your production app.

2. Go to https://netlify.com → sign up free
3. From your Netlify dashboard, find the **"drag and drop"** zone
4. Drag your `build/` folder into it
5. Netlify gives you a URL like `https://random-name.netlify.app` — LIVE!

### Option B — GitHub + Auto-deploy (recommended for updates)

1. Push your project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/market-stall-manager.git
git push -u origin main
```

2. Go to https://netlify.com → **Add new site** → **Import from Git**
3. Choose GitHub → select your repo
4. Build settings (auto-detected):
   - Build command: `npm run build`
   - Publish directory: `build`
5. Click **Add environment variables**:
   - `REACT_APP_SUPABASE_URL` = your Supabase URL
   - `REACT_APP_SUPABASE_ANON_KEY` = your anon key
6. Click **Deploy site**

⚠️ IMPORTANT: With Option A, your .env file is already baked into the build.
With Option B, you must add the env vars in Netlify's dashboard (Step 5 in the UI).

---

## STEP 5 — Get a Custom Domain (optional, ~$10/year)

1. Buy a domain from Namecheap, GoDaddy, or Google Domains
2. In Netlify: **Domain Settings** → **Add custom domain**
3. Follow the DNS instructions — done in ~24 hours

---

## Demo Accounts (pre-seeded in the database)

| Email                   | Password    | Role          |
|-------------------------|-------------|---------------|
| admin@market.com        | admin123    | Administrator |
| manager@market.com      | manager123  | Manager       |
| cashier@market.com      | cashier123  | Cashier       |

Change passwords from the Users tab after first login!

---

## Real-Time Sync

The app uses Supabase Realtime subscriptions — when one user makes a booking,
ALL other users logged in at the same time see it update instantly without
refreshing. No polling needed.

---

## Security Note

This app stores passwords as plain text in the database for simplicity.
For a production deployment handling sensitive data, you should:
1. Use bcrypt to hash passwords (npm install bcryptjs)
2. Use Supabase Auth instead of the custom users table
3. Tighten the Row Level Security policies in Supabase

---

## Folder Structure

```
market-stall-manager/
├── public/
│   ├── index.html          ← HTML shell
│   ├── manifest.json       ← PWA manifest (install on phone)
│   └── _redirects          ← Netlify SPA routing
├── src/
│   ├── App.js              ← Main application (all components)
│   ├── index.js            ← React entry point
│   └── supabaseClient.js   ← Database connection
├── supabase-schema.sql     ← Run this in Supabase SQL Editor
├── .env.example            ← Copy to .env and fill in keys
├── package.json            ← Dependencies
└── DEPLOY.md               ← This file
```

---

## Troubleshooting

**White screen / app won't load**
- Check browser console (F12) for errors
- Make sure .env has the correct Supabase URL and key
- Make sure you ran the SQL schema in Supabase

**"Failed to connect"**
- Check your Supabase project is not paused (free tier pauses after 1 week inactive)
- Go to Supabase dashboard and click Resume

**Real-time not working**
- Make sure you ran the full schema SQL including the REALTIME section at the bottom
- Check Supabase → Database → Replication → Supabase Realtime is enabled for your tables

**Booking saves but stall still shows available**
- This is a real-time subscription issue — refresh the page
- Make sure realtime is enabled in Supabase

---

Built with React + Supabase + Netlify
SFN TechGeek · Market Stall Manager v3.0.0
