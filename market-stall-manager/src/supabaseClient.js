import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey  = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '⚠️  Supabase credentials missing.\n' +
    'Copy .env.example → .env and fill in your project URL and anon key.\n' +
    'Get them from: https://supabase.com → Your Project → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});
