import supabase from './SupabaseClient';
import { TenantRecord } from './tenantService';
import { getCurrentUserId } from './authSession';
import { traceAsync } from './perfTrace';
import { trackEvent } from './analyticsTracker';
import { getCachedData, invalidateCache, setCached } from './cacheService';

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

export type ActiveRoomAssignmentWithRoomName = ActiveTenantAssignment & {
  room_name?: string;
};

export type AllActiveRoomsWithNames = {
  rooms: Array<{
    room_id: number;
    room_name?: string;
    joining_date: string;
  }>;
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
  // Prefer join (single call). Fallback to legacy method if relationship isn't present.
  const joined = await supabase
    .from('tenant_room_mapping')
    .select(
      'id, tenant_id, room_id, joining_date, leaving_date, tenant:tenant_id(id, name, profile_photo_url)',
    )
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .is('leaving_date', null)
    .maybeSingle();

  if (!joined.error && joined.data) {
    return joined.data as any;
  }

  const shouldFallback =
    joined.error?.message?.includes('relationship') ||
    joined.error?.message?.includes('Could not find') ||
    joined.error?.message?.includes('No relationship');

  if (!shouldFallback) {
    if (joined.error) throw joined.error;
    return null;
  }

  const tenantMap = await fetchTenantsMap();
  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .is('leaving_date', null)
    .maybeSingle();

  if (error || !data) return null;
  return { ...data, tenant: tenantMap[data.tenant_id] } as TenantRoomRecord;
};

const fetchActiveTenantsForRoomsFromServer = async (roomIds: number[]) => {
  const ids = Array.from(new Set(roomIds)).filter(Boolean);
  if (ids.length === 0) return {} as Record<number, TenantRoomRecord | null>;

  const userId = await getCurrentUserId();
  // Prefer join (single call). Fallback if relationship isn't present.
  const joined = await supabase
    .from('tenant_room_mapping')
    .select(
      'id, tenant_id, room_id, joining_date, leaving_date, tenant:tenant_id(id, name, profile_photo_url)',
    )
    .eq('user_id', userId)
    .in('room_id', ids)
    .is('leaving_date', null);

  const map: Record<number, TenantRoomRecord | null> = {};
  ids.forEach(id => (map[id] = null));

  if (!joined.error) {
    (joined.data || []).forEach((r: any) => {
      map[r.room_id] = r as TenantRoomRecord;
    });
    return map;
  }

  const shouldFallback =
    joined.error?.message?.includes('relationship') ||
    joined.error?.message?.includes('Could not find') ||
    joined.error?.message?.includes('No relationship');

  if (!shouldFallback) throw joined.error;

  const tenantMap = await fetchTenantsMap();
  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('user_id', userId)
    .in('room_id', ids)
    .is('leaving_date', null);
  if (error) throw error;
  (data || []).forEach((r: any) => {
    map[r.room_id] = { ...r, tenant: tenantMap[r.tenant_id] } as TenantRoomRecord;
  });
  return map;
};

const fetchActiveTenantsForRooms = async (roomIds: number[]) => {
  const ids = Array.from(new Set(roomIds)).filter(Boolean);
  if (ids.length === 0) return {} as Record<number, TenantRoomRecord | null>;

  const cached = getCachedData<Record<number, TenantRoomRecord | null>>(
    'activeTenantsByRooms',
  );

  if (cached && ids.every(id => Object.prototype.hasOwnProperty.call(cached, id))) {
    console.log('[cache] Returning cached active tenants by room:', ids.length);

    fetchActiveTenantsForRoomsFromServer(ids)
      .then(fresh => {
        setCached('activeTenantsByRooms', { ...cached, ...fresh });
      })
      .catch(err => {
        console.warn('[cache] Background refresh failed:', err);
      });

    const cachedSlice: Record<number, TenantRoomRecord | null> = {};
    ids.forEach(id => {
      cachedSlice[id] = cached[id] ?? null;
    });
    return cachedSlice;
  }

  const fresh = await fetchActiveTenantsForRoomsFromServer(ids);
  setCached('activeTenantsByRooms', { ...(cached || {}), ...fresh });
  return fresh;
};

