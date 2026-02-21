import supabase from './SupabaseClient';

const DEFAULT_BUCKET = 'tenant-manager';

export async function getSignedUrl(
  fullUrl?: string | null,
  opts?: { bucket?: string; expiresInSec?: number },
): Promise<string | undefined> {
  if (!fullUrl) return undefined;

  const bucket = opts?.bucket ?? DEFAULT_BUCKET;
  const marker = `/${bucket}/`;
  const idx = fullUrl.indexOf(marker);
  if (idx === -1) return undefined;

  const filePath = fullUrl.substring(idx + marker.length);
  const expiresInSec = opts?.expiresInSec ?? 60 * 60;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

