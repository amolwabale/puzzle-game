import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  FAB,
  Surface,
  Text,
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
import supabase from '../../service/SupabaseClient';

type Nav = NativeStackNavigationProp<RoomStackParamList, 'RoomList'>;

const ICON_SIZE = 48;
const DIVIDER_HEIGHT = ICON_SIZE;
// Slightly smaller than the home icon (48) to keep breathing room.
const OCCUPANT_AVATAR_SIZE = 44;

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

const createSignedUrl = async (fullUrl?: string | null) => {
  if (!fullUrl) return undefined;
  const marker = '/tenant-manager/';
  const index = fullUrl.indexOf(marker);
  if (index === -1) return undefined;
  const filePath = fullUrl.substring(index + marker.length);

  const { data, error } = await supabase.storage
    .from('tenant-manager')
    .createSignedUrl(filePath, 60 * 60);

  if (error) return undefined;
  return data.signedUrl;
};

export default function RoomScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [rooms, setRooms] = React.useState<RoomRecord[]>([]);
  const [activeByRoom, setActiveByRoom] = React.useState<
    Record<number, TenantRoomRecord | null>
  >({});
  const [occupantPhotoByRoom, setOccupantPhotoByRoom] = React.useState<
    Record<number, string>
  >({});

  const loadRooms = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setInitialLoading(true);
      const data = await fetchRooms();
      setRooms(data || []);

      // Load occupant (active tenant) for each room in one call
      const map = await fetchActiveTenantsForRooms((data || []).map(r => r.id));
      setActiveByRoom(map);

      // Signed URLs for occupant profile photos
      const photoMap: Record<number, string> = {};
      await Promise.all(
        Object.entries(map).map(async ([roomIdStr, occ]) => {
          if (!occ) return;
          const roomId = Number(roomIdStr);
          const fullUrl = (occ.tenant as any)?.profile_photo_url as
            | string
            | null
            | undefined;
          const signed = await createSignedUrl(fullUrl);
          if (signed) photoMap[roomId] = signed;
        }),
      );
      setOccupantPhotoByRoom(photoMap);
    } catch (err: any) {
      Alert.alert('Load Failed', err.message || 'Could not load rooms');
    } finally {
      isRefresh ? setRefreshing(false) : setInitialLoading(false);
    }
  }, []);

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
      onView={() => navigation.navigate('RoomView', { roomId: item.id })}
      onEdit={() =>
        navigation.navigate('RoomForm', { roomId: item.id, mode: 'edit' })
      }
      onDelete={() => void handleDelete(item.id)}
    />
  );

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
          data={rooms}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
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
        onPress={() => navigation.navigate('RoomForm', { mode: 'add' })}
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
      <TouchableOpacity
        style={styles.cardContent}
        activeOpacity={0.85}
        onPress={onView}
      >
        <View style={styles.leadingColumn}>
          <View
            style={[
              styles.leadingIcon,
              { backgroundColor: themeColors.primaryContainer },
            ]}
          >
            <Avatar.Icon
              size={ICON_SIZE}
              icon="home-outline"
              style={{ backgroundColor: 'transparent' }}
              color={themeColors.primary}
            />
          </View>

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
                style={{ backgroundColor: '#EDEFF5' }}
                color="#5B6475"
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

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: occupant
                    ? themeColors.secondaryContainer
                    : '#EDEFF5',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: occupant ? themeColors.secondary : '#5B6475' },
                ]}
              >
                {occupant ? 'Occupied' : 'Vacant'}
              </Text>
            </View>
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
      </TouchableOpacity>

      {/* ACTION RAIL */}
      <View style={styles.actionRail}>
        <TouchableOpacity style={styles.editAction} onPress={onEdit}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteAction} onPress={onDelete}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
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

  card: {
    borderRadius: 16,
    marginBottom: 12,
  },

  // Keep shadows on Surface; clip inside wrapper instead.
  cardClip: {
    flexDirection: 'row',
    borderRadius: 16,
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'flex-start',
  },

  leadingColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
  leadingIcon: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  occupantAvatarWrap: {
    marginTop: 8,
    borderRadius: 999,
    padding: 1,
    backgroundColor: '#FFFFFF',
    // subtle outline effect without hard border
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  cardBody: { flex: 1, paddingTop: 2 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  // ~10% typography bump for readability
  cardTitle: { fontWeight: '700', flex: 1, fontSize: 18 },
  metaBlock: { marginTop: 6, gap: 2 },
  cardSubtitle: { color: '#555', fontSize: 14, fontWeight: '600' },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
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
    marginTop: 10,
  },
  occupantName: {
    fontWeight: '700',
    color: '#1F2937',
    fontSize: 16,
  },
  occupantMeta: {
    color: '#666',
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ACTION RAIL */
  actionRail: {
    width: 72,
    backgroundColor: '#EEF2FF',
    justifyContent: 'space-between',
  },

  editAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  deleteAction: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
  },

  editText: {
    fontWeight: '600',
    color: '#1A73E8',
    fontSize: 14,
  },

  deleteText: {
    fontWeight: '600',
    color: '#D32F2F',
    fontSize: 14,
  },

  fab: { position: 'absolute', right: 16, bottom: 24 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: { marginBottom: 16, backgroundColor: '#E0E0E0' },
  emptyTitle: { fontWeight: '600', marginBottom: 6, fontSize: 18 },
  emptySubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
});
