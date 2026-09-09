// supabase/functions/send-push/index.ts
// Supabase Edge Function (Deno) para disparo de notificações push em segundo plano
// Pode ser acionada via pg_cron, Webhook ou chamada REST autenticada

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "BAodVudiIhUOYKSHtxtt__f2gT5bVb3N3ITLNwgGAnSTMo4zxmUWnJPbmmfhm8La4QPiJCP2VSF46kKaLFN8Ago";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "zbz-l7HOEc-psjSYa6NGA5viNC7C9COffSsPTXT922A";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: prefData, error: prefError } = await supabase
      .from('notification_preferences')
      .select('preferences, push_subscription')
      .eq('user_id', 'intechfin_default')
      .maybeSingle();

    if (prefError || !prefData?.push_subscription) {
      return new Response(JSON.stringify({ message: "Nenhuma inscrição push encontrada." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ status: "ok", message: "Push worker pronto." }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
