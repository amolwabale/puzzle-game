import supabase from './SupabaseClient';
import { readUriAsArrayBuffer } from './readUriAsArrayBuffer';
import { getCurrentSessionUser, getCurrentUserId } from './authSession';
import { traceAsync } from './perfTrace';
import type {
  FileInput,
  Ticket,
  TicketChat,
  TicketStatus,
} from './ticketTypes';

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
  return await getCurrentSessionUser();
};

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentAuthUser();
  const userId = user.id;
  const email = user.email ?? null;

  // 1) Primary: match by auth user id (recommended).
  const { data: byUserId, error: errUserId } = await supabase
    .from('User')
    .select(
      'id, user_id, created_at, first_name, last_name, mobile, email, address',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (errUserId) throw errUserId;
  if (byUserId) return byUserId;

  // 2) Fallback: many schemas store email but not auth user id (or user_id defaults to random UUID).
  // If we find a row by email, "link" it to auth user id for future reads.
  if (email) {
    const { data: byEmail, error: errEmail } = await supabase
      .from('User')
      .select(
        'id, user_id, created_at, first_name, last_name, mobile, email, address',
      )
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

export type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  mobile?: string;
  email?: string;
  address?: string;
};

export async function updateUserProfile(
  payload: UpdateProfilePayload,
): Promise<UserProfile | null> {
  return await traceAsync(
    'action_profile_save',
    async () => {
      const user = await getCurrentAuthUser();
      const userId = user.id;

      const { data, error } = await supabase
        .from('User')
        .update(payload)
        .eq('user_id', userId)
        .select('created_at, first_name, last_name, mobile, email, address')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    {
      has_first_name: payload.first_name != null,
      has_last_name: payload.last_name != null,
      has_mobile: payload.mobile != null,
      has_address: payload.address != null,
    },
  );
}

export async function changePasswordAndLogout(newPassword: string) {
  return await traceAsync('action_password_change', async () => {
    const pwd = String(newPassword || '');
    if (pwd.length < 6)
      throw new Error('Password must be at least 6 characters.');

    const { error: updateErr } = await supabase.auth.updateUser({
      password: pwd,
    });
    if (updateErr) throw updateErr;

    // After changing password, force re-login for security.
    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) throw signOutErr;
  });
}

/* ===================== SUPPORT / TICKETS ===================== */

const SUPPORT_BUCKET = 'tenant-manager';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const getExt = (name: string, fallback = 'bin') =>
  name.includes('.') ? name.split('.').pop()! : fallback;

const getSafeFileName = (name: string) =>
  name
    .trim()
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80) || `upload.${getExt(name)}`;

