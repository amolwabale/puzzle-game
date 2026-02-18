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
import {
  fetchBills,
  BillRecord,
  fetchLatestSetting,
} from '../../service/BillService';
import { fetchRooms } from '../../service/RoomService';
import { fetchTenants, TenantRecord } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';
import { fetchUserProfile, type UserProfile } from '../../service/MenuService';
import { trackEvent } from '../../service/analyticsTracker';

type MissingBasicGroup = 'property' | 'profile';
type MissingBasic = {
  key:
    | 'property_name'
    | 'property_address'
    | 'first_name'
    | 'last_name'
    | 'mobile'
    | 'email'
    | 'address';
  label: string;
  group: MissingBasicGroup;
};

const isBlank = (v: unknown) => String(v ?? '').trim().length === 0;

function computeMissingBasics(input: {
  setting?: { property_name?: string | null; property_address?: string | null } | null;
  profile?: UserProfile | null;
}): MissingBasic[] {
  const missing: MissingBasic[] = [];
  const s = input.setting ?? null;
  const p = input.profile ?? null;

  if (!s || isBlank(s.property_name)) {
    missing.push({
      key: 'property_name',
      label: 'Property name',
      group: 'property',
    });
  }
  if (!s || isBlank(s.property_address)) {
    missing.push({
      key: 'property_address',
      label: 'Property address',
      group: 'property',
    });
  }

  if (!p || isBlank(p.first_name)) {
    missing.push({ key: 'first_name', label: 'First name', group: 'profile' });
  }
  if (!p || isBlank(p.last_name)) {
    missing.push({ key: 'last_name', label: 'Last name', group: 'profile' });
  }
  if (!p || isBlank(p.mobile)) {
    missing.push({ key: 'mobile', label: 'Mobile', group: 'profile' });
  }
  if (!p || isBlank(p.email)) {
    missing.push({ key: 'email', label: 'Email', group: 'profile' });
  }
  if (!p || isBlank(p.address)) {
    missing.push({ key: 'address', label: 'Address', group: 'profile' });
  }

  return missing;
}

