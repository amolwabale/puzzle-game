import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Chip,
  Icon,
  ProgressBar,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import {
  BillingMonthPickerDialog,
  formatBillingMonthLabel,
  normalizeBillingMonthDate,
} from '../../components/BillingMonthPicker';
import {
  BillRecord,
  fetchBills,
  fetchLatestSetting,
} from '../../service/BillService';
import { fetchRooms, RoomRecord } from '../../service/RoomService';
import {
  fetchTenants,
  getCurrentUserId,
  TenantRecord,
} from '../../service/tenantService';
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
    return `₹${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(v)}`;
  } catch {
    return `₹${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 1);
const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);
const startOfNextYear = (d: Date) => new Date(d.getFullYear() + 1, 0, 1);

const getMonthRange = (d: Date): MonthRange => ({
  start: startOfMonth(d),
  end: startOfNextMonth(d),
});

const getYearRange = (d: Date): MonthRange => ({
  start: startOfYear(d),
  end: startOfNextYear(d),
});

const isInRange = (iso?: string | null, range?: MonthRange) => {
  if (!iso || !range) return false;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= range.start && dt < range.end;
};

const billMonthIso = (b: BillRecord) =>
  (b as any).billing_month ?? b.created_at;

const getMonthLabel = (d: Date) =>
  d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
const getYearLabel = (d: Date) => String(d.getFullYear());

const sum = (vals: Array<number | null | undefined>) =>
  vals.reduce<number>((a, b) => a + Number(b || 0), 0);

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

const UtilityStat = ({
  icon,
  label,
  value,
  color,
  sub,
  valueIndent = 'none',
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  sub?: string;
  valueIndent?: 'none' | 'label';
}) => (
  <View style={styles.utilStat}>
    <View style={styles.utilStatTop}>
      <Icon source={icon} size={16} color={color} />
      <Text style={styles.utilStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text
      style={[
        styles.utilStatValue,
        { color },
        valueIndent === 'label' ? styles.utilStatValueIndent : null,
      ]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {value}
    </Text>
    {sub ? (
      <Text
        style={[
          styles.utilStatSub,
          valueIndent === 'label' ? styles.utilStatValueIndent : null,
        ]}
        numberOfLines={1}
      >
        {sub}
      </Text>
    ) : null}
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
  const [setting, setSetting] = React.useState<{
    water: number;
    electricity_unit: number;
    rent_date: number;
    rent_due_date: number;
  } | null>(null);

  const [selectedBillingMonth, setSelectedBillingMonth] = React.useState<Date>(
    () => normalizeBillingMonthDate(new Date()),
  );
  const [billingPickerOpen, setBillingPickerOpen] = React.useState(false);

  const monthRange = React.useMemo(
    () => getMonthRange(selectedBillingMonth),
    [selectedBillingMonth],
  );
  const monthLabel = React.useMemo(
    () => formatBillingMonthLabel(selectedBillingMonth),
    [selectedBillingMonth],
  );
  const yearRange = React.useMemo(
    () => getYearRange(selectedBillingMonth),
    [selectedBillingMonth],
  );
  const yearLabel = React.useMemo(
    () => getYearLabel(selectedBillingMonth),
    [selectedBillingMonth],
  );

  const openTab = React.useCallback(
    (
      tabName: 'Tenant' | 'Rooms' | 'Payments' | 'Settings',
      screen?: string,
    ) => {
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

      const [roomRows, tenantRows, billRows, latestSetting, mappingRows] =
        await Promise.all([
          fetchRooms(),
          fetchTenants(),
          fetchBills(),
          fetchLatestSetting().catch(() => ({
            water: 0,
            electricity_unit: 0,
            rent_date: 0,
            rent_due_date: 0,
            property_name: undefined,
            property_address: undefined,
          })),
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
    const billTotal = (b: BillRecord) => {
      // Back-compat: some older rows may have null total_amount
      const t = b.total_amount;
      if (t != null && Number.isFinite(Number(t))) return Number(t);
      return (
        Number(b.rent || 0) +
        Number(b.water || 0) +
        Number(b.electricity || 0) +
        Number(b.ad_hoc_amount || 0)
      );
    };

    const roomCount = rooms.length;
    const tenantCount = tenants.length;

    const activeMappings = mappings.filter(m => !m.leaving_date);
    const occupiedRoomIds = new Set(activeMappings.map(m => m.room_id));
    const occupiedRooms = occupiedRoomIds.size;
    const vacantRooms = Math.max(0, roomCount - occupiedRooms);
    const occupancyPct =
      roomCount > 0 ? Math.round((occupiedRooms / roomCount) * 100) : 0;

    // Monthly/yearly grouping must use billing_month (fallback created_at for older rows).
    const billsThisMonth = (bills || []).filter(b =>
      isInRange(billMonthIso(b), monthRange),
    );
    const billsThisYear = (bills || []).filter(b =>
      isInRange(billMonthIso(b), yearRange),
    );
    const expectedThisMonth = sum(billsThisMonth.map(b => billTotal(b)));
    const collectedThisMonth = sum(billsThisMonth.map(b => b.paid_amount));
    const pendingThisMonth = Math.max(
      0,
      expectedThisMonth - collectedThisMonth,
    );
    const collectionPct =
      expectedThisMonth > 0
        ? Math.round((collectedThisMonth / expectedThisMonth) * 100)
        : 0;

    const expectedThisYear = sum(billsThisYear.map(b => billTotal(b)));
    const collectedThisYear = sum(billsThisYear.map(b => b.paid_amount));
    const pendingThisYear = Math.max(0, expectedThisYear - collectedThisYear);
    const collectionPctYear =
      expectedThisYear > 0
        ? Math.round((collectedThisYear / expectedThisYear) * 100)
        : 0;

    // Rent billed this month (rent-only, regardless of status/paid).
    const rentBilledThisMonth = sum(billsThisMonth.map(b => b.rent));

    const allPending = sum(
      (bills || []).map(b =>
        Math.max(0, billTotal(b) - Number(b.paid_amount || 0)),
      ),
    );
    const prevMonthsPending = sum(
      (bills || [])
        .filter(b => {
          const dt = new Date(billMonthIso(b));
          return !Number.isNaN(dt.getTime()) && dt < monthRange.start;
        })
        .map(b => Math.max(0, billTotal(b) - Number(b.paid_amount || 0))),
    );
    const overdueBillsCount = (bills || []).filter(b => {
      const dt = new Date(billMonthIso(b));
      const pending = Math.max(0, billTotal(b) - Number(b.paid_amount || 0));
      const status = String(b.status || '').toUpperCase();
      return (
        !Number.isNaN(dt.getTime()) &&
        dt < monthRange.start &&
        pending > 0 &&
        status !== 'PAID'
      );
    }).length;

    const joinThisMonth = mappings.filter(m =>
      isInRange(m.joining_date, monthRange),
    ).length;
    const vacatedThisMonth = mappings.filter(m =>
      isInRange(m.leaving_date, monthRange),
    ).length;

    const electricityUnitsThisMonth = sum(
      billsThisMonth.map(b => {
        const prev = Number(b.previous_month_meter_reading);
        const curr = Number(b.current_month_meter_reading);
        if (Number.isNaN(prev) || Number.isNaN(curr)) return 0;
        return Math.max(0, curr - prev);
      }),
    );

    const electricityChargesThisMonth = sum(
      billsThisMonth.map(b => b.electricity),
    );
    const waterChargesThisMonth = sum(billsThisMonth.map(b => b.water));
    const adHocThisMonth = sum(billsThisMonth.map(b => b.ad_hoc_amount));

    const rentBilledThisYear = sum(billsThisYear.map(b => b.rent));
    const electricityChargesThisYear = sum(
      billsThisYear.map(b => b.electricity),
    );
    const waterChargesThisYear = sum(billsThisYear.map(b => b.water));
    const adHocThisYear = sum(billsThisYear.map(b => b.ad_hoc_amount));

    // Highest outstanding tenant
    const pendingByTenant: Record<number, number> = {};
    (bills || []).forEach(b => {
      const tid = b.tenant_id;
      if (tid == null) return;
      const pending = Math.max(0, billTotal(b) - Number(b.paid_amount || 0));
      if (!pending) return;
      pendingByTenant[tid] = (pendingByTenant[tid] || 0) + pending;
    });
    const tenantsWithDuesCount = Object.keys(pendingByTenant).length;
    const avgDuePerTenant =
      tenantsWithDuesCount > 0
        ? Math.round(allPending / tenantsWithDuesCount)
        : 0;
    const highestOutstandingTenantId = Object.keys(pendingByTenant)
      .map(k => Number(k))
      .sort((a, b) => (pendingByTenant[b] || 0) - (pendingByTenant[a] || 0))[0];
    const highestOutstanding = highestOutstandingTenantId
      ? {
          tenantId: highestOutstandingTenantId,
          amount: pendingByTenant[highestOutstandingTenantId] || 0,
        }
      : null;
    const highestOutstandingTenantName =
      highestOutstanding?.tenantId != null
        ? tenants.find(t => t.id === highestOutstanding.tenantId)?.name ??
          'Tenant'
        : null;

    // Missing bills for occupied rooms (this month)
    const billedRoomIdsThisMonth = new Set(
      billsThisMonth.map(b => b.room_id).filter(Boolean),
    );
    const missingBillsForOccupied = Array.from(occupiedRoomIds).filter(
      rid => !billedRoomIdsThisMonth.has(rid),
    ).length;

    // Attention needed: occupied tenants with bill not generated after rent day / due day.
    const realNow = new Date();
    // If viewing a past/future month, anchor "now" into the selected month window
    // so gating logic behaves predictably for that period.
    const now =
      realNow < monthRange.start
        ? monthRange.start
        : realNow >= monthRange.end
        ? new Date(monthRange.end.getTime() - 1)
        : realNow;
    const rentDay = Number(setting?.rent_date || 0);
    const dueDay = Number(setting?.rent_due_date || 0);
    const isValidDay = (d: number) => Number.isFinite(d) && d >= 1 && d <= 31;
    const daysInMonth = (y: number, m: number) =>
      new Date(y, m + 1, 0).getDate();
    const clampDayToMonth = (y: number, m: number, day: number) => {
      const dd = Math.max(1, Math.min(daysInMonth(y, m), Math.floor(day)));
      return new Date(y, m, dd);
    };

    const y = monthRange.start.getFullYear();
    const m = monthRange.start.getMonth();

    const rentDateThisMonth = isValidDay(rentDay)
      ? clampDayToMonth(y, m, rentDay)
      : null;
    const afterRentGate = Boolean(
      rentDateThisMonth && now >= rentDateThisMonth,
    );

    // For a selected month, the cycle is anchored to that month's rent day.
    // Bills are grouped by billing_month, so we use billsThisMonth as the cycle's bill set.
    const cycleStart =
      rentDateThisMonth && isValidDay(rentDay) ? rentDateThisMonth : null;

    const dueDate =
      cycleStart && isValidDay(rentDay) && isValidDay(dueDay)
        ? (() => {
            const dueIsNextMonth = dueDay < rentDay;
            const baseMonth = cycleStart.getMonth();
            const baseYear = cycleStart.getFullYear();
            const dm = dueIsNextMonth
              ? baseMonth === 11
                ? 0
                : baseMonth + 1
              : baseMonth;
            const dy =
              dueIsNextMonth && baseMonth === 11 ? baseYear + 1 : baseYear;
            return clampDayToMonth(dy, dm, dueDay);
          })()
        : null;
    const afterDueGate = Boolean(dueDate && now >= dueDate);

    const billsInCycle = billsThisMonth;

    const billKeySet = new Set(
      billsInCycle
        .map(b => {
          if (b.tenant_id == null || b.room_id == null) return null;
          return `${b.tenant_id}-${b.room_id}`;
        })
        .filter(Boolean) as string[],
    );

    // IMPORTANT: dedupe by (tenant_id, room_id) — a tenant can be mapped to multiple rooms.
    const missingTenantRoomKeys = new Set<string>();
    // Only count occupancies that existed before the cycle started.
    activeMappings
      .filter(mm => {
        if (!cycleStart) return false;
        const jd = new Date(mm.joining_date);
        if (Number.isNaN(jd.getTime())) return true;
        return jd <= cycleStart;
      })
      .forEach(mm => {
        if (mm.tenant_id == null || mm.room_id == null) return;
        const key = `${mm.tenant_id}-${mm.room_id}`;
        if (!billKeySet.has(key)) missingTenantRoomKeys.add(key);
      });

    const tenantsMissingBillsAfterRentDayCount =
      afterRentGate && cycleStart && isValidDay(rentDay)
        ? missingTenantRoomKeys.size
        : 0;

    const billsUnpaidAfterDueDayCount = afterDueGate
      ? billsInCycle.filter(b => {
          const total = billTotal(b);
          const paid = Number(b.paid_amount || 0);
          const pending = Math.max(0, total - paid);
          const status = String(b.status || '').toUpperCase();
          return pending > 0 && status !== 'PAID';
        }).length
      : 0;

    const agreementAbsentCount = (tenants || []).filter(
      t => !String((t as any).agreement_url || '').trim(),
    ).length;
    const adharAbsentCount = (tenants || []).filter(
      t => !String((t as any).adhar_card_url || '').trim(),
    ).length;

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
      expectedThisYear,
      collectedThisYear,
      pendingThisYear,
      collectionPctYear,
      rentBilledThisMonth,
      allPending,
      prevMonthsPending,
      overdueBillsCount,
      joinThisMonth,
      vacatedThisMonth,
      electricityUnitsThisMonth,
      electricityChargesThisMonth,
      waterChargesThisMonth,
      adHocThisMonth,
      rentBilledThisYear,
      electricityChargesThisYear,
      waterChargesThisYear,
      adHocThisYear,
      tenantsWithDuesCount,
      avgDuePerTenant,
      highestOutstandingTenantName,
      highestOutstandingAmount: highestOutstanding?.amount ?? 0,
      missingBillsForOccupied,
      electricityUnitRate: setting?.electricity_unit ?? 0,
      rentDay,
      dueDay,
      afterRentGate,
      afterDueGate,
      tenantsMissingBillsAfterRentDayCount,
      billsUnpaidAfterDueDayCount,
      agreementAbsentCount,
      adharAbsentCount,
    };
  }, [rooms, tenants, bills, mappings, setting, monthRange, yearRange]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, color: '#6B7280', fontWeight: '800' }}>
          Loading dashboard…
        </Text>
      </View>
    );
  }

  const hasAnyData =
    derived.roomCount > 0 ||
    derived.tenantCount > 0 ||
    (bills || []).length > 0;

  // If nothing is configured yet, show only a single "No data yet" card.
  if (!hasAnyData) {
    return (
      <>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
        >
          <Surface style={styles.emptyCard} elevation={1}>
            <View style={styles.emptyTop}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="home-city-outline"
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptySub}>
                  Add rooms, tenants, or a bill to start tracking occupancy,
                  dues, and utilities.
                </Text>
              </View>
            </View>
            <View style={styles.emptyActions}>
              <TouchableRipple
                onPress={() => openTab('Rooms', 'RoomList')}
                style={styles.emptyBtn}
                borderless
              >
                <View style={styles.emptyBtnInner}>
                  <Icon
                    source="home-city-outline"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.emptyBtnText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Rooms
                  </Text>
                </View>
              </TouchableRipple>
              <TouchableRipple
                onPress={() => openTab('Tenant', 'TenantList')}
                style={styles.emptyBtn}
                borderless
              >
                <View style={styles.emptyBtnInner}>
                  <Icon
                    source="account-group"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.emptyBtnText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Tenants
                  </Text>
                </View>
              </TouchableRipple>
              <TouchableRipple
                onPress={() => openTab('Payments', 'PaymentList')}
                style={styles.emptyBtn}
                borderless
              >
                <View style={styles.emptyBtnInner}>
                  <Icon
                    source="credit-card-outline"
                    size={16}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={[
                      styles.emptyBtnText,
                      { color: theme.colors.primary },
                    ]}
                  >
                    Payments
                  </Text>
                </View>
              </TouchableRipple>
            </View>
          </Surface>
        </ScrollView>

        <BillingMonthPickerDialog
          visible={billingPickerOpen}
          value={selectedBillingMonth}
          onDismiss={() => setBillingPickerOpen(false)}
          onConfirm={d => {
            setSelectedBillingMonth(d);
            setBillingPickerOpen(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
          />
        }
      >
        {/* HERO */}
        <Surface style={styles.hero} elevation={2}>
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.heroHeaderIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon
                source="view-dashboard-outline"
                size={18}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroHeaderTitle} numberOfLines={1}>
                Dashboard
              </Text>
              <Text style={styles.heroHeaderSub} numberOfLines={1}>
                Quick overview
              </Text>
            </View>
            <Chip
              icon="calendar-month"
              onPress={() => setBillingPickerOpen(true)}
              style={[
                styles.heroChip,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
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
                  <View
                    style={[
                      styles.heroOccBadge,
                      { backgroundColor: '#ECFDF3', borderColor: '#86EFAC' },
                    ]}
                  >
                    <View
                      style={[
                        styles.heroOccBadgeIcon,
                        { backgroundColor: '#DCFCE7' },
                      ]}
                    >
                      <Icon source="door-closed" size={14} color="#16A34A" />
                    </View>
                    <View style={styles.heroOccBadgeText}>
                      <Text
                        style={[styles.heroOccBadgeValue, { color: '#16A34A' }]}
                        numberOfLines={1}
                      >
                        {derived.occupiedRooms}
                      </Text>
                      <Text
                        style={[styles.heroOccBadgeLabel, { color: '#16A34A' }]}
                        numberOfLines={1}
                      >
                        Occupied
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.heroOccBadge,
                      { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
                    ]}
                  >
                    <View
                      style={[
                        styles.heroOccBadgeIcon,
                        { backgroundColor: '#FFEDD5' },
                      ]}
                    >
                      <Icon source="door-open" size={14} color="#F97316" />
                    </View>
                    <View style={styles.heroOccBadgeText}>
                      <Text
                        style={[styles.heroOccBadgeValue, { color: '#F97316' }]}
                        numberOfLines={1}
                      >
                        {derived.vacantRooms}
                      </Text>
                      <Text
                        style={[styles.heroOccBadgeLabel, { color: '#F97316' }]}
                        numberOfLines={1}
                      >
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
                {
                  backgroundColor: '#FFFFFF',
                  borderColor:
                    (theme.colors as any).outlineVariant ??
                    theme.colors.outline,
                },
              ]}
              elevation={0}
            >
              <View style={styles.rentStripHeader}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.rentStripTitleRow}>
                    <View
                      style={[
                        styles.rentStripIcon,
                        { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <Icon
                        source="cash-multiple"
                        size={18}
                        color={theme.colors.primary}
                      />
                    </View>
                    <Text style={styles.rentStripTitle} numberOfLines={1}>
                      Monthly Rent
                    </Text>
                  </View>
                </View>

                <Text
                  style={[
                    styles.rentStripTotal,
                    { color: theme.colors.primary },
                  ]}
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
                    borderColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
                elevation={0}
              >
                <View style={styles.paymentStripRow}>
                  <PaymentStat
                    icon="cash"
                    label="Paid"
                    amount={formatMoney(derived.collectedThisMonth)}
                    color={theme.colors.primary}
                  />
                  <View
                    style={[
                      styles.paymentStripDivider,
                      {
                        backgroundColor:
                          (theme.colors as any).outlineVariant ??
                          theme.colors.outline,
                      },
                    ]}
                  />
                  <PaymentStat
                    icon="clock-outline"
                    label="Pending"
                    amount={formatMoney(derived.pendingThisMonth)}
                    color={
                      derived.pendingThisMonth > 0
                        ? theme.colors.error
                        : theme.colors.primary
                    }
                  />
                </View>
                <ProgressBar
                  progress={clamp01(
                    derived.expectedThisMonth
                      ? derived.collectedThisMonth / derived.expectedThisMonth
                      : 0,
                  )}
                  color={theme.colors.primary}
                  style={styles.paymentProgress}
                />
              </Surface>
            </Surface>
          </View>
        </Surface>

        {/* UTILITIES */}

        <Surface style={styles.utilStrip} elevation={1}>
          <View style={styles.utilHeaderRow}>
            <View
              style={[
                styles.utilHeaderIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon
                source="cash-multiple"
                size={18}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.utilHeaderTitle} numberOfLines={1}>
                Monthly Rent Breakdown
              </Text>
              <Text style={styles.utilHeaderSub} numberOfLines={1}>
                Bills generated in {monthLabel}
              </Text>
            </View>
            <TouchableRipple
              onPress={() => openTab('Settings')}
              borderless
              style={styles.utilHeaderCta}
            >
              <View style={styles.utilHeaderCtaInner}>
                <Icon
                  source="cog-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.utilHeaderCtaText,
                    { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  Rates
                </Text>
              </View>
            </TouchableRipple>
          </View>

          <Surface
            style={[
              styles.utilGridCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  (theme.colors as any).outlineVariant ?? theme.colors.outline,
              },
            ]}
            elevation={0}
          >
            <View style={styles.utilRow}>
              <UtilityStat
                icon="home-city-outline"
                label="Rent"
                value={formatMoney(derived.rentBilledThisMonth)}
                color={theme.colors.primary}
                sub="Billed (rent only)"
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="flash-outline"
                label="Electricity"
                value={formatMoney(derived.electricityChargesThisMonth)}
                color={theme.colors.primary}
                sub={
                  derived.electricityUnitRate > 0
                    ? `Rate ₹${derived.electricityUnitRate}/unit`
                    : 'Charges'
                }
              />
            </View>

            <View
              style={[
                styles.utilDividerH,
                {
                  backgroundColor:
                    (theme.colors as any).outlineVariant ??
                    theme.colors.outline,
                },
              ]}
            />

            <View style={styles.utilRow}>
              <UtilityStat
                icon="water-outline"
                label="Water"
                value={formatMoney(derived.waterChargesThisMonth)}
                color={theme.colors.primary}
                sub="Charges"
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="note-text-outline"
                label="Ad-hoc"
                value={formatMoney(derived.adHocThisMonth)}
                color={theme.colors.primary}
                sub="Charges"
              />
            </View>
          </Surface>
        </Surface>

        {/* ALERTS */}
        <Surface style={[styles.utilStrip, { marginTop: 14 }]} elevation={1}>
          <View style={styles.utilHeaderRow}>
            <View
              style={[
                styles.utilHeaderIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon source="alert" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.utilHeaderTitle} numberOfLines={1}>
                Attention needed
              </Text>
              <Text style={styles.utilHeaderSub} numberOfLines={1}>
                Billing & collections follow-up
              </Text>
            </View>
            <TouchableRipple
              onPress={() => openTab('Payments', 'PaymentList')}
              borderless
              style={styles.utilHeaderCta}
            >
              <View style={styles.utilHeaderCtaInner}>
                <Icon
                  source="credit-card-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.utilHeaderCtaText,
                    { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  Payments
                </Text>
              </View>
            </TouchableRipple>
          </View>

          <Surface
            style={[
              styles.utilGridCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  (theme.colors as any).outlineVariant ?? theme.colors.outline,
              },
            ]}
            elevation={0}
          >
            <View style={styles.utilRow}>
              <UtilityStat
                icon="cash-multiple"
                label="Bills not generated"
                value={String(derived.tenantsMissingBillsAfterRentDayCount)}
                color={theme.colors.primary}
                valueIndent="label"
                sub={
                  derived.rentDay
                    ? derived.afterRentGate
                      ? `Rent day: ${derived.rentDay}`
                      : `Starts on rent day ${derived.rentDay}`
                    : 'Set rent day (Settings)'
                }
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="calendar-alert"
                label="Bills unpaid"
                value={String(derived.billsUnpaidAfterDueDayCount)}
                color={
                  derived.billsUnpaidAfterDueDayCount > 0
                    ? theme.colors.error
                    : theme.colors.primary
                }
                valueIndent="label"
                sub={
                  derived.dueDay
                    ? derived.afterDueGate
                      ? `Due day: ${derived.dueDay}`
                      : `Starts on due day ${derived.dueDay}`
                    : 'Set due day (Settings)'
                }
              />
            </View>

            <View
              style={[
                styles.utilDividerH,
                {
                  backgroundColor:
                    (theme.colors as any).outlineVariant ??
                    theme.colors.outline,
                },
              ]}
            />

            <View style={styles.utilRow}>
              <UtilityStat
                icon="file-document-outline"
                label="Agreement absent"
                value={String(derived.agreementAbsentCount)}
                color={
                  derived.agreementAbsentCount > 0
                    ? theme.colors.error
                    : theme.colors.primary
                }
                sub={undefined}
                valueIndent="label"
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="card-account-details-outline"
                label="Aadhaar absent"
                value={String(derived.adharAbsentCount)}
                color={
                  derived.adharAbsentCount > 0
                    ? theme.colors.error
                    : theme.colors.primary
                }
                sub={undefined}
                valueIndent="label"
              />
            </View>
          </Surface>
        </Surface>

        {/* YEARLY CHARGES */}
        <Surface
          style={[
            styles.rentStrip,
            {
              marginTop: 14,
              backgroundColor: '#FFFFFF',
              borderColor:
                (theme.colors as any).outlineVariant ?? theme.colors.outline,
            },
          ]}
          elevation={0}
        >
          <View style={styles.rentStripHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.rentStripTitleRow}>
                <View
                  style={[
                    styles.rentStripIcon,
                    { backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Icon
                    source="cash-multiple"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rentStripTitle} numberOfLines={1}>
                    Yearly Rent
                  </Text>
                  <Text style={styles.yearlyRentSub} numberOfLines={1}>
                    Bills generated in {yearLabel}
                  </Text>
                </View>
              </View>
            </View>

            <Text
              style={[
                styles.yearlyRentHeaderAmount,
                { color: theme.colors.primary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {formatMoney(derived.expectedThisYear)}
            </Text>
          </View>

          <Surface
            style={[
              styles.paymentStrip,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  (theme.colors as any).outlineVariant ?? theme.colors.outline,
              },
            ]}
            elevation={0}
          >
            <View style={styles.paymentStripRow}>
              <PaymentStat
                icon="cash"
                label="Paid"
                amount={formatMoney(derived.collectedThisYear)}
                color={theme.colors.primary}
              />
              <View
                style={[
                  styles.paymentStripDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <PaymentStat
                icon="clock-outline"
                label="Pending"
                amount={formatMoney(derived.pendingThisYear)}
                color={
                  derived.pendingThisYear > 0
                    ? theme.colors.error
                    : theme.colors.primary
                }
              />
            </View>
            <ProgressBar
              progress={clamp01(
                derived.expectedThisYear
                  ? derived.collectedThisYear / derived.expectedThisYear
                  : 0,
              )}
              color={theme.colors.primary}
              style={styles.paymentProgress}
            />
          </Surface>
        </Surface>

        <Surface style={[styles.utilStrip, { marginTop: 14 }]} elevation={1}>
          <View style={styles.utilHeaderRow}>
            <View
              style={[
                styles.utilHeaderIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon
                source="calendar-month"
                size={18}
                color={theme.colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.utilHeaderTitle} numberOfLines={1}>
                Yearly Rent Breakdown
              </Text>
              <Text style={styles.utilHeaderSub} numberOfLines={1}>
                Bills generated in {yearLabel}
              </Text>
            </View>
            <TouchableRipple
              onPress={() => openTab('Settings')}
              borderless
              style={styles.utilHeaderCta}
            >
              <View style={styles.utilHeaderCtaInner}>
                <Icon
                  source="cog-outline"
                  size={16}
                  color={theme.colors.primary}
                />
                <Text
                  style={[
                    styles.utilHeaderCtaText,
                    { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  Rates
                </Text>
              </View>
            </TouchableRipple>
          </View>

          <Surface
            style={[
              styles.utilGridCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor:
                  (theme.colors as any).outlineVariant ?? theme.colors.outline,
              },
            ]}
            elevation={0}
          >
            <View style={styles.utilRow}>
              <UtilityStat
                icon="home-city-outline"
                label="Rent"
                value={formatMoney(derived.rentBilledThisYear)}
                color={theme.colors.primary}
                sub="Billed (rent only)"
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="flash-outline"
                label="Electricity"
                value={formatMoney(derived.electricityChargesThisYear)}
                color={theme.colors.primary}
                sub={
                  derived.electricityUnitRate > 0
                    ? `Rate ₹${derived.electricityUnitRate}/unit`
                    : 'Charges'
                }
              />
            </View>

            <View
              style={[
                styles.utilDividerH,
                {
                  backgroundColor:
                    (theme.colors as any).outlineVariant ??
                    theme.colors.outline,
                },
              ]}
            />

            <View style={styles.utilRow}>
              <UtilityStat
                icon="water-outline"
                label="Water"
                value={formatMoney(derived.waterChargesThisYear)}
                color={theme.colors.primary}
                sub="Charges"
              />
              <View
                style={[
                  styles.utilDividerV,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <UtilityStat
                icon="note-text-outline"
                label="Ad-hoc"
                value={formatMoney(derived.adHocThisYear)}
                color={theme.colors.primary}
                sub="Charges"
              />
            </View>
          </Surface>
        </Surface>

        <View style={{ height: 24 }} />
      </ScrollView>

      <BillingMonthPickerDialog
        visible={billingPickerOpen}
        value={selectedBillingMonth}
        onDismiss={() => setBillingPickerOpen(false)}
        onConfirm={d => {
          setSelectedBillingMonth(d);
          setBillingPickerOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 24 },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6FA',
  },

  // Support-module standard: white Surface, subtle border, compact header.
  hero: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroHeaderTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  heroHeaderSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 12,
  },
  heroChip: { borderRadius: 999 },
  heroGrid: { marginTop: 14, flexDirection: 'column', gap: 12 },
  heroStatLabel: {
    color: '#6B7280',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
  },
  heroStatValue: {
    fontWeight: '900',
    fontSize: 24,
    marginTop: 6,
    color: '#111827',
  },
  heroStatSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },
  heroOccWide: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroOccRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroOccLeft: { flex: 1, minWidth: 0 },
  heroOccValue: {
    fontWeight: '900',
    fontSize: 29,
    marginTop: 4,
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  heroOccSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },
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
  heroOccBadgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOccBadgeText: { flex: 1, minWidth: 0 },
  heroOccBadgeValue: {
    fontWeight: '900',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  heroOccBadgeLabel: { fontWeight: '900', fontSize: 12, opacity: 0.95 },
  rentStrip: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  rentStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rentStripTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rentStripIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentStripTitle: {
    color: '#111827',
    fontWeight: '900',
    fontSize: 15,
    flex: 1,
  },
  yearlyRentSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },
  rentStripTotal: {
    fontWeight: '900',
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    maxWidth: 180,
  },
  yearlyRentHeaderAmount: {
    fontWeight: '900',
    fontSize: 24,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    maxWidth: 200,
  },

  paymentStrip: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  paymentStripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentStripDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    borderRadius: 1,
  },
  paymentStat: { flex: 1 },
  paymentStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentStatLabel: { color: '#6B7280', fontWeight: '800', fontSize: 12 },
  paymentStatAmount: {
    marginTop: 6,
    fontWeight: '900',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  paymentProgress: { marginTop: 10, height: 6, borderRadius: 999 },

  utilStrip: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  utilHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  utilHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilHeaderTitle: { fontWeight: '900', fontSize: 15, color: '#111827' },
  utilHeaderSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },
  utilHeaderCta: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' },
  utilHeaderCtaInner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  utilHeaderCtaText: { fontWeight: '900', fontSize: 13 },

  utilGridCard: { borderRadius: 16, borderWidth: 1, padding: 10 },
  utilRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  utilDividerV: {
    width: StyleSheet.hairlineWidth,
    height: 58,
    borderRadius: 1,
  },
  utilDividerH: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    opacity: 0.9,
  },
  utilStat: { flex: 1, minWidth: 0 },
  utilStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  utilStatLabel: { color: '#6B7280', fontWeight: '800', fontSize: 12 },
  utilStatValue: {
    marginTop: 6,
    fontWeight: '900',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  // Align value/sub under the label start (after the icon + gap).
  utilStatValueIndent: { marginLeft: 22 },
  utilStatSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 12,
  },

  emptyCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontWeight: '900', fontSize: 18, color: '#111827' },
  emptySub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 13 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  emptyBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyBtnInner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  emptyBtnText: { fontWeight: '900', fontSize: 13 },

  alertCard: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontWeight: '900', fontSize: 15, color: '#111827' },
  alertSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 13 },
  alertCta: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB' },
  alertCtaInner: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertCtaText: { fontWeight: '900', fontSize: 13 },
  alertMiniRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  alertChip: { borderRadius: 999 },
});