const uploadSupportFile = async (
  userId: string,
  ticketId: string,
  file: FileInput,
) => {
  const safeName = getSafeFileName(
    file.name || `upload.${getExt(file.name || 'file')}`,
  );
  // Required path: `${userId}/Support/support_id/image_name`
  const path = `${userId}/Support/${ticketId}/${safeName}`;

  const buffer = await readUriAsArrayBuffer(file.uri, { maxBytes: MAX_UPLOAD_BYTES });

  const { error } = await supabase.storage
    .from(SUPPORT_BUCKET)
    .upload(path, buffer, {
      upsert: true,
      contentType: file.type || 'application/octet-stream',
    });
  if (error) throw error;

  const { data } = supabase.storage.from(SUPPORT_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};

export async function createSignedUrlFromPublicUrl(
  fullUrl: string,
  expiresInSec = 60 * 60,
) {
  // Reuse the same approach as TenantView: extract file path from the public URL.
  // Public URL contains ".../tenant-manager/<path>"
  const marker = `/${SUPPORT_BUCKET}/`;
  const idx = fullUrl.indexOf(marker);
  if (idx === -1) return undefined;
  const filePath = fullUrl.substring(idx + marker.length);

  const { data, error } = await supabase.storage
    .from(SUPPORT_BUCKET)
    .createSignedUrl(filePath, expiresInSec);

  if (error) return undefined;
  return data.signedUrl;
}

export async function fetchSupportTickets(): Promise<Ticket[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ticket')
    .select('id, created_at, user_id, title, description, status, upload_url')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

export async function fetchSupportTicketById(
  ticketId: string,
): Promise<Ticket | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('ticket')
    .select('id, created_at, user_id, title, description, status, upload_url')
    .eq('id', ticketId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

export async function createSupportTicket(input: {
  title: string;
  description: string;
  file?: FileInput | null;
}): Promise<Ticket> {
  return await traceAsync(
    'action_ticket_create',
    async () => {
      const userId = await getCurrentUserId();
      const title = input.title.trim();
      const description = input.description.trim();
      if (!title) throw new Error('Title is required.');
      if (!description) throw new Error('Description is required.');

      const initialStatus: TicketStatus = 'OPEN';

      // Create ticket first to get ticket id for upload path.
      const { data: created, error: createErr } = await supabase
        .from('ticket')
        .insert({
          user_id: userId,
          title,
          description,
          status: initialStatus,
          upload_url: null,
        })
        .select('id, created_at, user_id, title, description, status, upload_url')
        .maybeSingle();
      if (createErr || !created) throw createErr;

      // Optional attachment upload + update ticket.upload_url
      if (input.file) {
        const u = await uploadSupportFile(userId, created.id, input.file);
        const { data: updated, error: updErr } = await supabase
          .from('ticket')
          .update({ upload_url: u.publicUrl })
          .eq('id', created.id)
          .eq('user_id', userId)
          .select(
            'id, created_at, user_id, title, description, status, upload_url',
          )
          .maybeSingle();
        if (updErr || !updated) throw updErr;
        return updated as any;
      }

      return created as any;
    },
    { has_attachment: !!input.file },
  );
}

export async function fetchSupportTicketChat(
  ticketId: string,
): Promise<TicketChat[]> {
  const userId = await getCurrentUserId();
  // Ensure ticket belongs to user (prevents leaking chat).
  const t = await fetchSupportTicketById(ticketId);
  if (!t) throw new Error('Ticket not found.');

  const { data, error } = await supabase
    .from('ticket_chat')
    .select('id, ticket_id, user_id, user_role, created_at, chat')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  // userId used above for ownership validation
  void userId;
  return (data || []) as any;
}

export async function sendSupportTicketMessage(input: {
  ticketId: string;
  chat: string;
}): Promise<TicketChat> {
  return await traceAsync(
    'action_ticket_chat_send',
    async () => {
      const userId = await getCurrentUserId();
      const chat = input.chat.trim();
      if (!chat) throw new Error('Message cannot be empty.');

      const ticket = await fetchSupportTicketById(input.ticketId);
      if (!ticket) throw new Error('Ticket not found.');
      if (ticket.status === 'CLOSED') throw new Error('Ticket is closed.');

      const { data, error } = await supabase
        .from('ticket_chat')
        .insert({
          ticket_id: input.ticketId,
          user_id: userId,
          user_role: 'USER',
          chat,
        })
        .select('id, ticket_id, user_id, user_role, created_at, chat')
        .maybeSingle();
      if (error || !data) throw error;
      return data as any;
    },
    { ticket_id: input.ticketId },
  );
}

export async function closeSupportTicket(ticketId: string): Promise<Ticket> {
  const userId = await getCurrentUserId();
  const ticket = await fetchSupportTicketById(ticketId);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status === 'CLOSED') return ticket;

  const { data, error } = await supabase
    .from('ticket')
    .update({ status: 'CLOSED' })
    .eq('id', ticketId)
    .eq('user_id', userId)
    .select('id, created_at, user_id, title, description, status, upload_url')
    .maybeSingle();
  if (error || !data) throw error;
  return data as any;
}
