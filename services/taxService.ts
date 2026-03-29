import { supabase, isSupabaseConfigured } from './supabase';
import { TaxSetting } from '../types';

const ensureConfig = () => {
    if (!isSupabaseConfigured) {
        throw new Error('CONFIGURAÇÃO AUSENTE: Configure o Supabase no Render para gerenciar impostos.');
    }
};

export const getTaxSettingsFromDb = async (): Promise<TaxSetting[]> => {
    ensureConfig();
    const { data, error } = await supabase
        .from('tax_settings')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Erro ao buscar impostos:', error);
        return [];
    }
    return data || [];
};

export const addTaxSettingToDb = async (tax: Omit<TaxSetting, 'id'>): Promise<TaxSetting> => {
    ensureConfig();
    const newTax = {
        ...tax,
        id: crypto.randomUUID(),
    };

    const { data, error } = await supabase
        .from('tax_settings')
        .insert([newTax])
        .select();

    if (error) {
        console.error('Erro ao adicionar imposto:', error);
        throw error;
    }
    return data[0];
};

export const deleteTaxSettingFromDb = async (id: string): Promise<void> => {
    ensureConfig();
    const { error } = await supabase
        .from('tax_settings')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Erro ao deletar imposto:', error);
        throw error;
    }
};
