import supabase from './SupabaseClient';

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

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('User not found. Please login again.');
  return data.user.id;
};

export async function fetchBills(): Promise<BillRecord[]> {
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
  return data as any;
}

export async function updateBill(
  payload: UpdateBillPayload,
): Promise<BillRecord> {
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
  return data as any;
}

export async function updateBillPayment(params: {
  billId: number;
  paidAmount: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  paidAmountComment?: string | null;
}): Promise<BillRecord> {
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
  return data as any;
}

export async function deleteBill(billId: number): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from('bill')
    .delete()
    .eq('user_id', userId)
    .eq('id', billId);
  if (error) throw error;
}

export async function fetchLatestSetting(): Promise<{
  water: number;
  electricity_unit: number;
  rent_date: number;
  rent_due_date: number;
  property_name?: string;
  property_address?: string;
}> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('setting')
    .select(
      'property_name, property_address, water, electricity_unit, rent_date, rent_due_date, modified_at, created_at',
    )
    .eq('user_id', userId)
    .order('modified_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

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
