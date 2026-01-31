import supabase from './SupabaseClient';

export type UserProfile = {
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
};

type DbUserRow = UserProfile & { id: number; user_id: string | null };

const getCurrentAuthUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('User not found. Please login again.');
  return data.user;
};

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentAuthUser();
  const userId = user.id;
  const email = user.email ?? null;

  // 1) Primary: match by auth user id (recommended).
  const { data: byUserId, error: errUserId } = await supabase
    .from('User')
    .select('id, user_id, created_at, first_name, last_name, mobile, email, address')
    .eq('user_id', userId)
    .maybeSingle();

  if (errUserId) throw errUserId;
  if (byUserId) return byUserId;

  // 2) Fallback: many schemas store email but not auth user id (or user_id defaults to random UUID).
  // If we find a row by email, "link" it to auth user id for future reads.
  if (email) {
    const { data: byEmail, error: errEmail } = await supabase
      .from('User')
      .select('id, user_id, created_at, first_name, last_name, mobile, email, address')
      .eq('email', email)
      .maybeSingle();

    if (errEmail) throw errEmail;
    if (byEmail) {
      // If user_id is not linked yet, update it.
      if (byEmail.user_id !== userId) {
        const { data: linked, error: errLink } = await supabase
          .from('User')
          .update({ user_id: userId })
          .eq('id', (byEmail as DbUserRow).id)
          .select('created_at, first_name, last_name, mobile, email, address')
          .maybeSingle();
        if (errLink) throw errLink;
        return linked ?? byEmail;
      }
      return byEmail;
    }
  }

  // 3) If no row exists at all, try to create a minimal profile row.
  // If RLS/permissions prevent insert, return a minimal profile derived from auth.
  try {
    const { data: created, error: errCreate } = await supabase
      .from('User')
      .insert({ user_id: userId, email })
      .select('created_at, first_name, last_name, mobile, email, address')
      .maybeSingle();
    if (errCreate) throw errCreate;
    return created ?? null;
  } catch {
    return {
      created_at: (user as any).created_at ?? new Date().toISOString(),
      first_name: (user.user_metadata as any)?.first_name ?? null,
      last_name: (user.user_metadata as any)?.last_name ?? null,
      mobile: (user.user_metadata as any)?.mobile ?? null,
      email,
      address: (user.user_metadata as any)?.address ?? null,
    };
  }
}

export async function changePasswordAndLogout(newPassword: string) {
  const pwd = String(newPassword || '');
  if (pwd.length < 6) throw new Error('Password must be at least 6 characters.');

  const { error: updateErr } = await supabase.auth.updateUser({ password: pwd });
  if (updateErr) throw updateErr;

  // After changing password, force re-login for security.
  const { error: signOutErr } = await supabase.auth.signOut();
  if (signOutErr) throw signOutErr;
}