import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  Divider,
  Icon,
  ProgressBar,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { BillRecord, fetchBills, fetchLatestSetting } from '../../service/BillService';
import { fetchRooms, RoomRecord } from '../../service/RoomService';
import { fetchTenants, getCurrentUserId, TenantRecord } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';

type MonthRange = { start: Date; end: Date };

type TenantRoomMappingLite = {
  id: number;
  room_id: number;
  tenant_id: number;
  joining_date: string;
  leaving_date: string | null;
};

const formatMoney = (n?: number | null) => {
  const v = Math.round(Number(n || 0));
  try {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(v)}`;
  } catch {
    return `₹${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1);

const getMonthRange = (d: Date): MonthRange => ({
  start: startOfMonth(d),
  end: startOfNextMonth(d),
});

const isInRange = (iso?: string | null, range?: MonthRange) => {
  if (!iso || !range) return false;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= range.start && dt < range.end;
};

const getMonthLabel = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

const sum = (vals: Array<number | null | undefined>) =>
  vals.reduce<number>((a, b) => a + Number(b || 0), 0);

const KpiCard = ({
  title,
  value,
  subtitle,
  icon,
  tone = 'neutral',
  onPress,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  onPress?: () => void;
}) => {
  const theme = useTheme();
  const toneMap =
    tone === 'good'
      ? { bg: '#ECFDF3', border: '#86EFAC', fg: '#16A34A' }
      : tone === 'warn'
        ? { bg: '#FFF7ED', border: '#FDBA74', fg: '#F97316' }
        : tone === 'bad'
          ? { bg: '#FFF5F5', border: '#FECACA', fg: '#EF4444' }
          : { bg: theme.colors.surface, border: theme.colors.outlineVariant || '#E5E7EB', fg: theme.colors.primary };

  return (
    <TouchableRipple onPress={onPress} borderless style={styles.kpiPress}>
      <Surface style={[styles.kpiCard, { borderColor: toneMap.border }]} elevation={1}>
        <View style={styles.kpiTopRow}>
          <View style={[styles.kpiIconWrap, { backgroundColor: toneMap.bg, borderColor: toneMap.border }]}>
            <Icon source={icon} size={16} color={toneMap.fg} />
          </View>
          <Text style={styles.kpiTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {value}
        </Text>
        {subtitle ? (
          <Text style={styles.kpiSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : (
          <Text style={styles.kpiSubtitlePlaceholder}> </Text>
        )}
      </Surface>
    </TouchableRipple>
  );
};

const PaymentStat = ({
  icon,
  label,
  amount,
  color,
}: {
  icon: string;
  label: string;
  amount: string;
  color: string;
}) => (
  <View style={styles.paymentStat}>
    <View style={styles.paymentStatTop}>
      <Icon source={icon} size={16} color={color} />
      <Text style={styles.paymentStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text
      style={[styles.paymentStatAmount, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {amount}
    </Text>
  </View>
);

export default function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [rooms, setRooms] = React.useState<RoomRecord[]>([]);
  const [tenants, setTenants] = React.useState<TenantRecord[]>([]);
  const [bills, setBills] = React.useState<BillRecord[]>([]);
  const [mappings, setMappings] = React.useState<TenantRoomMappingLite[]>([]);
  const [setting, setSetting] = React.useState<{ water: number; electricity_unit: number } | null>(null);

  const monthRange = React.useMemo(() => getMonthRange(new Date()), []);
  const monthLabel = React.useMemo(() => getMonthLabel(new Date()), []);

  const openTab = React.useCallback(
    (tabName: 'Tenant' | 'Rooms' | 'Payments' | 'Settings', screen?: string) => {
      const tabNav = navigation.getParent?.() || navigation;
      if (!screen) return tabNav.navigate(tabName);
      return tabNav.navigate(tabName, { screen });
    },
    [navigation],
  );

  const load = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);

      const userId = await getCurrentUserId();

      const [roomRows, tenantRows, billRows, latestSetting, mappingRows] = await Promise.all([
        fetchRooms(),
        fetchTenants(),
        fetchBills(),
        fetchLatestSetting().catch(() => ({ water: 0, electricity_unit: 0 })),
        supabase
          .from('tenant_room_mapping')
          .select('id, room_id, tenant_id, joining_date, leaving_date')
          .eq('user_id', userId),
      ]);

      setRooms(roomRows || []);
      setTenants(tenantRows || []);
      setBills(billRows || []);
      setSetting(latestSetting || null);

      if (mappingRows.error) throw mappingRows.error;
      setMappings((mappingRows.data || []) as any);
    } catch (e: any) {
      // Keep UI usable even if one section fails
      console.warn('Dashboard load failed', e?.message || e);
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  const derived = React.useMemo(() => {
    const roomCount = rooms.length;
    const tenantCount = tenants.length;

    const activeMappings = mappings.filter((m) => !m.leaving_date);
    const occupiedRoomIds = new Set(activeMappings.map((m) => m.room_id));
    const occupiedRooms = occupiedRoomIds.size;
    const vacantRooms = Math.max(0, roomCount - occupiedRooms);
    const occupancyPct = roomCount > 0 ? Math.round((occupiedRooms / roomCount) * 100) : 0;

    const billsThisMonth = (bills || []).filter((b) => isInRange(b.created_at, monthRange));
    const expectedThisMonth = sum(billsThisMonth.map((b) => b.total_amount));
    const collectedThisMonth = sum(billsThisMonth.map((b) => b.paid_amount));
    const pendingThisMonth = Math.max(0, expectedThisMonth - collectedThisMonth);
    const collectionPct = expectedThisMonth > 0 ? Math.round((collectedThisMonth / expectedThisMonth) * 100) : 0;

    const allPending = sum((bills || []).map((b) => Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0))));
    const prevMonthsPending = sum(
      (bills || [])
        .filter((b) => {
          const dt = new Date(b.created_at);
          return !Number.isNaN(dt.getTime()) && dt < monthRange.start;
        })
        .map((b) => Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0))),
    );
    const overdueBillsCount = (bills || []).filter((b) => {
      const dt = new Date(b.created_at);
      const pending = Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0));
      const status = String(b.status || '').toUpperCase();
      return !Number.isNaN(dt.getTime()) && dt < monthRange.start && pending > 0 && status !== 'PAID';
    }).length;

    const joinThisMonth = mappings.filter((m) => isInRange(m.joining_date, monthRange)).length;
    const vacatedThisMonth = mappings.filter((m) => isInRange(m.leaving_date, monthRange)).length;

    const electricityUnitsThisMonth = sum(
      billsThisMonth.map((b) => {
        const prev = Number(b.previous_month_meter_reading);
        const curr = Number(b.current_month_meter_reading);
        if (Number.isNaN(prev) || Number.isNaN(curr)) return 0;
        return Math.max(0, curr - prev);
      }),
    );

    const electricityChargesThisMonth = sum(billsThisMonth.map((b) => b.electricity));
    const waterChargesThisMonth = sum(billsThisMonth.map((b) => b.water));
    const adHocThisMonth = sum(billsThisMonth.map((b) => b.ad_hoc_amount));

    // Highest outstanding tenant
    const pendingByTenant: Record<number, number> = {};
    (bills || []).forEach((b) => {
      const tid = b.tenant_id;
      if (tid == null) return;
      const pending = Math.max(0, Number(b.total_amount || 0) - Number(b.paid_amount || 0));
      if (!pending) return;
      pendingByTenant[tid] = (pendingByTenant[tid] || 0) + pending;
    });
    const tenantsWithDuesCount = Object.keys(pendingByTenant).length;
    const avgDuePerTenant =
      tenantsWithDuesCount > 0 ? Math.round(allPending / tenantsWithDuesCount) : 0;
    const highestOutstandingTenantId = Object.keys(pendingByTenant)
      .map((k) => Number(k))
      .sort((a, b) => (pendingByTenant[b] || 0) - (pendingByTenant[a] || 0))[0];
    const highestOutstanding = highestOutstandingTenantId
      ? { tenantId: highestOutstandingTenantId, amount: pendingByTenant[highestOutstandingTenantId] || 0 }
      : null;
    const highestOutstandingTenantName =
      highestOutstanding?.tenantId != null
        ? (tenants.find((t) => t.id === highestOutstanding.tenantId)?.name ?? 'Tenant')
        : null;

    // Missing bills for occupied rooms (this month)
    const billedRoomIdsThisMonth = new Set(billsThisMonth.map((b) => b.room_id).filter(Boolean));
    const missingBillsForOccupied = Array.from(occupiedRoomIds).filter((rid) => !billedRoomIdsThisMonth.has(rid)).length;

    return {
      roomCount,
      tenantCount,
      occupiedRooms,
      vacantRooms,
      occupancyPct,
      expectedThisMonth,
      collectedThisMonth,
      pendingThisMonth,
      collectionPct,
      allPending,
      prevMonthsPending,
      overdueBillsCount,
      joinThisMonth,
      vacatedThisMonth,
      electricityUnitsThisMonth,
      electricityChargesThisMonth,
      waterChargesThisMonth,
      adHocThisMonth,
      tenantsWithDuesCount,
      avgDuePerTenant,
      highestOutstandingTenantName,
      highestOutstandingAmount: highestOutstanding?.amount ?? 0,
      missingBillsForOccupied,
      electricityUnitRate: setting?.electricity_unit ?? 0,
    };
  }, [rooms, tenants, bills, mappings, setting, monthRange]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, color: '#6B7280', fontWeight: '800' }}>Loading dashboard…</Text>
      </View>
    );
  }

  const hasAnyData = derived.roomCount > 0 || derived.tenantCount > 0 || (bills || []).length > 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {/* HERO */}
      <Surface style={styles.hero} elevation={2}>
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>DASHBOARD</Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              Property health
            </Text>
          </View>
          <Chip
            icon="calendar-month"
            style={[styles.heroChip, { backgroundColor: theme.colors.primaryContainer }]}
            textStyle={{ color: theme.colors.primary, fontWeight: '900' }}
          >
            {monthLabel}
          </Chip>
        </View>

        <View style={styles.heroGrid}>
          <View style={styles.heroOccWide}>
            <View style={styles.heroOccRow}>
              <View style={styles.heroOccLeft}>
                <Text style={styles.heroStatLabel}>Occupancy</Text>
                <Text style={styles.heroOccValue} numberOfLines={1}>
                  {derived.occupancyPct}%
                </Text>
                <Text style={styles.heroOccSub} numberOfLines={1}>
                  {derived.occupiedRooms} / {derived.roomCount} rooms occupied
                </Text>
              </View>

              <View style={styles.heroOccRight}>
                <View style={[styles.heroOccBadge, { backgroundColor: '#ECFDF3', borderColor: '#86EFAC' }]}>
                  <View style={[styles.heroOccBadgeIcon, { backgroundColor: '#DCFCE7' }]}>
                    <Icon source="door-closed" size={14} color="#16A34A" />
                  </View>
                  <View style={styles.heroOccBadgeText}>
                    <Text style={[styles.heroOccBadgeValue, { color: '#16A34A' }]} numberOfLines={1}>
                      {derived.occupiedRooms}
                    </Text>
                    <Text style={[styles.heroOccBadgeLabel, { color: '#16A34A' }]} numberOfLines={1}>
                      Occupied
                    </Text>
                  </View>
                </View>

                <View style={[styles.heroOccBadge, { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' }]}>
                  <View style={[styles.heroOccBadgeIcon, { backgroundColor: '#FFEDD5' }]}>
                    <Icon source="door-open" size={14} color="#F97316" />
                  </View>
                  <View style={styles.heroOccBadgeText}>
                    <Text style={[styles.heroOccBadgeValue, { color: '#F97316' }]} numberOfLines={1}>
                      {derived.vacantRooms}
                    </Text>
                    <Text style={[styles.heroOccBadgeLabel, { color: '#F97316' }]} numberOfLines={1}>
                      Vacant
                    </Text>
                  </View>
                </View>
              </View>
            </View>

          </View>

          <Surface
            style={[
              styles.rentStrip,
              { backgroundColor: theme.colors.primaryContainer, borderColor: theme.colors.primary },
            ]}
            elevation={0}
          >
            <View style={styles.rentStripHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.rentStripTitleRow}>
                  <View style={[styles.rentStripIcon, { backgroundColor: theme.colors.surface }]}>
                    <Icon source="cash-multiple" size={18} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.rentStripTitle} numberOfLines={1}>
                    Total rent
                  </Text>
                </View>
              </View>

              <Text
                style={[styles.rentStripTotal, { color: theme.colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {formatMoney(derived.expectedThisMonth)}
              </Text>
            </View>

            <Surface
              style={[
                styles.paymentStrip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline,
                },
              ]}
              elevation={0}
            >
              <View style={styles.paymentStripRow}>
                <PaymentStat icon="cash" label="Paid" amount={formatMoney(derived.collectedThisMonth)} color={theme.colors.primary} />
                <View
                  style={[
                    styles.paymentStripDivider,
                    { backgroundColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
                  ]}
                />
                <PaymentStat
                  icon="clock-outline"
                  label="Pending"
                  amount={formatMoney(derived.pendingThisMonth)}
                  color={derived.pendingThisMonth > 0 ? theme.colors.error : theme.colors.primary}
                />
              </View>
              <ProgressBar
                progress={clamp01(derived.expectedThisMonth ? derived.collectedThisMonth / derived.expectedThisMonth : 0)}
                color={theme.colors.primary}
                style={styles.paymentProgress}
              />
            </Surface>
          </Surface>
        </View>
      </Surface>

      {!hasAnyData ? (
        <Surface style={styles.emptyCard} elevation={1}>
          <View style={styles.emptyTop}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="home-city-outline" size={22} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>No data yet</Text>
              <Text style={styles.emptySub}>
                Add rooms and tenants to start tracking occupancy, dues, and utilities.
              </Text>
            </View>
          </View>
          <View style={styles.emptyActions}>
            <TouchableRipple onPress={() => openTab('Rooms', 'RoomList')} style={styles.emptyBtn} borderless>
              <View style={styles.emptyBtnInner}>
                <Icon source="home-city-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.emptyBtnText, { color: theme.colors.primary }]}>Rooms</Text>
              </View>
            </TouchableRipple>
            <TouchableRipple onPress={() => openTab('Tenant', 'TenantList')} style={styles.emptyBtn} borderless>
              <View style={styles.emptyBtnInner}>
                <Icon source="account-group" size={16} color={theme.colors.primary} />
                <Text style={[styles.emptyBtnText, { color: theme.colors.primary }]}>Tenants</Text>
              </View>
            </TouchableRipple>
            <TouchableRipple onPress={() => openTab('Payments', 'PaymentList')} style={styles.emptyBtn} borderless>
              <View style={styles.emptyBtnInner}>
                <Icon source="credit-card-outline" size={16} color={theme.colors.primary} />
                <Text style={[styles.emptyBtnText, { color: theme.colors.primary }]}>Payments</Text>
              </View>
            </TouchableRipple>
          </View>
        </Surface>
      ) : null}

      {/* FINANCIAL SUMMARY */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Financial summary</Text>
        <Text style={styles.sectionHint}>₹ context for daily decisions</Text>
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title={`Bill - (${monthLabel})`}
          value={formatMoney(derived.expectedThisMonth)}
          icon="cash-multiple"
          onPress={() => openTab('Payments', 'PaymentList')}
        />
        <KpiCard
          title="Pending dues"
          value={formatMoney(derived.allPending)}
          subtitle={derived.prevMonthsPending > 0 ? `${formatMoney(derived.prevMonthsPending)} pending from last month(s)` : 'All caught up'}
          icon="alert-circle-outline"
          tone={derived.allPending > 0 ? 'bad' : 'good'}
          onPress={() => openTab('Payments', 'PaymentList')}
        />
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title="Overdue bills"
          value={String(derived.overdueBillsCount)}
          subtitle={derived.overdueBillsCount > 0 ? 'Older unpaid bills need attention' : 'No overdue bills'}
          icon="calendar-alert"
          tone={derived.overdueBillsCount > 0 ? 'bad' : 'good'}
          onPress={() => openTab('Payments', 'PaymentList')}
        />
        <KpiCard
          title="Collection rate"
          value={`${derived.collectionPct}%`}
          subtitle={`${formatMoney(derived.collectedThisMonth)} collected of ${formatMoney(derived.expectedThisMonth)}`}
          icon="progress-check"
          tone={derived.collectionPct >= 90 ? 'good' : derived.collectionPct >= 60 ? 'warn' : 'bad'}
          onPress={() => openTab('Payments', 'PaymentList')}
        />
      </View>

      {/* OCCUPANCY & TENANTS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Occupancy & tenants</Text>
        <Text style={styles.sectionHint}>Moves in/out and who needs follow-up</Text>
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title="Tenants with dues"
          value={String(derived.tenantsWithDuesCount)}
          subtitle={
            derived.tenantsWithDuesCount > 0
              ? `Avg due ${formatMoney(derived.avgDuePerTenant)}`
              : 'No pending dues'
          }
          icon="account-cash-outline"
          tone={derived.tenantsWithDuesCount > 0 ? 'warn' : 'good'}
          onPress={() => openTab('Payments', 'PaymentList')}
        />
        <KpiCard
          title="Highest outstanding"
          value={formatMoney(derived.highestOutstandingAmount)}
          subtitle={derived.highestOutstandingTenantName ? `From ${derived.highestOutstandingTenantName}` : 'No pending dues'}
          icon="account-alert"
          tone={derived.highestOutstandingAmount > 0 ? 'warn' : 'good'}
          onPress={() => openTab('Payments', 'PaymentList')}
        />
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title="Tenants joined (this month)"
          value={String(derived.joinThisMonth)}
          subtitle="New move-ins"
          icon="account-plus-outline"
          onPress={() => openTab('Rooms', 'RoomList')}
        />
        <KpiCard
          title="Tenants vacated (this month)"
          value={String(derived.vacatedThisMonth)}
          subtitle="Move-outs"
          icon="account-arrow-right-outline"
          onPress={() => openTab('Rooms', 'RoomList')}
        />
      </View>

      {/* UTILITIES */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Utilities & metering</Text>
        <Text style={styles.sectionHint}>Based on bills generated this month</Text>
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title="Electricity units"
          value={`${Math.round(derived.electricityUnitsThisMonth)}`}
          subtitle={derived.electricityUnitRate > 0 ? `Rate ₹${derived.electricityUnitRate}/unit` : 'Set electricity unit rate in Settings'}
          icon="flash-outline"
          onPress={() => openTab('Settings')}
        />
        <KpiCard
          title="Electricity charges"
          value={formatMoney(derived.electricityChargesThisMonth)}
          subtitle="This month"
          icon="cash"
          onPress={() => openTab('Payments', 'PaymentList')}
        />
      </View>
      <View style={styles.grid2}>
        <KpiCard
          title="Water charges"
          value={formatMoney(derived.waterChargesThisMonth)}
          subtitle="This month"
          icon="water-outline"
          onPress={() => openTab('Payments', 'PaymentList')}
        />
        <KpiCard
          title="Ad-hoc charges"
          value={formatMoney(derived.adHocThisMonth)}
          subtitle="This month"
          icon="note-text-outline"
          onPress={() => openTab('Payments', 'PaymentList')}
        />
      </View>

      {/* ALERTS */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Attention needed</Text>
        <Text style={styles.sectionHint}>Small issues that become big later</Text>
      </View>
      <Surface style={styles.alertCard} elevation={1}>
        <View style={styles.alertRow}>
          <View style={[styles.alertIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="alert" size={18} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.alertTitle}>Bills missing for occupied rooms</Text>
            <Text style={styles.alertSub}>
              {derived.missingBillsForOccupied > 0
                ? `${derived.missingBillsForOccupied} occupied room(s) don’t have a bill for ${monthLabel}.`
                : `All occupied rooms have bills for ${monthLabel}.`}
            </Text>
          </View>
          <TouchableRipple onPress={() => openTab('Payments', 'PaymentList')} borderless style={styles.alertCta}>
            <View style={styles.alertCtaInner}>
              <Text style={[styles.alertCtaText, { color: theme.colors.primary }]}>Open</Text>
              <Icon source="chevron-right" size={18} color={theme.colors.primary} />
            </View>
          </TouchableRipple>
        </View>
        <Divider style={{ marginTop: 12, opacity: 0.5 }} />
        <View style={styles.alertMiniRow}>
          <Chip
            icon="door-open"
            style={[styles.alertChip, { backgroundColor: derived.vacantRooms > 0 ? '#FFF7ED' : '#ECFDF3' }]}
            textStyle={{ fontWeight: '900', color: derived.vacantRooms > 0 ? '#F97316' : '#16A34A' }}
          >
            Vacant {derived.vacantRooms}
          </Chip>
          <Chip
            icon="calendar-alert"
            style={[styles.alertChip, { backgroundColor: derived.overdueBillsCount > 0 ? '#FFF5F5' : '#ECFDF3' }]}
            textStyle={{ fontWeight: '900', color: derived.overdueBillsCount > 0 ? '#EF4444' : '#16A34A' }}
          >
            Overdue {derived.overdueBillsCount}
          </Chip>
          <Chip
            icon="cash-minus"
            style={[styles.alertChip, { backgroundColor: derived.allPending > 0 ? '#FFF5F5' : '#ECFDF3' }]}
            textStyle={{ fontWeight: '900', color: derived.allPending > 0 ? '#EF4444' : '#16A34A' }}
          >
            Pending {formatMoney(derived.allPending)}
          </Chip>
        </View>
      </Surface>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 24 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA' },

  hero: { borderRadius: 18, padding: 16, marginBottom: 14 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroKicker: { color: '#6B7280', fontWeight: '900', letterSpacing: 1.2, fontSize: 11 },
  heroTitle: { fontWeight: '900', fontSize: 20, color: '#111827', marginTop: 2 },
  heroChip: { borderRadius: 999 },
  heroGrid: { marginTop: 14, flexDirection: 'column', gap: 12 },
  heroStatLabel: { color: '#6B7280', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },
  heroStatValue: { fontWeight: '900', fontSize: 22, marginTop: 6, color: '#111827' },
  heroStatSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  heroOccWide: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12 },
  heroOccRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroOccLeft: { flex: 1, minWidth: 0 },
  heroOccValue: { fontWeight: '900', fontSize: 26, marginTop: 4, color: '#111827', fontVariant: ['tabular-nums'] },
  heroOccSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  heroOccRight: { width: 150, gap: 8 },
  heroOccBadge: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroOccBadgeIcon: { width: 28, height: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  heroOccBadgeText: { flex: 1, minWidth: 0 },
  heroOccBadgeValue: { fontWeight: '900', fontSize: 15, fontVariant: ['tabular-nums'] },
  heroOccBadgeLabel: { fontWeight: '900', fontSize: 11, opacity: 0.95 },
  rentStrip: { borderRadius: 16, borderWidth: 1, padding: 12 },
  rentStripHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rentStripTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rentStripIcon: { width: 34, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rentStripTitle: { color: '#111827', fontWeight: '900', fontSize: 14, flex: 1 },
  rentStripTotal: {
    fontWeight: '900',
    fontSize: 22,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    maxWidth: 180,
  },

  paymentStrip: { marginTop: 12, borderRadius: 16, borderWidth: 1, padding: 10 },
  paymentStripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentStripDivider: { width: StyleSheet.hairlineWidth, height: 34, borderRadius: 1 },
  paymentStat: { flex: 1 },
  paymentStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentStatLabel: { color: '#6B7280', fontWeight: '800', fontSize: 11 },
  paymentStatAmount: { marginTop: 6, fontWeight: '900', fontSize: 16, fontVariant: ['tabular-nums'] },
  paymentProgress: { marginTop: 10, height: 6, borderRadius: 999 },

  sectionHeader: { marginTop: 14, marginBottom: 10 },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  sectionHint: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },

  grid2: { flexDirection: 'row', gap: 12 },

  kpiPress: { flex: 1 },
  kpiCard: { borderRadius: 18, padding: 14, borderWidth: 1, backgroundColor: '#FFFFFF' },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kpiIconWrap: { width: 28, height: 28, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  kpiTitle: { color: '#6B7280', fontWeight: '900', fontSize: 12, flex: 1 },
  kpiValue: { fontWeight: '900', fontSize: 20, color: '#111827', marginTop: 8, fontVariant: ['tabular-nums'] },
  kpiSubtitle: { marginTop: 4, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  kpiSubtitlePlaceholder: { marginTop: 4, opacity: 0 },

  emptyCard: { borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  emptySub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  emptyBtn: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyBtnInner: { paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  emptyBtnText: { fontWeight: '900', fontSize: 12 },

  alertCard: { borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontWeight: '900', fontSize: 14, color: '#111827' },
  alertSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  alertCta: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' },
  alertCtaInner: { paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  alertCtaText: { fontWeight: '900', fontSize: 12 },
  alertMiniRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  alertChip: { borderRadius: 999 },
});
