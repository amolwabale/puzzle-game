import supabase from './SupabaseClient';
import { getCurrentUserId } from './authSession';
import { traceAsync } from './perfTrace';
import { invalidateCache, getCachedData, setCached } from './cacheService';

/* ===================== TYPES ===================== */

export type SettingRecord = {
  id?: number;
  user_id?: string;
  property_name?: string | null;
  property_address?: string | null;
  water?: number | null;
  electricity_unit?: number | null;
  rent_date?: number | null;
  rent_due_date?: number | null;
  created_at?: string;
  modified_at?: string | null;
};

export type SaveSettingPayload = {
  propertyName: string;
  propertyAddress?: string;
  water?: number | null;
  electricity?: number | null;
  rentDate?: number | null;
  rentDueDate?: number | null;
};

/* ===================== CACHE HELPERS ===================== */

export const getCachedSettings = (): SettingRecord | null => {
  return getCachedData<SettingRecord>('settings');
};

export const hasCachedSettings = (): boolean => {
  return !!getCachedSettings();
};

/* ===================== FETCH ===================== */

export const fetchSettings = async (): Promise<SettingRecord | null> => {
  // Return cache if valid
  const cached = getCachedData<SettingRecord>('settings');
  if (cached) {
    console.log('[cache] Returning cached settings');
    // Refresh in background WITHOUT awaiting
    fetchSettingsFromServer()
      .then(fresh => {
        console.log('[cache] Background refresh settings completed');
        setCached('settings', fresh || {});
      })
      .catch(err => {
        console.warn('[cache] Background refresh settings failed:', err);
      });
    // Return cache immediately (non-blocking)
    return cached;
  }

  // No cache, fetch from server and wait
  const data = await fetchSettingsFromServer();
  if (data) {
    setCached('settings', data);
  }
  return data || null;
};

const fetchSettingsFromServer = async (): Promise<SettingRecord | null> => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('setting')
    .select('*')
    .eq('user_id', userId)
    .order('modified_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as SettingRecord) || null;
};

export async function fetchLatestSetting(): Promise<{
  water: number;
  electricity_unit: number;
  rent_date: number;
  rent_due_date: number;
  property_name?: string;
  property_address?: string;
}> {
  const data = await fetchSettings();

  const water = data?.water != null ? Number(data.water) : 0;
  const electricity_unit =
    data?.electricity_unit != null ? Number(data.electricity_unit) : 0;
  const rent_date = data?.rent_date != null ? Number(data.rent_date) : 0;
  const rent_due_date =
    data?.rent_due_date != null ? Number(data.rent_due_date) : 0;
  const property_name = data?.property_name ?? undefined;
  const property_address = data?.property_address ?? undefined;

  return {
    water,
    electricity_unit,
    rent_date,
    rent_due_date,
    property_name,
    property_address,
  };
}

/* ===================== SAVE ===================== */

export const saveSetting = async (payload: SaveSettingPayload): Promise<SettingRecord> => {
  const userId = await getCurrentUserId();

  // First, try to fetch existing record
  const { data: existing, error: fetchErr } = await supabase
    .from('setting')
    .select('id')
    .eq('user_id', userId)
    .order('modified_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchErr) throw fetchErr;

  return await traceAsync(
    'action_setting_save',
    async () => {
      const settingPayload = {
        user_id: userId,
        property_name: payload.propertyName.trim(),
        property_address: payload.propertyAddress?.trim() || null,
        water: payload.water != null ? Number(payload.water) : null,
        electricity_unit: payload.electricity != null ? Number(payload.electricity) : null,
        rent_date: payload.rentDate != null ? Number(payload.rentDate) : null,
        rent_due_date: payload.rentDueDate != null ? Number(payload.rentDueDate) : null,
        modified_at: new Date().toISOString(),
      };

      let result;

      if (existing?.id) {
        // Update existing record
        result = await supabase
          .from('setting')
          .update(settingPayload)
          .eq('id', existing.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();
      } else {
        // Create new record
        result = await supabase
          .from('setting')
          .insert(settingPayload)
          .select()
          .maybeSingle();
      }

      if (result.error) throw result.error;

      const saved = result.data as SettingRecord;

      // Invalidate settings cache and dashboard (since settings affects dashboard KPIs)
      invalidateCache(['settings', 'dashboard']);

      return saved;
    },
    { mode: existing?.id ? 'edit' : 'add' },
  );
};

export { fetchSettingsFromServer };
