import supabase from './SupabaseClient';
import { getCurrentUserId } from './authSession';
import { traceAsync } from './perfTrace';
import { trackEvent } from './analyticsTracker';
import { invalidateCache, getCachedData, setCached } from './cacheService';
import { fetchLatestSetting as fetchLatestSettingFromSettingService } from './SettingService';

export type BillRecord = {
  id: number;
  created_at: string;
  modified_at: string | null;
  billing_month?: string | null;
  user_id: string | null;
  tenant_id: number | null;
  room_id: number | null;
  rent: number | null;
  water: number | null;
  previous_month_meter_reading: number | null;
  current_month_meter_reading: number | null;
  electricity: number | null;
  total_amount: number | null;
  ad_hoc_amount: number | null;
  ad_hoc_comment: string | null;
  paid_amount: number | null;
  status: string | null;
  paid_amount_comment: string | null;
};

export type CreateBillPayload = {
  tenantId: number;
  roomId: number;
  /** ISO datetime representing the billing month (1st day of month) */
  billingMonth: string;
  rent: number;
  water: number;
  previousMeter: number;
  currentMeter: number;
  electricity: number;
  totalAmount: number;
  adHocAmount: number;
  adHocComment?: string;
  paidAmount?: number;
  status?: string;
};

export type UpdateBillPayload = {
  billId: number;
  tenantId: number;
  roomId: number;
  /** ISO datetime representing the billing month (1st day of month) */
  billingMonth: string;
  rent: number;
  water: number;
  previousMeter: number;
  currentMeter: number;
  electricity: number;
  totalAmount: number;
  adHocAmount: number;
  adHocComment?: string;
  paidAmount: number;
  status: string;
};

/* ===================== CACHE HELPERS ===================== */

export const getCachedBills = (): BillRecord[] | null => {
  return getCachedData<BillRecord[]>('bills');
};

export const hasCachedBills = (): boolean => {
  return !!getCachedBills();
};

/* ===================== FETCH ===================== */

export async function fetchBills(): Promise<BillRecord[]> {
  // Return cache if valid
  const cached = getCachedData<BillRecord[]>('bills');
  if (cached) {
    console.log('[cache] Returning cached bills:', cached.length);
    // Refresh in background
    (async () => {
      try {
        const fresh = await fetchBillsFromServer();
        setCached('bills', fresh);
      } catch (err) {
        console.warn('[cache] Background refresh failed:', err);
      }
    })();
    return cached;
  }

  const data = await fetchBillsFromServer();
  setCached('bills', data);
  return data;
}

async function fetchBillsFromServer(): Promise<BillRecord[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('bill')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as any;
}

export async function fetchBillById(
  billId: number,
): Promise<BillRecord | null> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('bill')
    .select('*')
    .eq('user_id', userId)
    .eq('id', billId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as any;
}

export async function fetchLatestBillForRoom(
  roomId: number,
): Promise<Pick<BillRecord, 'id' | 'created_at'> | null> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('bill')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as any;
}

export async function createBill(
  payload: CreateBillPayload,
): Promise<BillRecord> {
  return await traceAsync(
    'action_bill_create',
    async () => {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('bill')
        .insert({
          user_id: userId,
          tenant_id: payload.tenantId,
          room_id: payload.roomId,
          billing_month: payload.billingMonth,
          rent: payload.rent,
          water: payload.water,
          previous_month_meter_reading: payload.previousMeter,
          current_month_meter_reading: payload.currentMeter,
          electricity: payload.electricity,
          total_amount: payload.totalAmount,
          ad_hoc_amount: payload.adHocAmount,
          ad_hoc_comment: payload.adHocComment || null,
          paid_amount: payload.paidAmount != null ? payload.paidAmount : 0,
          status: payload.status || 'UNPAID',
          modified_at: null,
        })
        .select()
        .maybeSingle();

      if (error || !data) throw error;
      invalidateCache(['bills', 'dashboard']);
      return data as any;
    },
    { room_id: payload.roomId, tenant_id: payload.tenantId },
  );
}

export async function updateBill(
  payload: UpdateBillPayload,
): Promise<BillRecord> {
  return await traceAsync(
    'action_bill_update',
    async () => {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('bill')
        .update({
          tenant_id: payload.tenantId,
          room_id: payload.roomId,
          billing_month: payload.billingMonth,
          rent: payload.rent,
          water: payload.water,
          previous_month_meter_reading: payload.previousMeter,
          current_month_meter_reading: payload.currentMeter,
          electricity: payload.electricity,
          total_amount: payload.totalAmount,
          ad_hoc_amount: payload.adHocAmount,
          ad_hoc_comment: payload.adHocComment || null,
          paid_amount: payload.paidAmount,
          status: payload.status,
          modified_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', payload.billId)
        .select()
        .maybeSingle();

      if (error || !data) throw error;
      invalidateCache(['bills', 'dashboard']);
      return data as any;
    },
    { bill_id: payload.billId, room_id: payload.roomId, tenant_id: payload.tenantId },
  );
}

export async function updateBillPayment(params: {
  billId: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmountComment?: string | null;
}): Promise<BillRecord> {
  return await traceAsync(
    'action_bill_payment_save',
    async () => {
      const userId = await getCurrentUserId();

      const { data, error } = await supabase
        .from('bill')
        .update({
          paid_amount: params.paidAmount,
          status: params.status,
          paid_amount_comment: params.paidAmountComment ?? undefined,
          modified_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', params.billId)
        .select()
        .maybeSingle();

      if (error || !data) throw error;
      invalidateCache(['bills', 'dashboard']);
      return data as any;
    },
    { bill_id: params.billId, status: params.status },
  );
}

export async function deleteBill(billId: number): Promise<void> {
  return await traceAsync('action_bill_delete', async () => {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('bill')
      .delete()
      .eq('user_id', userId)
      .eq('id', billId);

    if (error) throw error;
    invalidateCache(['bills', 'dashboard']);
  });
}

export async function fetchLatestSetting(): Promise<{
  water: number;
  electricity_unit: number;
  rent_date: number;
  rent_due_date: number;
  property_name?: string;
  property_address?: string;
}> {
  return fetchLatestSettingFromSettingService();
}