const hasCachedActiveTenantsForRooms = (roomIds: number[]): boolean => {
  const ids = Array.from(new Set(roomIds)).filter(Boolean);
  if (ids.length === 0) return true;

  const cached = getCachedData<Record<number, TenantRoomRecord | null>>(
    'activeTenantsByRooms',
  );
  if (!cached) return false;

  return ids.every(id => Object.prototype.hasOwnProperty.call(cached, id));
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

const fetchActiveRoomAssignmentsForTenantsFromServer = async (
  tenantIds: number[],
): Promise<Record<number, ActiveRoomAssignmentWithRoomName | null>> => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0)
    return {} as Record<number, ActiveRoomAssignmentWithRoomName | null>;

  const userId = await getCurrentUserId();
  const joined = await supabase
    .from('tenant_room_mapping')
    .select('tenant_id, room_id, joining_date, room:room_id(id, name)')
    .eq('user_id', userId)
    .in('tenant_id', ids)
    .is('leaving_date', null);

  const map: Record<number, ActiveRoomAssignmentWithRoomName | null> = {};
  ids.forEach(id => (map[id] = null));

  if (!joined.error) {
    (joined.data || []).forEach((r: any) => {
      if (!map[r.tenant_id]) {
        map[r.tenant_id] = {
          tenant_id: r.tenant_id,
          room_id: r.room_id,
          joining_date: r.joining_date,
          room_name: r.room?.name ?? undefined,
        };
      }
    });
    return map;
  }

  const shouldFallback =
    joined.error?.message?.includes('relationship') ||
    joined.error?.message?.includes('Could not find') ||
    joined.error?.message?.includes('No relationship') ||
    joined.error?.details?.includes('Could not find a relationship');

  if (!shouldFallback) throw joined.error;

  // Fallback: no FK relationship configured. Fetch only the needed rooms.
  const plain = await supabase
    .from('tenant_room_mapping')
    .select('tenant_id, room_id, joining_date')
    .eq('user_id', userId)
    .in('tenant_id', ids)
    .is('leaving_date', null);
  if (plain.error) throw plain.error;

  const roomIds = Array.from(
    new Set((plain.data || []).map((r: any) => r.room_id).filter(Boolean)),
  ) as number[];

  const roomNameById: Record<number, string> = {};
  if (roomIds.length > 0) {
    const roomsRes = await supabase
      .from('room')
      .select('id, name')
      .eq('user_id', userId)
      .in('id', roomIds);
    if (roomsRes.error) throw roomsRes.error;
    (roomsRes.data || []).forEach((r: any) => {
      if (r?.id != null) roomNameById[r.id] = r.name || '-';
    });
  }

  (plain.data || []).forEach((r: any) => {
    if (!map[r.tenant_id]) {
      map[r.tenant_id] = {
        tenant_id: r.tenant_id,
        room_id: r.room_id,
        joining_date: r.joining_date,
        room_name: roomNameById[r.room_id] || '-',
      };
    }
  });
  return map;
};

