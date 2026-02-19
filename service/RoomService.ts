import supabase from './SupabaseClient';
import { getCurrentUserId } from './authSession';

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

const fetchRooms = async () => {
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

/* ===================== SAVE ===================== */

const saveRoom = async (payload: SavePayload) => {
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
  return data as RoomRecord;
};

/* ===================== DELETE ===================== */

const deleteRoom = async (roomId: number) => {
  const userId = await getCurrentUserId();

  const { error } = await supabase
    .from('room')
    .delete()
    .eq('id', roomId)
    .eq('user_id', userId);

  if (error) throw error;
};

/* ===================== EXPORTS ===================== */

export { fetchRooms, fetchRoomById, saveRoom, deleteRoom };
