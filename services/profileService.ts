import { supabase, isSupabaseConfigured } from './supabase';
import { UserProfile } from '../types';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'João Silva (CFO)',
  email: 'intechfin@financeiro.com.br',
  role: 'CFO',
  companyName: 'TechCorp Brasil Ltda.',
  avatarUrl: '',
};

const STORAGE_KEY = 'finnexus_user_profile';

/**
 * Carrega as informações do perfil do usuário do Supabase (tabela system_settings)
 * ou do localStorage se offline/não configurado.
 */
export const getProfileConfig = async (): Promise<UserProfile> => {
  try {
    const localData = localStorage.getItem(STORAGE_KEY);
    const localProfile = localData ? JSON.parse(localData) : DEFAULT_PROFILE;

    if (!isSupabaseConfigured) {
      return localProfile;
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'profile')
      .maybeSingle();

    if (error) {
      console.warn('[Profile] Não foi possível carregar o perfil do Supabase:', error.message);
    }

    if (!error && data?.value) {
      const dbProfile = { ...DEFAULT_PROFILE, ...data.value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dbProfile));
      return dbProfile;
    }

    return localProfile;
  } catch {
    return DEFAULT_PROFILE;
  }
};

/**
 * Salva as informações do perfil do usuário no localStorage e
 * envia para a tabela system_settings do Supabase (se configurado).
 */
export const saveProfileConfig = async (profile: UserProfile): Promise<void> => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));

  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: 'profile', value: profile, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    
    if (error) {
      console.error('[Profile] Erro ao sincronizar perfil no Supabase:', error.message);
    }
  } catch (err) {
    console.error('[Profile] Erro de conexão ao sincronizar perfil:', err);
  }
};
