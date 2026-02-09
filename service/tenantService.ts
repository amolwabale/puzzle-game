import supabase from './SupabaseClient';
import { readUriAsArrayBuffer } from './readUriAsArrayBuffer';

/* ===================== TYPES ===================== */

export type TenantRecord = {
  id: number;
  user_id: string;
  name: string | null;
  mobile: string | null;
  alternate_mobile: string | null;
  total_family_members: string | null;
  address: string | null;
  company_name: string | null;
  adhar_card_url: string | null;
  pan_card_url: string | null;
  agreement_url: string | null;
  profile_photo_url?: string | null;
  created_at?: string;
  modified_at?: string | null;
};

export type FileInput = {
  uri: string;
  name: string;
  type?: string;
};

type FileState = {
  file?: FileInput | null;
  url?: string | null;
};

type SavePayload = {
  id?: number;
  name: string;
  mobile: string;
  alternate_mobile?: string;
  total_family_members?: string;
  address?: string;
  company_name?: string;
  files: {
    profile?: FileState;
    pan?: FileState;
    adhar?: FileState;
    agreement?: FileState;
  };
};

/* ===================== CONSTS ===================== */

const BUCKET = 'tenant-manager';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/* ===================== AUTH ===================== */

const getCurrentUserId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error('User not found. Please login again.');
  return data.user.id;
};

/* ===================== FETCH ===================== */

const fetchTenants = async () => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('tenant')
    .select('*')
    .eq('user_id', userId)
    .order('modified_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as TenantRecord[];
};