const fetchAllActiveRoomsForTenantsFromServer = async (
  tenantIds: number[],
): Promise<Record<number, AllActiveRoomsWithNames>> => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0)
    return {} as Record<number, AllActiveRoomsWithNames>;

  const userId = await getCurrentUserId();
  const joined = await supabase
    .from('tenant_room_mapping')
    .select('tenant_id, room_id, joining_date, room:room_id(id, name)')
    .eq('user_id', userId)
    .in('tenant_id', ids)
    .is('leaving_date', null);

  const map: Record<number, AllActiveRoomsWithNames> = {};
  ids.forEach(id => (map[id] = { rooms: [] }));

  if (!joined.error) {
    (joined.data || []).forEach((r: any) => {
      map[r.tenant_id].rooms.push({
        room_id: r.room_id,
        joining_date: r.joining_date,
        room_name: r.room?.name ?? undefined,
      });
    });
    return map;
  }

  const shouldFallback =
    joined.error?.message?.includes('relationship') ||
    joined.error?.message?.includes('Could not find') ||
    joined.error?.message?.includes('No relationship') ||
    joined.error?.details?.includes('Could not find a relationship');

  if (!shouldFallback) throw joined.error;

  // Fallback: no FK relationship configured.
  const plain = await supabase
    .from('tenant_room_mapping')
    .select('tenant_id, room_id, joining_date')
    .eq('user_id', userId)
    .in('tenant_id', ids)
    .is('leaving_date', null);
  if (plain.error) throw plain.error;

  const roomIds = Array.from(
    new Set((plain.data || []).map((r: any) => r.room_id).filter(Boolean)),
  ) as number[];

  const roomNameById: Record<number, string> = {};
  if (roomIds.length > 0) {
    const roomsRes = await supabase
      .from('room')
      .select('id, name')
      .eq('user_id', userId)
      .in('id', roomIds);
    if (roomsRes.error) throw roomsRes.error;
    (roomsRes.data || []).forEach((r: any) => {
      if (r?.id != null) roomNameById[r.id] = r.name || '-';
    });
  }

  (plain.data || []).forEach((r: any) => {
    map[r.tenant_id].rooms.push({
      room_id: r.room_id,
      joining_date: r.joining_date,
      room_name: roomNameById[r.room_id] || '-',
    });
  });
  return map;
};

export const fetchActiveRoomAssignmentsForTenants = async (
  tenantIds: number[],
): Promise<Record<number, ActiveRoomAssignmentWithRoomName | null>> => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0)
    return {} as Record<number, ActiveRoomAssignmentWithRoomName | null>;

  const cached =
    getCachedData<Record<number, ActiveRoomAssignmentWithRoomName | null>>(
      'tenantRoomAssignments',
    );

  if (cached && ids.every(id => Object.prototype.hasOwnProperty.call(cached, id))) {
    console.log('[cache] Returning cached tenant-room assignments:', ids.length);

    fetchActiveRoomAssignmentsForTenantsFromServer(ids)
      .then(fresh => {
        setCached('tenantRoomAssignments', { ...cached, ...fresh });
      })
      .catch(err => {
        console.warn('[cache] Background refresh failed:', err);
      });

    const cachedSlice: Record<number, ActiveRoomAssignmentWithRoomName | null> = {};
    ids.forEach(id => {
      cachedSlice[id] = cached[id] ?? null;
    });
    return cachedSlice;
  }

  const fresh = await fetchActiveRoomAssignmentsForTenantsFromServer(ids);
  setCached('tenantRoomAssignments', { ...(cached || {}), ...fresh });
  return fresh;
};

const hasCachedActiveRoomAssignmentsForTenants = (
  tenantIds: number[],
): boolean => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0) return true;

  const cached =
    getCachedData<Record<number, ActiveRoomAssignmentWithRoomName | null>>(
      'tenantRoomAssignments',
    );
  if (!cached) return false;

  return ids.every(id => Object.prototype.hasOwnProperty.call(cached, id));
};

export const fetchAllActiveRoomsForTenants = async (
  tenantIds: number[],
): Promise<Record<number, AllActiveRoomsWithNames>> => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0)
    return {} as Record<number, AllActiveRoomsWithNames>;

  const cached =
    getCachedData<Record<number, AllActiveRoomsWithNames>>(
      'tenantAllRooms',
    );

  if (cached && ids.every(id => Object.prototype.hasOwnProperty.call(cached, id))) {
    console.log('[cache] Returning cached tenant-all-rooms:', ids.length);

    fetchAllActiveRoomsForTenantsFromServer(ids)
      .then(fresh => {
        setCached('tenantAllRooms', { ...cached, ...fresh });
      })
      .catch(err => {
        console.warn('[cache] Background refresh failed:', err);
      });

    const cachedSlice: Record<number, AllActiveRoomsWithNames> = {};
    ids.forEach(id => {
      cachedSlice[id] = cached[id] ?? { rooms: [] };
    });
    return cachedSlice;
  }

  const fresh = await fetchAllActiveRoomsForTenantsFromServer(ids);
  setCached('tenantAllRooms', { ...(cached || {}), ...fresh });
  return fresh;
};