const formatMoney = (n?: number | null) => {
  const v = Math.round(Number(n || 0));
  try {
    // Indian grouping for readability: 12,34,567
    return `₹${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(v)}`;
  } catch {
    // Fallback if Intl is unavailable
    return `₹${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

const formatMonthYear = (d?: string | null) =>
  d
    ? new Date(d)
        .toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
        .toUpperCase()
    : '-';

const AVATAR_SIZE = 58;

export default function PaymentScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();

  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [bills, setBills] = React.useState<BillRecord[]>([]);
  const [missingBasics, setMissingBasics] = React.useState<MissingBasic[]>([]);
  const [query, setQuery] = React.useState('');
  const [paymentFilter, setPaymentFilter] = React.useState<
    'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL'
  >('ALL');
  const [tenantNameById, setTenantNameById] = React.useState<
    Record<number, string>
  >({});
  const [roomNameById, setRoomNameById] = React.useState<
    Record<number, string>
  >({});
  const [tenantPhotoById, setTenantPhotoById] = React.useState<
    Record<number, string>
  >({});

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

  const generateSignedUrls = async (
    tenants: TenantRecord[],
    billRows: BillRecord[],
  ) => {
    const usedTenantIds = new Set<number>();
    (billRows || []).forEach(b => {
      if (b.tenant_id != null) usedTenantIds.add(b.tenant_id);
    });

    const map: Record<number, string> = {};
    await Promise.all(
      (tenants || [])
        .filter(t => usedTenantIds.has(t.id))
        .map(async t => {
          const signed = await createSignedUrl((t as any).profile_photo_url);
          if (signed) map[t.id] = signed;
        }),
    );
    setTenantPhotoById(map);
  };

  const load = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setInitialLoading(true);

      const [billRows, rooms, tenants, setting, profile] = await Promise.all([
        fetchBills(),
        fetchRooms(),
        fetchTenants(),
        fetchLatestSetting().catch(() => null as any),
        fetchUserProfile().catch(() => null),
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
      setMissingBasics(computeMissingBasics({ setting, profile }));
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

  const baseBills = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bills;
    return (bills || []).filter(b => {
      const tenantName =
        b.tenant_id != null ? tenantNameById[b.tenant_id] : undefined;
      const roomName = b.room_id != null ? roomNameById[b.room_id] : undefined;
      const hay = `${String(tenantName ?? '')} ${String(
        roomName ?? '',
      )}`.toLowerCase();
      return hay.includes(q);
    });
  }, [bills, query, tenantNameById, roomNameById]);

  const normalizeStatus = React.useCallback((b: BillRecord) => {
    const s = String(b.status || 'UNPAID').toUpperCase();
    if (s === 'PAID' || s === 'PARTIAL') return s as 'PAID' | 'PARTIAL';
    return 'UNPAID' as const;
  }, []);

  const counts = React.useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    (baseBills || []).forEach(b => {
      const s = normalizeStatus(b);
      if (s === 'PAID') paid += 1;
      else if (s === 'PARTIAL') partial += 1;
      else unpaid += 1;
    });
    return {
      all: baseBills.length,
      paid,
      partial,
      unpaid,
    };
  }, [baseBills, normalizeStatus]);

  const visibleBills = React.useMemo(() => {
    const filtered =
      paymentFilter === 'ALL'
        ? baseBills
        : (baseBills || []).filter(b => normalizeStatus(b) === paymentFilter);

    const rank: Record<'UNPAID' | 'PARTIAL' | 'PAID', number> = {
      UNPAID: 0,
      PARTIAL: 1,
      PAID: 2,
    };

    // Required ordering:
    // UNPAID (latest first) → PARTIAL (latest first) → PAID (latest first)
    return [...(filtered || [])].sort((a, b) => {
      const sa = normalizeStatus(a);
      const sb = normalizeStatus(b);
      const ra = rank[sa];
      const rb = rank[sb];
      if (ra !== rb) return ra - rb;

      const at = new Date(String((a as any)?.created_at ?? '')).getTime();
      const bt = new Date(String((b as any)?.created_at ?? '')).getTime();
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
      if (Number.isFinite(at) && !Number.isFinite(bt)) return -1;
      if (!Number.isFinite(at) && Number.isFinite(bt)) return 1;

      // Stable fallback.
      return String((b as any)?.id ?? '').localeCompare(String((a as any)?.id ?? ''));
    });
  }, [baseBills, paymentFilter, normalizeStatus]);

  const canAddPayment = missingBasics.length === 0;
  const goToSettings = React.useCallback(() => {
    // PaymentStack -> MainTabs (bottom tabs)
    const tabs = navigation.getParent?.();
    tabs?.navigate?.('Settings');
  }, [navigation]);

  const goToProfile = React.useCallback(() => {
    // PaymentStack -> MainTabs -> RootStack (has MenuTabs)
    const root = navigation.getParent?.()?.getParent?.();
    root?.navigate?.('MenuTabs', { screen: 'MenuProfile' });
  }, [navigation]);

  const showBasicsAlert = React.useCallback(() => {
    Alert.alert(
      'Basic details missing',
      'Please complete Property and Profile details before you can add or record payments.',
      [
        { text: 'Open Settings', onPress: goToSettings },
        { text: 'Open Profile', onPress: goToProfile },
        { text: 'OK', style: 'cancel' },
      ],
    );
  }, [goToProfile, goToSettings]);

  const renderItem = ({ item }: { item: BillRecord }) => (
    <PaymentCard
      item={item}
      roomName={item.room_id != null ? roomNameById[item.room_id] : '-'}
      tenantName={item.tenant_id != null ? tenantNameById[item.tenant_id] : '-'}
      photoUrl={
        item.tenant_id != null ? tenantPhotoById[item.tenant_id] : undefined
      }
      onRecord={() => {
        if (!canAddPayment) {
          showBasicsAlert();
          return;
        }
        trackEvent('Navigation_PaymentList_To_PaymentViewRecord', {
          source: 'Payment',
          bill_id: item.id,
        });
        navigation.navigate('PaymentView', {
          billId: item.id,
          openRecordPayment: true,
        });
      }}
      onPress={() => {
        trackEvent('Navigation_PaymentList_To_PaymentView', {
          source: 'Payment',
          bill_id: item.id,
        });
        navigation.navigate('PaymentView', { billId: item.id });
      }}
    />
  );
  return (
    <View style={styles.container}>
      {initialLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      ) : bills.length === 0 ? (
        <EmptyState
          canAdd={canAddPayment}
          missing={missingBasics}
          onAdd={() => navigation.navigate('PaymentForm')}
          onGoSettings={goToSettings}
          onGoProfile={goToProfile}
        />
      ) : (
        <FlatList
          data={visibleBills}
          renderItem={renderItem}
          keyExtractor={i => i.id.toString()}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {!canAddPayment ? (
                <SetupRequiredCard
                  missing={missingBasics}
                  onGoSettings={goToSettings}
                  onGoProfile={goToProfile}
                />
              ) : null}
              <Searchbar
                placeholder="Search payments"
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={setQuery}
                style={styles.search}
                inputStyle={styles.searchInput}
              />

              <View style={styles.pillRow}>
                <Chip
                  compact
                  selected={paymentFilter === 'ALL'}
                  showSelectedCheck={false}
                  onPress={() => setPaymentFilter('ALL')}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        paymentFilter === 'ALL'
                          ? theme.colors.primaryContainer
                          : '#FFFFFF',
                      borderColor:
                        paymentFilter === 'ALL'
                          ? theme.colors.primary
                          : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    {
                      color:
                        paymentFilter === 'ALL'
                          ? theme.colors.primary
                          : '#6B7280',
                    },
                  ]}
                >
                  All-{counts.all}
                </Chip>

                <Chip
                  compact
                  selected={paymentFilter === 'PAID'}
                  showSelectedCheck={false}
                  onPress={() => setPaymentFilter('PAID')}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        paymentFilter === 'PAID' ? '#ECFDF3' : '#FFFFFF',
                      borderColor:
                        paymentFilter === 'PAID' ? '#16A34A' : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    { color: paymentFilter === 'PAID' ? '#16A34A' : '#6B7280' },
                  ]}
                >
                  Paid-{counts.paid}
                </Chip>

                <Chip
                  compact
                  selected={paymentFilter === 'UNPAID'}
                  showSelectedCheck={false}
                  onPress={() => setPaymentFilter('UNPAID')}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        paymentFilter === 'UNPAID' ? '#FFF5F5' : '#FFFFFF',
                      borderColor:
                        paymentFilter === 'UNPAID' ? '#EF4444' : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    {
                      color: paymentFilter === 'UNPAID' ? '#EF4444' : '#6B7280',
                    },
                  ]}
                >
                  Unpaid-{counts.unpaid}
                </Chip>

                <Chip
                  compact
                  selected={paymentFilter === 'PARTIAL'}
                  showSelectedCheck={false}
                  onPress={() => setPaymentFilter('PARTIAL')}
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        paymentFilter === 'PARTIAL' ? '#FFF7ED' : '#FFFFFF',
                      borderColor:
                        paymentFilter === 'PARTIAL' ? '#F97316' : '#E5E7EB',
                    },
                  ]}
                  textStyle={[
                    styles.pillText,
                    {
                      color:
                        paymentFilter === 'PARTIAL' ? '#F97316' : '#6B7280',
                    },
                  ]}
                >
                  Partial-{counts.partial}
                </Chip>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                No payments match your search/filter.
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
        />
      )}

      {canAddPayment ? (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => {
            trackEvent('Navigation_PaymentList_To_PaymentAdd', {
              source: 'Payment',
              mode: 'Add',
            });
            navigation.navigate('PaymentForm');
          }}
        />
      ) : null}
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
}: {
  item: BillRecord;
  roomName: string;
  tenantName: string;
  photoUrl?: string;
  onRecord: () => void;
  onPress: () => void;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;

  const total = Number(item.total_amount || 0);
  const paid = Number(item.paid_amount || 0);
  const pending = Math.max(0, total - paid);
  const status = (item.status || '-').toUpperCase();

  // Hardcoded status tones are OK (semantic states), keep everything else theme-driven.
  const statusTone =
    status === 'PAID'
      ? { bg: '#ECFDF3', border: '#86EFAC', text: '#16A34A' }
      : status === 'PARTIAL'
      ? { bg: '#FFF7ED', border: '#FDBA74', text: '#F97316' }
      : { bg: '#FFF5F5', border: '#FECACA', text: '#EF4444' };

  return (
    <Surface style={[styles.card, { borderColor: outline }]} elevation={1}>
      <View style={styles.cardClip}>
        <TouchableRipple
          onPress={onPress}
          style={styles.cardContent}
          borderless
        >
          <View style={styles.cardContentInner}>
            <AvatarDisplay uri={photoUrl} size={AVATAR_SIZE} />

            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text
                  variant="titleMedium"
                  style={styles.cardTitle}
                  numberOfLines={1}
                >
                  {tenantName}
                </Text>
                <Text
                  style={[
                    styles.totalTopRight,
                    { color: theme.colors.primary },
                  ]}
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
                    <Icon
                      source="home-city-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.roomText} numberOfLines={1}>
                      {roomName}
                    </Text>
                  </View>
                  <View style={styles.issuedRow}>
                    <Icon
                      source="calendar-month-outline"
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.dateText} numberOfLines={1}>
                      {formatMonthYear(item.billing_month ?? item.created_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRight}>
                  <View style={styles.recordStatusRow}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: statusTone.bg,
                          borderColor: statusTone.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: statusTone.text },
                        ]}
                        numberOfLines={1}
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
                        <Icon
                          source="cash-plus"
                          size={16}
                          color={theme.colors.primary}
                        />
                      </View>
                    </TouchableRipple>
                  </View>
                </View>
              </View>
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

/* ---------------- SETUP GATE ---------------- */

const SetupRequiredCard = ({
  missing,
  onGoSettings,
  onGoProfile,
}: {
  missing: MissingBasic[];
  onGoSettings: () => void;
  onGoProfile: () => void;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const propertyMissing = (missing || []).filter(m => m.group === 'property');
  const profileMissing = (missing || []).filter(m => m.group === 'profile');

  return (
    <Surface style={[styles.setupCard, { borderColor: outline }]} elevation={1}>
   

      {profileMissing.length > 0 ? (
        <View style={styles.setupSection}>
          <View style={styles.setupSectionHeader}>
            <View
              style={[
                styles.setupSectionIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon
                source="account-circle-outline"
                size={16}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.setupSectionTitle}>Profile details</Text>
              <Text style={styles.setupSectionSub}>
                Required before recording payments.
              </Text>
            </View>
            <View style={styles.setupCountPill}>
              <Text style={[styles.setupCountPillText, { color: '#6B7280' }]}>
                {profileMissing.length}
              </Text>
            </View>
          </View>

          <View style={styles.setupItems}>
            {profileMissing.map(m => (
              <View key={m.key} style={styles.setupItemRow}>
                <Icon source="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.setupItemText}>{m.label}</Text>
              </View>
            ))}
          </View>

          <Button
            mode="outlined"
            onPress={onGoProfile}
            icon="account-circle-outline"
            style={styles.setupSectionBtn}
            contentStyle={styles.setupSectionBtnContent}
          >
            Open Profile
          </Button>
        </View>
      ) : null}

      {propertyMissing.length > 0 ? (
        <View style={styles.setupSection}>
          <View style={styles.setupSectionHeader}>
            <View
              style={[
                styles.setupSectionIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon
                source="cog-outline"
                size={16}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.setupSectionTitle}>Settings details</Text>
              <Text style={styles.setupSectionSub}>
                Property info shown on invoices.
              </Text>
            </View>
            <View style={styles.setupCountPill}>
              <Text style={[styles.setupCountPillText, { color: '#6B7280' }]}>
                {propertyMissing.length}
              </Text>
            </View>
          </View>

          <View style={styles.setupItems}>
            {propertyMissing.map(m => (
              <View key={m.key} style={styles.setupItemRow}>
                <Icon source="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.setupItemText}>{m.label}</Text>
              </View>
            ))}
          </View>

          <Button
            mode="contained"
            onPress={onGoSettings}
            icon="cog-outline"
            style={styles.setupSectionBtn}
            contentStyle={styles.setupSectionBtnContent}
          >
            Open Settings
          </Button>
        </View>
      ) : null}
    </Surface>
  );
};

/* ---------------- EMPTY ---------------- */

const EmptyState = ({
  canAdd,
  missing,
  onAdd,
  onGoSettings,
  onGoProfile,
}: {
  canAdd: boolean;
  missing: MissingBasic[];
  onAdd: () => void;
  onGoSettings: () => void;
  onGoProfile: () => void;
}) => (
  <View style={styles.emptyState}>
    <Avatar.Icon size={72} icon="receipt" style={styles.emptyIcon} />
    <Text variant="titleMedium" style={styles.emptyTitle}>
      Payments Paused
    </Text>

    {!canAdd ? (
      <>
        <Text style={styles.emptySubtitle}>
          Add your basic details first, then you can start creating bills and
          tracking collections.
        </Text>
        <SetupRequiredCard
          missing={missing}
          onGoSettings={onGoSettings}
          onGoProfile={onGoProfile}
        />
      </>
    ) : (
      <>
        <Text style={styles.emptySubtitle}>
          Create your first bill to start tracking rent and collections.
        </Text>
        <Button mode="contained" onPress={onAdd}>
          Add Payment
        </Button>
      </>
    )}
  </View>
);

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
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pill: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontWeight: '900', fontSize: 11, textAlign: 'center' },
  noResults: { paddingVertical: 18, alignItems: 'center' },
  noResultsText: { color: '#6B7280', fontWeight: '800' },

  card: {
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  cardClip: { borderRadius: 16, overflow: 'hidden' },
  cardContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardContentInner: {
    flex: 1,
    flexDirection: 'row',
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
  cardTitle: { fontWeight: '900', flex: 1, fontSize: 16, color: '#111827' },
  metaRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLeft: { flex: 1, minWidth: 0 },
  roomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  roomText: { color: '#6B7280', fontWeight: '800', flex: 1, fontSize: 13 },
  issuedRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: { color: '#6B7280', fontSize: 12, fontWeight: '800' },
  metaRight: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  recordStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  statusPill: {
    height: 28,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  statusActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusActionBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalTopRight: {
    fontWeight: '900',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    maxWidth: 120,
    textAlign: 'right',
  },

  fab: { position: 'absolute', right: 16, bottom: 24 },

  setupCard: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    marginBottom: 12,
  },
  setupHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setupHeroIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupHeroTitle: { fontWeight: '900', fontSize: 15, color: '#111827' },
  setupHeroSub: {
    marginTop: 3,
    fontWeight: '800',
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  setupSection: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  setupSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setupSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupSectionTitle: { fontWeight: '900', fontSize: 14, color: '#111827' },
  setupSectionSub: {
    marginTop: 2,
    fontWeight: '800',
    fontSize: 12,
    color: '#6B7280',
  },
  setupCountPill: {
    minWidth: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  setupCountPillText: { fontWeight: '900', fontSize: 12 },
  setupItems: { marginTop: 10, gap: 8 },
  setupItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setupItemText: { flex: 1, fontWeight: '900', color: '#111827' },
  setupSectionBtn: { marginTop: 12, borderRadius: 14 },
  setupSectionBtnContent: { paddingVertical: 6 },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: { marginBottom: 16, backgroundColor: '#FFFFFF' },
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
