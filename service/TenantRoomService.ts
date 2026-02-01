import supabase from './SupabaseClient';
import { TenantRecord } from './tenantService';

/* ===================== TYPES ===================== */

export type TenantRoomRecord = {
  id: number;
  tenant_id: number;
  room_id: number;
  joining_date: string;
  leaving_date: string | null;
  tenant: TenantRecord;
};

export type TenantHistoryRecord = {
  tenant_name: string;
  joining_date: string;
  leaving_date: string | null;
  last_rent_paid: number | null;
};

export type ActiveTenantAssignment = {
  tenant_id: number;
  room_id: number;
  joining_date: string;
};

/* ===================== AUTH ===================== */

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('User not found');
  return data.user.id;
};

/* ===================== HELPERS ===================== */

const fetchTenantsMap = async (): Promise<Record<number, TenantRecord>> => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('tenant')
    .select('*')
    .eq('user_id', userId);

  if (error) throw error;

  const map: Record<number, TenantRecord> = {};
  data.forEach(t => (map[t.id] = t));
  return map;
};

/* ===================== ACTIVE TENANT ===================== */

const fetchActiveTenantForRoom = async (roomId: number) => {
  const userId = await getCurrentUserId();
  const tenantMap = await fetchTenantsMap();

  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .is('leaving_date', null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    ...data,
    tenant: tenantMap[data.tenant_id],
  } as TenantRoomRecord;
};

const fetchActiveTenantsForRooms = async (roomIds: number[]) => {
  const ids = Array.from(new Set(roomIds)).filter(Boolean);
  if (ids.length === 0) return {} as Record<number, TenantRoomRecord | null>;

  const userId = await getCurrentUserId();
  const tenantMap = await fetchTenantsMap();

  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('user_id', userId)
    .in('room_id', ids)
    .is('leaving_date', null);

  if (error) throw error;

  const map: Record<number, TenantRoomRecord | null> = {};
  ids.forEach(id => (map[id] = null));

  (data || []).forEach((r: any) => {
    map[r.room_id] = {
      ...r,
      tenant: tenantMap[r.tenant_id],
    } as TenantRoomRecord;
  });

  return map;
};

const fetchActiveRoomForTenants = async (tenantIds: number[]) => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0)
    return {} as Record<number, ActiveTenantAssignment | null>;

  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('tenant_id, room_id, joining_date')
    .eq('user_id', userId)
    .in('tenant_id', ids)
    .is('leaving_date', null);

  if (error) throw error;

  const map: Record<number, ActiveTenantAssignment | null> = {};
  ids.forEach(id => (map[id] = null));

  (data || []).forEach((r: any) => {
    // If multiple active rows exist unexpectedly, keep the first encountered
    if (!map[r.tenant_id]) {
      map[r.tenant_id] = {
        tenant_id: r.tenant_id,
        room_id: r.room_id,
        joining_date: r.joining_date,
      } as ActiveTenantAssignment;
    }
  });

  return map;
};

/* ===================== GUARDS ===================== */

const hasAnyTenantMappingForRoom = async (roomId: number) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('id')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data?.id;
};

/* ===================== TENANT HISTORY ===================== */

const fetchTenantHistoryForRoom = async (roomId: number) => {
  const userId = await getCurrentUserId();
  const tenantMap = await fetchTenantsMap();

  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .not('leaving_date', 'is', null)
    .order('joining_date', { ascending: false });

  if (error) throw error;

  return (data || []).map(r => ({
    tenant_name: tenantMap[r.tenant_id]?.name ?? '-',
    joining_date: r.joining_date,
    leaving_date: r.leaving_date,
    last_rent_paid: null, // from bill later
  })) as TenantHistoryRecord[];
};

/* ===================== ADD TENANT ===================== */

const addTenantToRoom = async ({
  tenant_id,
  room_id,
  joining_date,
}: {
  tenant_id: number;
  room_id: number;
  joining_date: string;
}) => {
  const userId = await getCurrentUserId();

  // safety: ensure no active tenant
  const existing = await fetchActiveTenantForRoom(room_id);
  if (existing) throw new Error('Room already occupied');

  const { error } = await supabase.from('tenant_room_mapping').insert({
    tenant_id,
    room_id,
    joining_date,
    user_id: userId,
  });

  if (error) throw error;
};

/* ===================== VACATE ===================== */

const vacateRoom = async (mappingId: number) => {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('tenant_room_mapping')
    .update({
      leaving_date: new Date().toISOString(),
    })
    .eq('id', mappingId)
    .eq('user_id', userId);

  if (error) throw error;
};

const updateJoiningDate = async (mappingId: number, joining_date: string) => {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('tenant_room_mapping')
    .update({
      joining_date,
    })
    .eq('id', mappingId)
    .eq('user_id', userId);

  if (error) throw error;
};

/* ===================== EXPORTS ===================== */

export {
  fetchActiveTenantForRoom,
  fetchActiveTenantsForRooms,
  fetchActiveRoomForTenants,
  hasAnyTenantMappingForRoom,
  fetchTenantHistoryForRoom,
  addTenantToRoom,
  vacateRoom,
  updateJoiningDate,
};