const hasCachedAllActiveRoomsForTenants = (
  tenantIds: number[],
): boolean => {
  const ids = Array.from(new Set(tenantIds)).filter(Boolean);
  if (ids.length === 0) return true;

  const cached =
    getCachedData<Record<number, AllActiveRoomsWithNames>>(
      'tenantAllRooms',
    );
  if (!cached) return false;

  return ids.every(id => Object.prototype.hasOwnProperty.call(cached, id));
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
  const joined = await supabase
    .from('tenant_room_mapping')
    .select('joining_date, leaving_date, tenant:tenant_id(name)')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .not('leaving_date', 'is', null)
    .order('joining_date', { ascending: false });

  if (!joined.error) {
    return (joined.data || []).map((r: any) => ({
      tenant_name: r.tenant?.name ?? '-',
      joining_date: r.joining_date,
      leaving_date: r.leaving_date,
      last_rent_paid: null,
    })) as TenantHistoryRecord[];
  }

  const shouldFallback =
    joined.error?.message?.includes('relationship') ||
    joined.error?.message?.includes('Could not find') ||
    joined.error?.message?.includes('No relationship');
  if (!shouldFallback) throw joined.error;

  const tenantMap = await fetchTenantsMap();
  const { data, error } = await supabase
    .from('tenant_room_mapping')
    .select('*')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .not('leaving_date', 'is', null)
    .order('joining_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((r: any) => ({
    tenant_name: tenantMap[r.tenant_id]?.name ?? '-',
    joining_date: r.joining_date,
    leaving_date: r.leaving_date,
    last_rent_paid: null,
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
  return await traceAsync(
    'action_room_occupancy_save',
    async () => {
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
      invalidateCache(['activeTenantsByRooms', 'tenantRoomAssignments', 'tenantAllRooms']);
      trackEvent('Room_OccupancySaved', {
        source: 'Room',
        room_id,
        tenant_id,
      });
    },
    { room_id, tenant_id },
  );
};

/* ===================== VACATE ===================== */

const vacateRoom = async (mappingId: number) => {
  return await traceAsync(
    'action_room_vacate',
    async () => {
      const userId = await getCurrentUserId();

      const { error } = await supabase
        .from('tenant_room_mapping')
        .update({
          leaving_date: new Date().toISOString(),
        })
        .eq('id', mappingId)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateCache(['activeTenantsByRooms', 'tenantRoomAssignments', 'tenantAllRooms']);
      trackEvent('Room_Vacated', {
        source: 'Room',
        mapping_id: mappingId,
      });
    },
    { mapping_id: mappingId },
  );
};

const updateJoiningDate = async (mappingId: number, joining_date: string) => {
  return await traceAsync(
    'action_room_joining_date_update',
    async () => {
      const userId = await getCurrentUserId();

      const { error } = await supabase
        .from('tenant_room_mapping')
        .update({
          joining_date,
        })
        .eq('id', mappingId)
        .eq('user_id', userId);

      if (error) throw error;
      invalidateCache(['activeTenantsByRooms', 'tenantRoomAssignments', 'tenantAllRooms']);
      trackEvent('Room_JoiningDateUpdated', {
        source: 'Room',
        mapping_id: mappingId,
      });
    },
    { mapping_id: mappingId },
  );
};

/* ===================== EXPORTS ===================== */

export {
  fetchActiveTenantForRoom,
  fetchActiveTenantsForRooms,
  hasCachedActiveTenantsForRooms,
  fetchActiveRoomForTenants,
  hasCachedActiveRoomAssignmentsForTenants,
  hasCachedAllActiveRoomsForTenants,
  hasAnyTenantMappingForRoom,
  fetchTenantHistoryForRoom,
  addTenantToRoom,
  vacateRoom,
  updateJoiningDate,
};
