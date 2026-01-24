import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Variáveis de ambiente podem estar ausentes no build/preview ou se não configuradas no Render
// Para evitar CRASH (Tela Branca), retornamos um cliente mockado que retorna erros amigáveis.
const isConfigured = supabaseUrl && supabaseAnonKey;

export const supabase = isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : {
        from: () => ({
            select: async () => ({ data: [], error: { message: "ERRO DE CONFIGURAÇÃO: VITE_SUPABASE_URL não definido no Render." } }),
            insert: async () => ({ data: [], error: { message: "Supabase não configurado." } }),
            update: async () => ({ data: [], error: { message: "Supabase não configurado." } }),
            delete: async () => ({ data: [], error: { message: "Supabase não configurado." } }),
            upsert: async () => ({ data: [], error: { message: "Supabase não configurado." } }),
        }),
    } as any;
