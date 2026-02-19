import { QueryClient } from '@tanstack/react-query';

// Central query client for caching/deduping Supabase reads.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid refetch storms when navigating between screens quickly.
      staleTime: 30 * 1000, // 30s
      gcTime: 10 * 60 * 1000, // 10m
      retry: 1,
    },
  },
});

