import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verifica se as chaves existem no ambiente (Render/Local)
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => ({
            select: async () => ({ data: [], error: { message: "SUPABASE NÃO CONFIGURADO: Verifique o painel do Render." } }),
            insert: async () => ({ data: [], error: { message: "SUPABASE NÃO CONFIGURADO: Verifique o painel do Render." } }),
            update: async () => ({ data: [], error: { message: "SUPABASE NÃO CONFIGURADO: Verifique o painel do Render." } }),
            delete: async () => ({ data: [], error: { message: "SUPABASE NÃO CONFIGURADO: Verifique o painel do Render." } }),
            upsert: async () => ({ data: [], error: { message: "SUPABASE NÃO CONFIGURADO: Verifique o painel do Render." } }),
        }),
    } as any;
