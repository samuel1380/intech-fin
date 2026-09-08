import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(url && key);
// A real typed client avoids an incomplete mock that crashes during auth initialization.
// App renders a configuration screen before performing any request when configuration is absent.
export const supabase = createClient(
  url || 'http://127.0.0.1:54321',
  key || 'unconfigured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
export async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured)
    throw new Error('Configure a conexão com o Supabase.');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sessão expirada. Entre novamente.');
  return data.user.id;
}
