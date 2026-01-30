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
  FAB,
  Icon,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { fetchBills, BillRecord } from '../../service/BillService';
import { fetchRooms } from '../../service/RoomService';
import { fetchTenants, TenantRecord } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';

const formatMoney = (n?: number | null) => {
  const v = Math.round(Number(n || 0));
  try {
    // Indian grouping for readability: 12,34,567
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)}`;
  } catch {
    // Fallback if Intl is unavailable
    return `₹${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};
const formatMoneyCompact = (n?: number | null) => {
  const v = Math.round(Number(n || 0));
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (v >= 1e7) return `₹${trim((v / 1e7).toFixed(1))}Cr`;
  if (v >= 1e5) return `₹${trim((v / 1e5).toFixed(1))}L`;
  if (v >= 1e3) return `₹${trim((v / 1e3).toFixed(1))}k`;
  return `₹${v}`;
};
const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

const AVATAR_SIZE = 58;

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [bills, setBills] = React.useState<BillRecord[]>([]);
  const [tenantNameById, setTenantNameById] = React.useState<Record<number, string>>({});
  const [roomNameById, setRoomNameById] = React.useState<Record<number, string>>({});
  const [tenantPhotoById, setTenantPhotoById] = React.useState<Record<number, string>>({});

  // same approach as Tenant list screen (signed URLs for private bucket)
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

  const generateSignedUrls = async (tenants: TenantRecord[], billRows: BillRecord[]) => {
    const usedTenantIds = new Set<number>();
    (billRows || []).forEach((b) => {
      if (b.tenant_id != null) usedTenantIds.add(b.tenant_id);
    });

    const map: Record<number, string> = {};
    await Promise.all(
      (tenants || [])
        .filter((t) => usedTenantIds.has(t.id))
        .map(async (t) => {
          const signed = await createSignedUrl((t as any).profile_photo_url);
          if (signed) map[t.id] = signed;
        }),
    );
    setTenantPhotoById(map);
  };

  const load = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setInitialLoading(true);

      const [billRows, rooms, tenants] = await Promise.all([
        fetchBills(),
        fetchRooms(),
        fetchTenants(),
      ]);

      const roomMap: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomMap[r.id] = r.name || '-';
      });
      const tenantMap: Record<number, string> = {};
      (tenants || []).forEach((t: any) => {
        if (t?.id != null) tenantMap[t.id] = t.name || '-';
      });

      setRoomNameById(roomMap);
      setTenantNameById(tenantMap);
      setBills(billRows || []);
      generateSignedUrls((tenants || []) as any, (billRows || []) as any);
    } catch (e: any) {
      Alert.alert('Load Failed', e.message || 'Could not load payments');
    } finally {
      isRefresh ? setRefreshing(false) : setInitialLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  const renderItem = ({ item }: { item: BillRecord }) => (
    <PaymentCard
      item={item}
      roomName={item.room_id != null ? roomNameById[item.room_id] : '-'}
      tenantName={item.tenant_id != null ? tenantNameById[item.tenant_id] : '-'}
      photoUrl={item.tenant_id != null ? tenantPhotoById[item.tenant_id] : undefined}
      onRecord={() => navigation.navigate('PaymentView', { billId: item.id, openRecordPayment: true })}
      onPress={() => navigation.navigate('PaymentView', { billId: item.id })}
      theme={theme}
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
          data={bills}
          renderItem={renderItem}
          keyExtractor={(i) => i.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
          }
        />
      )}

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('PaymentForm')}
      />
    </View>
  );
}

const PaymentCard = ({
  item,
  roomName,
  tenantName,
  photoUrl,
  onRecord,
  onPress,
  theme,
}: {
  item: BillRecord;
  roomName: string;
  tenantName: string;
  photoUrl?: string;
  onRecord: () => void;
  onPress: () => void;
  theme: any;
}) => (
  <Surface style={styles.card} elevation={2}>
    <View style={styles.cardClip}>
      <TouchableOpacity style={styles.cardContent} activeOpacity={0.85} onPress={onPress}>
        <AvatarDisplay uri={photoUrl} size={AVATAR_SIZE} />

        <View style={styles.cardBody}>
          {(() => {
            const total = Number(item.total_amount || 0);
            const paid = Number(item.paid_amount || 0);
            const pending = Math.max(0, total - paid);
            const status = (item.status || '-').toUpperCase();
            const statusTone =
              status === 'PAID'
                ? { bg: '#ECFDF3', border: '#86EFAC', text: '#16A34A' }
                : status === 'PARTIAL'
                  ? { bg: '#FFF7ED', border: '#FDBA74', text: '#F97316' }
                  : { bg: '#FFF5F5', border: '#FECACA', text: '#EF4444' };

            return (
              <>
                <View style={styles.titleRow}>
                  <Text variant="titleMedium" style={styles.cardTitle} numberOfLines={1}>
                    {tenantName}
                  </Text>
                  <Text
                    style={[styles.totalTopRight, { color: theme.colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatMoney(total)}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaLeft}>
                    <View style={styles.roomRow}>
                      <Icon source="home-city-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.roomText} numberOfLines={1}>
                        {roomName}
                      </Text>
                    </View>
                    <View style={styles.issuedRow}>
                      <Icon source="calendar" size={14} color="#6B7280" />
                      <Text style={styles.dateText} numberOfLines={1}>
                        {formatDate(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metaRight}>
                    <View style={styles.recordStatusRow}>
                      <View
                        style={[styles.statusPill, { backgroundColor: statusTone.bg, borderColor: statusTone.border }]}
                      >
                        <Text
                          style={[styles.statusPillText, { color: statusTone.text }]}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.85}
                        >
                          {status}
                        </Text>
                      </View>

                      <TouchableRipple
                        onPress={onRecord}
                        borderless
                        disabled={pending <= 0}
                        style={[
                          styles.statusActionBtn,
                          {
                            backgroundColor: theme.colors.primaryContainer,
                            borderColor: theme.colors.primary,
                            opacity: pending > 0 ? 1 : 0.4,
                          },
                        ]}
                      >
                        <View style={styles.statusActionBtnInner}>
                          <Icon source="cash-plus" size={16} color={theme.colors.primary} />
                        </View>
                      </TouchableRipple>
                    </View>
                  </View>
                </View>
              </>
            );
          })()}
        </View>
      </TouchableOpacity>
    </View>
  </Surface>
);

const AvatarDisplay = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? <Avatar.Image size={size} source={{ uri }} /> : <Avatar.Icon size={size} icon="account" />;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  listContent: { padding: 16, paddingBottom: 120 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    borderRadius: 16,
    marginBottom: 12,
  },
  cardClip: { borderRadius: 16, overflow: 'hidden' },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 12,
  },
  cardBody: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  // ~10% typography bump for readability
  cardTitle: { fontWeight: '700', flex: 1, fontSize: 18 },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLeft: { flex: 1, minWidth: 0 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  roomText: { color: '#555', fontWeight: '700', flex: 1, fontSize: 15 },
  issuedRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: '#777', fontSize: 13, fontWeight: '700' },
  metaRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  recordStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  statusPill: {
    width: 86,
    height: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: { fontWeight: '900', fontSize: 12, letterSpacing: 0.4, textAlign: 'center' },
  statusActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusActionBtnInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  totalTopRight: {
    fontWeight: '900',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    maxWidth: 120,
    textAlign: 'right',
  },

  fab: { position: 'absolute', right: 16, bottom: 24 },
});

