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
  FAB,
  Icon,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TenantStackParamList } from '../../navigation/StackParam';
import {
  deleteTenant,
  fetchTenants,
  TenantRecord,
} from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';
import { fetchRooms } from '../../service/RoomService';
import { fetchActiveRoomForTenants } from '../../service/TenantRoomService';

type Nav = NativeStackNavigationProp<TenantStackParamList, 'TenantList'>;

// Match Payment list avatar size for consistency.
const AVATAR_SIZE = 58;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export default function TenantScreen() {
  const navigation = useNavigation<Nav>();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [tenants, setTenants] = React.useState<TenantRecord[]>([]);
  const [signedUrls, setSignedUrls] = React.useState<Record<number, string>>(
    {},
  );
  const [assignmentByTenant, setAssignmentByTenant] = React.useState<
    Record<number, { roomName?: string; joiningDate?: string } | null>
  >({});

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

  const loadTenants = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setInitialLoading(true);
      const data = await fetchTenants();
      setTenants(data || []);
      generateSignedUrls(data || []);

      // room assignment for each tenant (active mapping = leaving_date is null)
      const tenantIds = (data || []).map(t => t.id);
      const [rooms, activeMap] = await Promise.all([
        fetchRooms(),
        fetchActiveRoomForTenants(tenantIds),
      ]);

      const roomNameById: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomNameById[r.id] = r.name || '-';
      });

      const viewMap: Record<
        number,
        { roomName?: string; joiningDate?: string } | null
      > = {};
      tenantIds.forEach(id => {
        const a = activeMap?.[id];
        if (!a) {
          viewMap[id] = null;
          return;
        }
        viewMap[id] = {
          roomName: roomNameById[a.room_id] || '-',
          joiningDate: a.joining_date,
        };
      });
      setAssignmentByTenant(viewMap);
    } finally {
      isRefresh ? setRefreshing(false) : setInitialLoading(false);
    }
  }, []);

  const generateSignedUrls = async (data: TenantRecord[]) => {
    const map: Record<number, string> = {};
    await Promise.all(
      data.map(async t => {
        const signed = await createSignedUrl((t as any).profile_photo_url);
        if (signed) map[t.id] = signed;
      }),
    );
    setSignedUrls(map);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTenants(false);
    }, [loadTenants]),
  );

  const handleDelete = (id: number) => {
    const assignment = assignmentByTenant[id];
    if (assignment) {
      Alert.alert(
        'Cannot delete tenant',
        `This tenant is assigned to ${
          assignment.roomName || 'a room'
        }. Remove the tenant from the room before deleting.`,
      );
      return;
    }
    Alert.alert('Delete Tenant', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTenant(id);
          loadTenants(true);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: TenantRecord }) => (
    <TenantCard
      item={item}
      photoUrl={signedUrls[item.id]}
      assignment={assignmentByTenant[item.id]}
      onView={() => navigation.navigate('TenantView', { tenantId: item.id })}
      onEdit={() =>
        navigation.navigate('TenantForm', { tenantId: item.id, mode: 'edit' })
      }
      onDelete={() => handleDelete(item.id)}
    />
  );

  return (
    <View style={styles.container}>
      {initialLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      ) : tenants.length === 0 ? (
        <EmptyState
          onAdd={() => navigation.navigate('TenantForm', { mode: 'add' })}
        />
      ) : (
        <FlatList
          data={tenants}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTenants(true)}
            />
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('TenantForm', { mode: 'add' })}
      />
    </View>
  );
}

/* ---------------- CARD ---------------- */

const TenantCard = ({
  item,
  photoUrl,
  assignment,
  onView,
  onEdit,
  onDelete,
}: {
  item: TenantRecord;
  photoUrl?: string;
  assignment?: { roomName?: string; joiningDate?: string } | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  return (
    <Surface style={[styles.card, { borderColor: outline }]} elevation={1}>
      <View style={styles.cardClip}>
        <TouchableRipple onPress={onView} style={styles.cardContent} borderless>
          {/* TouchableRipple expects exactly one child element */}
          <View style={styles.cardContentInner}>
            <AvatarDisplay uri={photoUrl} size={AVATAR_SIZE} />

            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name || '-'}
              </Text>
              <Text style={styles.cardSubtitle} numberOfLines={1}>
                Room: {assignment?.roomName ? assignment.roomName : 'Not assigned'}
              </Text>
              <Text style={styles.cardCaption} numberOfLines={1}>
                Joined {assignment?.joiningDate ? formatDate(assignment.joiningDate) : '—'}
              </Text>
            </View>

            {/* Right-side vertical icons (no divider line) */}
            <View style={styles.rightIconCol}>
              <TouchableRipple
                onPress={onEdit}
                borderless
                style={[
                  styles.iconPill,
                  { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary },
                ]}
              >
                <Icon source="pencil-outline" size={16} color={theme.colors.primary} />
              </TouchableRipple>

              <TouchableRipple
                onPress={onDelete}
                borderless
                style={[styles.iconPill, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}
              >
                <Icon source="trash-can-outline" size={16} color={theme.colors.error} />
              </TouchableRipple>
            </View>
          </View>
        </TouchableRipple>
      </View>
    </Surface>
  );
};

const AvatarDisplay = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? (
    <Avatar.Image size={size} source={{ uri }} />
  ) : (
    <Avatar.Icon size={size} icon="account" />
  );

/* ---------------- EMPTY ---------------- */

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <View style={styles.emptyState}>
    <Avatar.Icon
      size={72}
      icon="account-group-outline"
      style={styles.emptyIcon}
    />
    <Text variant="titleMedium" style={styles.emptyTitle}>
      No tenants yet
    </Text>
    <Text style={styles.emptySubtitle}>
      Add tenants to manage occupancy, bills and documents.
    </Text>
    <Button mode="contained" onPress={onAdd}>
      Add Tenant
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },

  // Keep shadows on Surface; clip inside wrapper instead.
  cardClip: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  cardContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardContentInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },

  cardBody: { flex: 1, paddingLeft: 14 },
  // Support-module typography
  cardTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  cardSubtitle: {
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '800',
    fontSize: 13,
  },
  cardCaption: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '800',
  },

  rightIconCol: {
    width: 44,
    marginLeft: 10,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