const fetchTenantById = async (tenantId: number) => {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('tenant')
    .select('*')
    .eq('id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as TenantRecord | null;
};

/* ===================== FILE HELPERS ===================== */

const getExt = (name: string, fallback = 'bin') =>
  name.includes('.') ? name.split('.').pop()! : fallback;

const getPathFromPublicUrl = (url?: string | null) => {
  if (!url) return null;
  const idx = url.indexOf(`${BUCKET}/`);
  return idx === -1 ? null : url.substring(idx + BUCKET.length + 1);
};

const uploadFile = async (
  userId: string,
  tenantId: number,
  key: 'profile_photo' | 'pan_card' | 'adhar_card' | 'agreement',
  file: FileInput,
) => {
  const ext = getExt(file.name);
  const path = `${userId}/${tenantId}/${key}.${ext}`;

  // Android picker often returns content:// URIs; fetch(file://content://...) fails.
  // Use a robust URI reader that supports content:// and file://.
  const buffer = await readUriAsArrayBuffer(file.uri, { maxBytes: MAX_UPLOAD_BYTES });

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    upsert: true,
    contentType: file.type || 'application/octet-stream',
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
};

const deleteFileByUrl = async (url?: string | null) => {
  const path = getPathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
};

/* ===================== SAVE ===================== */

const saveTenant = async (payload: SavePayload) => {
  const userId = await getCurrentUserId();

  /* ---------- ADD (SAFE BY DESIGN) ---------- */
  if (!payload.id) {
    const { data: inserted, error } = await supabase
      .from('tenant')
      .insert({
        name: payload.name.trim(),
        mobile: payload.mobile.trim(),
        alternate_mobile: payload.alternate_mobile?.trim() || null,
        total_family_members: payload.total_family_members?.trim() || null,
        address: payload.address?.trim() || null,
        company_name: payload.company_name?.trim() || null,
        user_id: userId,
      })
      .select()
      .maybeSingle();

    if (error || !inserted) throw error;

    const tenantId = inserted.id;
    const updates: Partial<TenantRecord> = {};

    if (payload.files.profile?.file)
      updates.profile_photo_url = (
        await uploadFile(
          userId,
          tenantId,
          'profile_photo',
          payload.files.profile.file,
        )
      ).publicUrl;

    if (payload.files.pan?.file)
      updates.pan_card_url = (
        await uploadFile(userId, tenantId, 'pan_card', payload.files.pan.file)
      ).publicUrl;

    if (payload.files.adhar?.file)
      updates.adhar_card_url = (
        await uploadFile(
          userId,
          tenantId,
          'adhar_card',
          payload.files.adhar.file,
        )
      ).publicUrl;

    if (payload.files.agreement?.file)
      updates.agreement_url = (
        await uploadFile(
          userId,
          tenantId,
          'agreement',
          payload.files.agreement.file,
        )
      ).publicUrl;

    if (Object.keys(updates).length) {
      const { data, error: updErr } = await supabase
        .from('tenant')
        .update(updates)
        .eq('id', tenantId)
        .select()
        .maybeSingle();
      if (updErr) throw updErr;
      return data as TenantRecord;
    }

    return inserted as TenantRecord;
  }

  /* ---------- EDIT (WITH ROLLBACK) ---------- */
  const tenantId = payload.id;
  const uploadedPaths: string[] = [];

  try {
    let profileUrl = payload.files.profile?.url ?? null;
    let panUrl = payload.files.pan?.url ?? null;
    let adharUrl = payload.files.adhar?.url ?? null;
    let agreementUrl = payload.files.agreement?.url ?? null;

    if (payload.files.profile?.file) {
      const u = await uploadFile(
        userId,
        tenantId,
        'profile_photo',
        payload.files.profile.file,
      );
      uploadedPaths.push(u.path);
      profileUrl = u.publicUrl;
    }

    if (payload.files.pan?.file) {
      const u = await uploadFile(
        userId,
        tenantId,
        'pan_card',
        payload.files.pan.file,
      );
      uploadedPaths.push(u.path);
      panUrl = u.publicUrl;
    }

    if (payload.files.adhar?.file) {
      const u = await uploadFile(
        userId,
        tenantId,
        'adhar_card',
        payload.files.adhar.file,
      );
      uploadedPaths.push(u.path);
      adharUrl = u.publicUrl;
    }

    if (payload.files.agreement?.file) {
      const u = await uploadFile(
        userId,
        tenantId,
        'agreement',
        payload.files.agreement.file,
      );
      uploadedPaths.push(u.path);
      agreementUrl = u.publicUrl;
    }

    const { data, error } = await supabase
      .from('tenant')
      .update({
        name: payload.name.trim(),
        mobile: payload.mobile.trim(),
        alternate_mobile: payload.alternate_mobile?.trim() || null,
        total_family_members: payload.total_family_members?.trim() || null,
        address: payload.address?.trim() || null,
        company_name: payload.company_name?.trim() || null,
        profile_photo_url: profileUrl,
        pan_card_url: panUrl,
        adhar_card_url: adharUrl,
        agreement_url: agreementUrl,
        modified_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data as TenantRecord;
  } catch (err) {
    // 🔥 ROLLBACK uploaded files
    if (uploadedPaths.length) {
      await supabase.storage.from(BUCKET).remove(uploadedPaths);
    }
    throw err;
  }
};

/* ===================== DELETE ===================== */

const deleteTenant = async (tenantId: number) => {
  const userId = await getCurrentUserId();
  const existing = await fetchTenantById(tenantId);

  const { error } = await supabase
    .from('tenant')
    .delete()
    .eq('id', tenantId)
    .eq('user_id', userId);

  if (error) throw error;

  if (existing) {
    await Promise.all([
      deleteFileByUrl(existing.profile_photo_url),
      deleteFileByUrl(existing.pan_card_url),
      deleteFileByUrl(existing.adhar_card_url),
      deleteFileByUrl(existing.agreement_url),
    ]);
  }
};

/* ===================== EXPORTS ===================== */

export {
  getCurrentUserId,
  fetchTenants,
  fetchTenantById,
  saveTenant,
  deleteTenant,
  uploadFile,
  deleteFileByUrl,
};
