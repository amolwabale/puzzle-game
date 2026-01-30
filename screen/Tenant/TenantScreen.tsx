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
} from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { TenantStackParamList } from '../../navigation/StackParam';
import { deleteTenant, fetchTenants, TenantRecord } from '../../service/tenantService';
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
  const [signedUrls, setSignedUrls] = React.useState<Record<number, string>>({});
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
      const tenantIds = (data || []).map((t) => t.id);
      const [rooms, activeMap] = await Promise.all([
        fetchRooms(),
        fetchActiveRoomForTenants(tenantIds),
      ]);

      const roomNameById: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomNameById[r.id] = r.name || '-';
      });

      const viewMap: Record<number, { roomName?: string; joiningDate?: string } | null> = {};
      tenantIds.forEach((id) => {
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
      data.map(async (t) => {
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
      ) : (
        <FlatList
          data={tenants}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadTenants(true)} />
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
}) => (
  <Surface style={styles.card} elevation={2}>
    <View style={styles.cardClip}>
      <TouchableOpacity style={styles.cardContent} activeOpacity={0.85} onPress={onView}>
        <AvatarDisplay uri={photoUrl} size={AVATAR_SIZE} />

        <View style={styles.cardBody}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            {item.name || '-'}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            Room: {assignment?.roomName ? assignment.roomName : 'Not assigned'}
          </Text>
          <Text style={styles.cardCaption} numberOfLines={1}>
            Joined on:{' '}
            {assignment?.joiningDate ? formatDate(assignment.joiningDate) : 'Not assigned'}
          </Text>
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

const AvatarDisplay = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? <Avatar.Image size={size} source={{ uri }} /> : <Avatar.Icon size={size} icon="account" />;

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
    alignItems: 'center',
  },

  cardBody: { flex: 1, paddingLeft: 14 },
  // ~10% typography bump for readability
  cardTitle: { fontWeight: '700', fontSize: 18 },
  cardSubtitle: { color: '#555', marginTop: 4, fontWeight: '600', fontSize: 15 },
  cardCaption: { color: '#777', fontSize: 13, marginTop: 4, lineHeight: 18 },

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
    fontSize: 14,
    color: '#1A73E8',
  },

  deleteText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#D32F2F',
  },

  fab: { position: 'absolute', right: 16, bottom: 24 },
});
