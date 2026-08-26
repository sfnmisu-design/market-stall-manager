// supabase/functions/keep-alive/index.ts
//
// This is a Supabase Edge Function that runs a lightweight query
// to keep your database active and prevent the free-tier pause.
//
// HOW IT WORKS:
// An external cron service (cron-job.org) calls this URL every 3 days.
// The function does a tiny SELECT query which counts as "activity"
// and resets Supabase's 7-day inactivity timer.
//
// DEPLOY COMMAND (run once from your terminal):
//   npx supabase functions deploy keep-alive --project-ref YOUR_PROJECT_REF
//
// YOUR_PROJECT_REF is the ID in your Supabase URL:
//   https://YOUR_PROJECT_REF.supabase.co

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase     = createClient(supabaseUrl, supabaseKey);

    // Lightweight ping — just count users (tiny query)
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const now = new Date().toISOString();
    console.log(`[keep-alive] ✅ ${now} — DB active, ${count} users`);

    return new Response(
      JSON.stringify({
        status:    'ok',
        message:   'Database keep-alive ping successful',
        timestamp: now,
        users:     count,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (err) {
    console.error('[keep-alive] ❌ Error:', err.message);
    return new Response(
      JSON.stringify({ status: 'error', message: err.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
