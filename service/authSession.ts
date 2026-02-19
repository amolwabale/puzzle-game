import supabase from './SupabaseClient';
import type { User } from '@supabase/supabase-js';

/**
 * Session-first auth helpers.
 *
 * - `getSession()` reads from local persisted storage (no network)
 * - Fallback to `getUser()` only when session is missing (rare edge cases)
 */
export async function getCurrentSessionUser(): Promise<User> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const sessionUser = data.session?.user;
  if (sessionUser?.id) return sessionUser;

  // Rare fallback: validate / refresh user via network
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user?.id)
    throw new Error('User not found. Please login again.');
  return userData.user;
}

export async function getCurrentUserId(): Promise<string> {
  const u = await getCurrentSessionUser();
  return u.id;
}

