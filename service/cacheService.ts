/* ===================== CACHE SERVICE ===================== */
// Centralized cache management for all services (tenants, rooms, bills, dashboard, etc.)

import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry<T> = { data: T; timestamp: number };

interface CacheStore {
  tenants: CacheEntry<any> | null;
  rooms: CacheEntry<any> | null;
  activeTenantsByRooms: CacheEntry<any> | null;
  bills: CacheEntry<any> | null;
  dashboard: CacheEntry<any> | null;
  tenantRoomAssignments: CacheEntry<any> | null;
  settings: CacheEntry<any> | null;
}

type CacheKey = keyof CacheStore;

const CACHE_KEYS: CacheKey[] = [
  'tenants',
  'rooms',
  'activeTenantsByRooms',
  'bills',
  'dashboard',
  'tenantRoomAssignments',
  'settings',
];

const createEmptyCache = (): CacheStore => ({
  tenants: null,
  rooms: null,
  activeTenantsByRooms: null,
  bills: null,
  dashboard: null,
  tenantRoomAssignments: null,
  settings: null,
});

const cache: CacheStore = createEmptyCache();

const CACHE_DURATION_MS = 10 * 24 * 60 * 60 * 1000; // 10 days
const CACHE_STORAGE_PREFIX = 'tenant_manager_cache_v1';

let cacheScope = 'guest';

const getStorageKey = (scope: string) => `${CACHE_STORAGE_PREFIX}:${scope}`;

const isCacheEntry = (value: any): value is CacheEntry<any> => {
  return !!value && typeof value.timestamp === 'number' && 'data' in value;
};

const normalizeCacheStore = (raw: any): CacheStore => {
  const next = createEmptyCache();
  CACHE_KEYS.forEach(key => {
    const entry = raw?.[key];
    next[key] = isCacheEntry(entry) ? entry : null;
  });
  return next;
};

const persistCache = async () => {
  try {
    await AsyncStorage.setItem(getStorageKey(cacheScope), JSON.stringify(cache));
  } catch (err) {
    console.warn('[cache] Persist failed:', err);
  }
};

const resetMemoryCache = () => {
  CACHE_KEYS.forEach(key => {
    cache[key] = null;
  });
};

const initCacheForUser = async (userId?: string | null): Promise<void> => {
  const nextScope = userId || 'guest';
  cacheScope = nextScope;

  try {
    resetMemoryCache();
    const raw = await AsyncStorage.getItem(getStorageKey(nextScope));
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const hydrated = normalizeCacheStore(parsed);
    CACHE_KEYS.forEach(key => {
      cache[key] = hydrated[key];
    });
  } catch (err) {
    console.warn('[cache] Hydration failed:', err);
  }
};

const isCacheValid = (entry: CacheEntry<any> | null): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_DURATION_MS;
};

const getCachedData = <T>(key: CacheKey): T | null => {
  const entry = cache[key] as CacheEntry<T> | null;
  return isCacheValid(entry) ? entry?.data ?? null : null;
};

const setCached = <T>(key: CacheKey, data: T): void => {
  cache[key] = { data, timestamp: Date.now() };
  void persistCache();
};

const invalidateCache = (keys: CacheKey[]): void => {
  keys.forEach(key => {
    cache[key] = null;
  });
  void persistCache();
  console.log('[cache] Invalidated:', keys);
};

export { getCachedData, setCached, invalidateCache, isCacheValid, initCacheForUser };
