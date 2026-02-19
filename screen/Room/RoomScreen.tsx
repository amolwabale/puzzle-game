import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Chip,
  FAB,
  Icon,
  Searchbar,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RoomStackParamList } from '../../navigation/StackParam';
import { deleteRoom, fetchRooms, RoomRecord } from '../../service/RoomService';
import {
  fetchActiveTenantsForRooms,
  hasAnyTenantMappingForRoom,
  TenantRoomRecord,
} from '../../service/TenantRoomService';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';
import { useQueryClient } from '@tanstack/react-query';
import { getSignedUrlCached } from '../../service/signedUrlCache';

type Nav = NativeStackNavigationProp<RoomStackParamList, 'RoomList'>;

// Avatar size for occupant (active tenant)
// Match Tenant list avatar size for consistency.
const OCCUPANT_AVATAR_SIZE = 58;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

const formatMoney = (n?: number | string | null) => {
  const v = Math.round(Number(n || 0));
  try {
    return `₹${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(v)}`;
  } catch {
    return `₹${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

const formatMoneyCompact = (n?: number | string | null) => {
  const v = Math.round(Number(n || 0));
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (v >= 1e7) return `₹${trim((v / 1e7).toFixed(1))}Cr`;
  if (v >= 1e5) return `₹${trim((v / 1e5).toFixed(1))}L`;
  if (v >= 1e3) return `₹${trim((v / 1e3).toFixed(1))}k`;
  return `₹${v}`;
};

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'T';
  return parts.map(p => p[0]?.toUpperCase()).join('');
};

export default function RoomScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [rooms, setRooms] = React.useState<RoomRecord[]>([]);
  const [query, setQuery] = React.useState('');
  const [roomFilter, setRoomFilter] = React.useState<
    'ALL' | 'OCCUPIED' | 'VACANT'
  >('ALL');
  const [activeByRoom, setActiveByRoom] = React.useState<
    Record<number, TenantRoomRecord | null>
  >({});
  const [occupantPhotoByRoom, setOccupantPhotoByRoom] = React.useState<
    Record<number, string>
  >({});

  const loadRooms = React.useCallback(async (isRefresh = false) => {
    const roomsKey = ['rooms'];

    if (!isRefresh) {
      const cachedRooms = queryClient.getQueryData<RoomRecord[]>(roomsKey);
      if (cachedRooms && cachedRooms.length > 0) {
        setRooms(cachedRooms);
        setInitialLoading(false);
      }
    }

    try {
      if (isRefresh) setRefreshing(true);
      else {
        const hasCache = !!queryClient.getQueryData(roomsKey);
        if (!hasCache) setInitialLoading(true);
      }

      const data = await queryClient.fetchQuery({
        queryKey: roomsKey,
        queryFn: fetchRooms,
        staleTime: isRefresh ? 0 : undefined,
      });
      setRooms(data || []);

      // Load occupant (active tenant) for each room in one call
      const map = await fetchActiveTenantsForRooms((data || []).map(r => r.id));
      setActiveByRoom(map);
      // Photo signed URLs are now generated lazily per visible row.
    } catch (err: any) {
      Alert.alert('Load Failed', err.message || 'Could not load rooms');
    } finally {
      if (isRefresh) setRefreshing(false);
      else {
        setInitialLoading(false);
      }
    }
  }, [queryClient]);

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const ensureVisibleOccupantPhotos = React.useCallback(
    async (roomIds: number[]) => {
      const active = activeByRoom || {};
      await Promise.all(
        (roomIds || []).map(async roomId => {
          if (occupantPhotoByRoom[roomId]) return;
          const occ = active[roomId];
          const fullUrl = (occ?.tenant as any)?.profile_photo_url as
            | string
            | null
            | undefined;
          if (!fullUrl) return;
          const signed = await getSignedUrlCached(queryClient, fullUrl).catch(
            () => undefined,
          );
          if (!signed) return;
          setOccupantPhotoByRoom(prev =>
            prev[roomId] === signed ? prev : { ...prev, [roomId]: signed },
          );
        }),
      );
    },
    [activeByRoom, occupantPhotoByRoom, queryClient],
  );

  const ensureVisibleOccupantPhotosRef = React.useRef(ensureVisibleOccupantPhotos);
  React.useEffect(() => {
    ensureVisibleOccupantPhotosRef.current = ensureVisibleOccupantPhotos;
  }, [ensureVisibleOccupantPhotos]);

  const onViewableItemsChanged = React.useRef(
    ({ viewableItems }: any) => {
      const ids = (viewableItems || [])
        .map((v: any) => v?.item?.id)
        .filter((x: any) => typeof x === 'number');
      if (ids.length > 0) void ensureVisibleOccupantPhotosRef.current(ids);
    },
  ).current;

  useFocusEffect(
    React.useCallback(() => {
      loadRooms(false);
    }, [loadRooms]),
  );

  const handleDelete = async (id: number) => {
    try {
      const hasMapping = await hasAnyTenantMappingForRoom(id);
      if (hasMapping) {
        Alert.alert(
          'Cannot delete room',
          'This room has tenant assignment history. Remove/clear tenant mapping before deleting the room.',
        );
        return;
      }
    } catch (err: any) {
      Alert.alert(
        'Delete check failed',
        err?.message || 'Could not validate room occupancy',
      );
      return;
    }

    Alert.alert('Delete Room', 'Are you sure you want to delete this room?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setRefreshing(true);
            await deleteRoom(id);
            await loadRooms(true);
            trackEvent('Room_Deleted', {
              source: 'Room',
              room_id: id,
            });
          } finally {
            setRefreshing(false);
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: RoomRecord }) => (
    <RoomCard
      item={item}
      occupant={activeByRoom[item.id]}
      occupantPhotoUrl={occupantPhotoByRoom[item.id]}
      themeColors={{
        primary: theme.colors.primary,
        primaryContainer: theme.colors.primaryContainer,
        secondary: theme.colors.secondary,
        secondaryContainer: theme.colors.secondaryContainer,
      }}
      onView={() => {
        trackEvent('Navigation_RoomList_To_RoomView', {
          source: 'Room',
          room_id: item.id,
        });
        navigation.navigate('RoomView', { roomId: item.id });
      }}
      onEdit={() => {
        trackEvent('Navigation_RoomList_To_RoomEdit', {
          source: 'Room',
          room_id: item.id,
        });
        navigation.navigate('RoomForm', { roomId: item.id, mode: 'edit' });
      }}
      onDelete={() => void handleDelete(item.id)}
    />
  );

  const baseRooms = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return (rooms || []).filter(r =>
      String(r?.name || '')
        .toLowerCase()
        .includes(q),
    );
  }, [rooms, query]);

  const occupiedCount = React.useMemo(() => {
    return (baseRooms || []).reduce(
      (acc, r) => (activeByRoom[r.id] ? acc + 1 : acc),
      0,
    );
  }, [baseRooms, activeByRoom]);
  const vacantCount = (baseRooms?.length || 0) - occupiedCount;

  const visibleRooms = React.useMemo(() => {
    if (roomFilter === 'ALL') return baseRooms;
    if (roomFilter === 'OCCUPIED')
      return (baseRooms || []).filter(r => !!activeByRoom[r.id]);
    return (baseRooms || []).filter(r => !activeByRoom[r.id]);
  }, [baseRooms, roomFilter, activeByRoom]);

  return (
    <View style={styles.container}>
      {initialLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      ) : rooms.length === 0 ? (
        <EmptyState
          onAdd={() => navigation.navigate('RoomForm', { mode: 'add' })}
        />
      ) : (
        <FlatList
          data={visibleRooms}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Searchbar
                placeholder="Search rooms"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                style={styles.search}
                inputStyle={styles.searchInput}
              />
              <View style={styles.pillRow}>
                <Chip
                  selected={roomFilter === 'ALL'}
                  onPress={() => setRoomFilter('ALL')}
                  icon="apps"
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        roomFilter === 'ALL'
                          ? theme.colors.primaryContainer
                          : '#FFFFFF',
                      borderColor:
                        roomFilter === 'ALL' ? theme.colors.primary : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    {
                      color:
                        roomFilter === 'ALL' ? theme.colors.primary : '#6B7280',
                    },
                  ]}
                >
                  All {baseRooms.length}
                </Chip>
                <Chip
                  selected={roomFilter === 'OCCUPIED'}
                  onPress={() => setRoomFilter('OCCUPIED')}
                  icon="account-check-outline"
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        roomFilter === 'OCCUPIED'
                          ? theme.colors.secondaryContainer
                          : '#FFFFFF',
                      borderColor:
                        roomFilter === 'OCCUPIED'
                          ? theme.colors.secondary
                          : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    {
                      color:
                        roomFilter === 'OCCUPIED'
                          ? theme.colors.secondary
                          : '#6B7280',
                    },
                  ]}
                >
                  Occupied {occupiedCount}
                </Chip>
                <Chip
                  selected={roomFilter === 'VACANT'}
                  onPress={() => setRoomFilter('VACANT')}
                  icon="account-off-outline"
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        roomFilter === 'VACANT' ? '#F3F4F6' : '#FFFFFF',
                      borderColor: '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    { color: roomFilter === 'VACANT' ? '#111827' : '#6B7280' },
                  ]}
                >
                  Vacant {vacantCount}
                </Chip>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                No rooms match your search/filter.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadRooms(true)}
            />
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => {
          trackEvent('Navigation_RoomList_To_RoomAdd', {
            source: 'Room',
            mode: 'Add',
          });
          navigation.navigate('RoomForm', { mode: 'add' });
        }}
      />
    </View>
  );
}

/* ---------------- CARD ---------------- */

const RoomCard = ({
  item,
  occupant,
  occupantPhotoUrl,
  themeColors,
  onView,
  onEdit,
  onDelete,
}: {
  item: RoomRecord;
  occupant: TenantRoomRecord | null | undefined;
  occupantPhotoUrl?: string;
  themeColors: {
    primary: string;
    primaryContainer: string;
    secondary: string;
    secondaryContainer: string;
  };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <Surface style={styles.card} elevation={2}>
    <View style={styles.cardClip}>
      <TouchableRipple onPress={onView} style={styles.cardContent} borderless>
        {/* TouchableRipple expects exactly one child element */}
        <View style={styles.cardContentInner}>
          <View style={styles.leadingColumn}>
            <View style={styles.occupantAvatarWrap}>
              {occupant ? (
                occupantPhotoUrl ? (
                  <Avatar.Image
                    size={OCCUPANT_AVATAR_SIZE}
                    source={{ uri: occupantPhotoUrl }}
                  />
                ) : (
                  <Avatar.Text
                    size={OCCUPANT_AVATAR_SIZE}
                    label={getInitials(occupant.tenant?.name)}
                    style={{ backgroundColor: themeColors.secondaryContainer }}
                    color={themeColors.secondary}
                  />
                )
              ) : (
                <Avatar.Icon
                  size={OCCUPANT_AVATAR_SIZE}
                  icon="account-off-outline"
                  style={{ backgroundColor: '#F3F4F6' }}
                  color="#6B7280"
                />
              )}
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.titleRow}>
              <Text
                variant="titleMedium"
                style={styles.cardTitle}
                numberOfLines={1}
              >
                {item.name || '-'}
              </Text>
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                Rent: {formatMoney(item.rent)} | Deposit:{' '}
                {formatMoneyCompact(item.deposit)}
              </Text>
            </View>

            {occupant ? (
              <View style={styles.occupantBlock}>
                <Text style={styles.occupantName} numberOfLines={1}>
                  {occupant.tenant?.name || 'Tenant'}
                </Text>
                <Text style={styles.occupantMeta} numberOfLines={1}>
                  Joined on {formatDate(occupant.joining_date)}
                </Text>
              </View>
            ) : (
              <View style={styles.occupantBlock}>
                <Text style={styles.occupantMeta} numberOfLines={1}>
                  No tenant assigned
                </Text>
              </View>
            )}
          </View>

          {/* Right-side vertical actions (top→bottom): occupancy, edit, delete */}
          <View style={styles.rightIconCol}>
            <TouchableRipple
              onPress={onEdit}
              borderless
              style={[
                styles.iconPill,
                styles.iconPillSm,
                {
                  backgroundColor: themeColors.primaryContainer,
                  borderColor: themeColors.primary,
                },
              ]}
            >
              <Icon
                source="pencil-outline"
                size={16}
                color={themeColors.primary}
              />
            </TouchableRipple>

            <TouchableRipple
              onPress={onDelete}
              borderless
              style={[
                styles.iconPill,
                styles.iconPillSm,
                { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
              ]}
            >
              <Icon source="trash-can-outline" size={16} color="#EF4444" />
            </TouchableRipple>
          </View>
        </View>
      </TouchableRipple>
    </View>
  </Surface>
);

/* ---------------- EMPTY ---------------- */

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <View style={styles.emptyState}>
    <Avatar.Icon size={72} icon="home-outline" style={styles.emptyIcon} />
    <Text variant="titleMedium" style={styles.emptyTitle}>
      No rooms yet
    </Text>
    <Text style={styles.emptySubtitle}>
      Add rooms to manage rent, deposits and details.
    </Text>
    <Button mode="contained" onPress={onAdd}>
      Add Room
    </Button>
  </View>
);

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  listContent: { padding: 16, paddingBottom: 120 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listHeader: { marginBottom: 12 },
  search: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { fontSize: 15, fontWeight: '800' },
  pillRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  pill: { borderRadius: 999, borderWidth: 1 },
  pillText: { fontWeight: '900', fontSize: 13 },
  noResults: { paddingVertical: 18, alignItems: 'center' },
  noResultsText: { color: '#6B7280', fontWeight: '800' },

  card: {
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Keep shadows on Surface; clip inside wrapper instead.
  cardClip: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardContentInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  leadingColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
  occupantAvatarWrap: {
    borderRadius: 999,
    padding: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  cardBody: { flex: 1, paddingTop: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { fontWeight: '900', flex: 1, fontSize: 16, color: '#111827' },
  metaBlock: { marginTop: 4 },
  cardSubtitle: { color: '#6B7280', fontSize: 13, fontWeight: '800' },

  rightIconCol: {
    width: 44,
    marginLeft: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 0,
  },
  iconPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPillSm: {
    width: 34,
    height: 34,
  },

  occupantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  occupantText: {
    flex: 1,
    marginLeft: 6,
    color: '#666',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },

  occupantBlock: {
    marginTop: 8,
  },
  occupantName: {
    fontWeight: '900',
    color: '#111827',
    fontSize: 14,
  },
  occupantMeta: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
  },

  // Action rail removed in favor of compact icon buttons on the right.

  fab: { position: 'absolute', right: 16, bottom: 24 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: { marginBottom: 16, backgroundColor: '#E0E0E0' },
  emptyTitle: {
    fontWeight: '900',
    marginBottom: 6,
    fontSize: 16,
    color: '#111827',
  },
  emptySubtitle: {
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
    fontWeight: '800',
  },
});
