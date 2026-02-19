import type { QueryClient } from '@tanstack/react-query';
import supabase from './SupabaseClient';

const DEFAULT_BUCKET = 'tenant-manager';

export async function getSignedUrlCached(
  queryClient: QueryClient,
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

  // Cache signed URLs just under the expiry window.
  const staleTime = Math.max(0, expiresInSec - 5 * 60) * 1000; // 5m buffer

  return await queryClient.fetchQuery({
    queryKey: ['signedUrl', bucket, filePath, expiresInSec],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, expiresInSec);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime,
    gcTime: Math.max(staleTime, 10 * 60 * 1000),
  });
}

