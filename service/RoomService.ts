import supabase from './SupabaseClient';
import { getCurrentUserId } from './authSession';
import { traceAsync } from './perfTrace';
import { trackEvent } from './analyticsTracker';
import { invalidateCache, getCachedData, setCached } from './cacheService';

/* ===================== TYPES ===================== */

export type RoomRecord = {
  id: number;
  user_id: string | null;
  name: string | null;
  type: string | null;
  area: string | null;
  rent: string | null;
  deposit: string | null;
  comment: string | null;
  created_at?: string;
  modified_at?: string | null;
};

type SavePayload = {
  id?: number;
  name: string;
  type?: string;
  area?: string;
  rent?: string;
  deposit?: string;
  comment?: string;
};

/* ===================== FETCH ===================== */

const getCachedRooms = (): RoomRecord[] | null => {
  return getCachedData<RoomRecord[]>('rooms');
};

const hasCachedRooms = (): boolean => {
  return !!getCachedRooms();
};

const fetchRooms = async () => {
  // Return cache if valid
  const cached = getCachedRooms();
  if (cached) {
    console.log('[cache] Returning cached rooms:', cached.length);
    // Refresh in background
    (async () => {
      try {
        const fresh = await fetchRoomsFromServer();
        setCached('rooms', fresh);
      } catch (err) {
        console.warn('[cache] Background refresh failed:', err);
      }
    })();
    return cached;
  }

  const data = await fetchRoomsFromServer();
  setCached('rooms', data);
  return data;
};

const fetchRoomsFresh = async () => {
  return await fetchRoomsFromServer();
};

const fetchRoomsFromServer = async () => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('room')
    .select('*')
    .eq('user_id', userId)
    .order('modified_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as RoomRecord[];
};

/* ===================== SAVE ===================== */

const saveRoom = async (payload: SavePayload) => {
  return await traceAsync(
    'action_room_save',
    async () => {
      const userId = await getCurrentUserId();

      /* ---------- ADD ---------- */
      if (!payload.id) {
        const { data, error } = await supabase
          .from('room')
          .insert({
            name: payload.name.trim(),
            type: payload.type?.trim() || null,
            area: payload.area?.trim() || null,
            rent: payload.rent?.trim() || null,
            deposit: payload.deposit?.trim() || null,
            comment: payload.comment?.trim() || null,
            user_id: userId,
          })
          .select()
          .maybeSingle();

        if (error || !data) throw error;
        trackEvent('Room_Saved', {
          source: 'Room',
          mode: 'add',
          room_id: data.id,
        });
        invalidateCache(['rooms', 'activeTenantsByRooms', 'dashboard', 'tenantRoomAssignments']);
        return data as RoomRecord;
      }

      /* ---------- EDIT ---------- */
      const { data, error } = await supabase
        .from('room')
        .update({
          name: payload.name.trim(),
          type: payload.type?.trim() || null,
          area: payload.area?.trim() || null,
          rent: payload.rent?.trim() || null,
          deposit: payload.deposit?.trim() || null,
          comment: payload.comment?.trim() || null,
          modified_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      trackEvent('Room_Saved', {
        source: 'Room',
        mode: 'edit',
        room_id: payload.id,
      });
      invalidateCache(['rooms', 'activeTenantsByRooms', 'dashboard', 'tenantRoomAssignments']);
      return data as RoomRecord;
    },
    { mode: payload.id ? 'edit' : 'add' },
  );
};

/* ===================== DELETE ===================== */

const deleteRoom = async (roomId: number) => {
  return await traceAsync('action_room_delete', async () => {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from('room')
      .delete()
      .eq('id', roomId)
      .eq('user_id', userId);

    if (error) throw error;
    invalidateCache(['rooms', 'activeTenantsByRooms', 'dashboard', 'tenantRoomAssignments']);
  });
};

const fetchRoomById = async (roomId: number) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('room')
    .select('*')
    .eq('id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as RoomRecord | null;
};

/* ===================== EXPORTS ===================== */

export { getCachedRooms, hasCachedRooms, fetchRooms, fetchRoomsFresh, fetchRoomById, saveRoom, deleteRoom };


