import { z } from 'zod';
import { UserProfile } from '../types';
import { requireUserId, supabase } from './supabase';
export const DEFAULT_PROFILE: UserProfile = {
  name: 'Minha conta',
  email: '',
  role: '',
  companyName: 'Minha empresa',
  avatarUrl: '',
};
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().max(254),
  role: z.string().max(80),
  companyName: z.string().trim().max(160),
  avatarUrl: z
    .string()
    .max(2800000)
    .refine(
      (v) =>
        !v ||
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ||
        /^\/(?!\/)/.test(v),
    )
    .optional(),
});
export async function getProfileConfig(): Promise<UserProfile> {
  const user_id = await requireUserId();
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('user_id', user_id)
    .eq('key', 'profile')
    .maybeSingle();
  if (error) throw error;
  const parsed = schema.safeParse({ ...DEFAULT_PROFILE, ...data?.value });
  return parsed.success ? parsed.data : DEFAULT_PROFILE;
}
export async function saveProfileConfig(profile: UserProfile): Promise<void> {
  const user_id = await requireUserId();
  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        user_id,
        key: 'profile',
        value: schema.parse(profile),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' },
    );
  if (error) throw error;
}
