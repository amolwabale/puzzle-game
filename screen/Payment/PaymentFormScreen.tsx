import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  FAB,
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createBill,
  fetchBillById,
  fetchLatestBillForRoom,
  fetchLatestSetting,
  type BillRecord,
  updateBill,
} from '../../service/BillService';
import {
  createMeterReading,
  fetchLatestMeterReadingForRoom,
  updateMeterReading,
} from '../../service/MeterReadingService';
import { fetchRooms, RoomRecord } from '../../service/RoomService';
import { fetchTenants, TenantRecord } from '../../service/tenantService';
import { fetchActiveTenantsForRooms } from '../../service/TenantRoomService';
import { FormInput } from '../../components/FormInput';
import {
  BillingMonthPickerDialog,
  formatBillingMonthLabel,
  normalizeBillingMonthDate,
} from '../../components/BillingMonthPicker';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';
const formatMoney = (n: number) => `₹${Math.round(n)}`;

const formatMonth = (d: Date) =>
  d.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });

function getPrevAndCurrMonthLabels(date?: Date) {
  const base = date ?? new Date();
  const currMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const prevMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);

  const currLabel = formatMonth(currMonth);
  const prevLabel =
    prevMonth.getFullYear() !== currMonth.getFullYear()
      ? formatMonth(prevMonth)
      : prevMonth.toLocaleDateString('en-GB', { month: 'short' });

  return { prevLabel, currLabel };
}

export default function PaymentFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const billId: number | undefined = route.params?.billId;
  const isEdit = !!billId;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const [editingBill, setEditingBill] = React.useState<BillRecord | null>(null);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent as any, e => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const [rooms, setRooms] = React.useState<RoomRecord[]>([]);
  const [assignments, setAssignments] = React.useState<
    Array<{ room: RoomRecord; tenant: TenantRecord }>
  >([]);
  const [settings, setSettings] = React.useState<{
    water: number;
    electricity_unit: number;
  }>({
    water: 0,
    electricity_unit: 0,
  });

  const [pairQuery, setPairQuery] = React.useState('');
  const [selectedRoom, setSelectedRoom] = React.useState<RoomRecord | null>(
    null,
  );
  const [selectedTenant, setSelectedTenant] =
    React.useState<TenantRecord | null>(null);

  const [billingMonth, setBillingMonth] = React.useState<Date>(() =>
    normalizeBillingMonthDate(new Date()),
  );
  const [billingMonthOpen, setBillingMonthOpen] = React.useState(false);

  const [previousMeter, setPreviousMeter] = React.useState<number>(0);
  const [currentMeter, setCurrentMeter] = React.useState('');
  const [adHocAmount, setAdHocAmount] = React.useState('');
  const [adHocComment, setAdHocComment] = React.useState('');

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [r, s, t, b] = await Promise.all([
        fetchRooms(),
        fetchLatestSetting(),
        fetchTenants(),
        isEdit && billId ? fetchBillById(billId) : Promise.resolve(null),
      ]);
      setRooms(r || []);
      setSettings(s);

      const roomIdList = (r || []).map(x => x.id);
      const activeByRoom = await fetchActiveTenantsForRooms(roomIdList);
      const pairs: Array<{ room: RoomRecord; tenant: TenantRecord }> = [];

      (r || []).forEach(room => {
        const active = activeByRoom?.[room.id];
        if (active?.tenant) {
          pairs.push({ room, tenant: active.tenant });
        }
      });

      setAssignments(pairs);

      if (isEdit) {
        if (!b) throw new Error('Bill not found');

        const alreadyPaid = Number(b.paid_amount || 0) > 0;
        if (alreadyPaid) {
          Alert.alert(
            'Not allowed',
            'You can edit a bill only when paid amount is 0.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
          return;
        }

        setEditingBill(b);

        const room = (r || []).find(x => x.id === b.room_id) || null;
        const tenant = (t || []).find(x => x.id === b.tenant_id) || null;

        if (!room || !tenant) {
          throw new Error('Could not load room/tenant for this bill');
        }

        setSelectedRoom(room);
        setSelectedTenant(tenant);
        setPairQuery('');
        setErrors({});

        setPreviousMeter(Number(b.previous_month_meter_reading || 0));
        setCurrentMeter(String(Number(b.current_month_meter_reading || 0)));
        setAdHocAmount(
          b.ad_hoc_amount != null ? String(Number(b.ad_hoc_amount || 0)) : '',
        );
        setAdHocComment(b.ad_hoc_comment || '');

        const bmBase = b.billing_month
          ? new Date(b.billing_month)
          : new Date(b.created_at);
        setBillingMonth(normalizeBillingMonthDate(bmBase));
      } else {
        setEditingBill(null);
        setBillingMonth(normalizeBillingMonthDate(new Date()));
      }
    } catch (e: any) {
      Alert.alert('Load Failed', e.message || 'Could not load payment form');
    } finally {
      setLoading(false);
    }
  }, [billId, isEdit]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  const filteredPairs =
    pairQuery.trim().length > 0
      ? assignments.filter(({ room, tenant }) => {
          const label = `${room.name || ''}-${tenant.name || ''}`.toLowerCase();
          return label.includes(pairQuery.toLowerCase());
        })
      : [];

  const rent = selectedRoom?.rent ? Number(selectedRoom.rent) : 0;
  const water = settings.water || 0;
  const currentMeterNum = currentMeter ? Number(currentMeter) : 0;
  const diffUnits = Math.max(0, currentMeterNum - previousMeter);
  const electricity = diffUnits * (settings.electricity_unit || 0);
  const adHoc = adHocAmount ? Number(adHocAmount) : 0;
  const total = rent + water + electricity + adHoc;
  const { prevLabel, currLabel } = getPrevAndCurrMonthLabels();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!selectedRoom || !selectedTenant) e.pair = 'Room-Tenant is required';
    if (!/^\d+$/.test(currentMeter)) e.currentMeter = 'Numbers only';
    if (adHocAmount && !/^\d+$/.test(adHocAmount))
      e.adHocAmount = 'Numbers only';

    if (selectedRoom && currentMeter && Number(currentMeter) < previousMeter) {
      e.currentMeter = `Must be ≥ previous (${previousMeter})`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const selectPair = async (pair: {
    room: RoomRecord;
    tenant: TenantRecord;
  }) => {
    setSelectedRoom(pair.room);
    setSelectedTenant(pair.tenant);
    setPairQuery('');
    setErrors(p => ({ ...p, pair: '' }));

    try {
      const latest = await fetchLatestMeterReadingForRoom({
        roomId: pair.room.id,
      });
      setPreviousMeter(latest?.unit != null ? Number(latest.unit) : 0);
    } catch {
      setPreviousMeter(0);
    }
  };

  const save = async () => {
    if (saving) return; // match Tenant/Room form behavior: keep FAB colored, but prevent double submit
    if (!validate()) return;
    if (!selectedRoom || !selectedTenant) return;

    try {
      setSaving(true);

      const prev = previousMeter;
      const curr = Number(currentMeter);
      const billingMonthIso =
        normalizeBillingMonthDate(billingMonth).toISOString();

      if (isEdit && billId) {
        const paidAmount =
          editingBill?.paid_amount != null
            ? Number(editingBill.paid_amount)
            : 0;
        const status = editingBill?.status
          ? String(editingBill.status)
          : 'UNPAID';

        await updateBill({
          billId,
          tenantId: selectedTenant.id,
          roomId: selectedRoom.id,
          billingMonth: billingMonthIso,
          rent,
          water,
          previousMeter: prev,
          currentMeter: curr,
          electricity,
          totalAmount: total,
          adHocAmount: adHoc,
          adHocComment,
          paidAmount,
          status,
        });

        // If this is the latest bill for this room, sync the latest meter reading row
        // so next month's "previous reading" stays correct.
        try {
          const latestBill = await fetchLatestBillForRoom(selectedRoom.id);
          if (latestBill?.id === billId) {
            const latestMr = await fetchLatestMeterReadingForRoom({
              roomId: selectedRoom.id,
            });
            if (latestMr?.id != null) {
              await updateMeterReading({ id: latestMr.id, unit: curr });
            }
          }
        } catch {
          // non-blocking: bill is updated; meter sync is best-effort
        }

        trackEvent('Payment_Updated', {
          source: 'Payment',
          bill_id: billId,
        });

        Alert.alert('Updated', 'Payment updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      // 1) Create bill
      await createBill({
        tenantId: selectedTenant.id,
        roomId: selectedRoom.id,
        billingMonth: billingMonthIso,
        rent,
        water,
        previousMeter: prev,
        currentMeter: curr,
        electricity,
        totalAmount: total,
        adHocAmount: adHoc,
        adHocComment,
      });

      // 2) Store current month meter reading
      await createMeterReading({
        roomId: selectedRoom.id,
        tenantId: selectedTenant.id,
        unit: curr,
      });

      trackEvent('Payment_Added', {
        source: 'Payment',
        bill_id: billId,
      });

      Alert.alert('Saved', 'Payment captured successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not save payment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View>
            {/* HERO (RoomForm-style) */}
            <Surface style={styles.hero} elevation={2}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="file-document-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {isEdit ? 'Edit payment' : 'Add payment'}
                  </Text>
                  <Text style={styles.sectionSub} numberOfLines={1}>
                    {isEdit ? 'Update this bill' : 'Capture rent & utilities'}
                  </Text>
                </View>
              </View>
            </Surface>

            {/* SELECTION */}
            <Surface style={styles.section} elevation={2}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="swap-horizontal"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  Select tenant & room
                </Text>
              </View>

              {!selectedRoom || !selectedTenant ? (
                <>
                  <Surface style={styles.occupancyHint} elevation={0}>
                    <Avatar.Icon
                      size={40}
                      icon="swap-horizontal"
                      style={{
                        backgroundColor: theme.colors.primaryContainer,
                      }}
                      color={theme.colors.primary}
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: '700' }}>
                        Select an occupied room
                      </Text>
                      <Text style={{ color: '#666', marginTop: 2 }}>
                        Search by room or tenant name (Room - Tenant).
                      </Text>
                    </View>
                  </Surface>

                  <FormInput
                    label="Search room - tenant *"
                    value={pairQuery}
                    onChange={t => {
                      setPairQuery(t);
                      setErrors(p => ({ ...p, pair: '' }));
                    }}
                    error={errors.pair}
                  />

                  {filteredPairs.length > 0 && (
                    <Surface style={styles.dropdown} elevation={0}>
                      <View style={styles.dropdownClip}>
                        {filteredPairs.slice(0, 8).map(({ room, tenant }) => (
                          <TouchableOpacity
                            key={`${room.id}-${tenant.id}`}
                            style={styles.dropdownItem}
                            onPress={() => selectPair({ room, tenant })}
                          >
                            <Text style={{ fontWeight: '800' }}>
                              {(room.name || '-') +
                                ' - ' +
                                (tenant.name || '-')}
                            </Text>
                            <Text
                              style={{
                                color: '#666',
                                fontSize: 14,
                                marginTop: 2,
                              }}
                            >
                              Rent:{' '}
                              {room.rent ? formatMoney(Number(room.rent)) : '-'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </Surface>
                  )}

                  {pairQuery.trim().length > 0 &&
                    filteredPairs.length === 0 && (
                      <Text style={{ color: '#777', marginTop: 8 }}>
                        No occupied rooms found.
                      </Text>
                    )}
                </>
              ) : (
                <Surface style={styles.selectedTile} elevation={1}>
                  <Avatar.Icon size={36} icon="home-city-outline" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '800' }}>
                      {(selectedRoom.name || '-') +
                        ' - ' +
                        (selectedTenant.name || '-')}
                    </Text>
                    <Text style={{ color: '#666', marginTop: 2 }}>
                      Rent{' '}
                      {selectedRoom.rent
                        ? formatMoney(Number(selectedRoom.rent))
                        : '-'}
                    </Text>
                  </View>
                  {!isEdit && (
                    <IconButton
                      icon="close"
                      onPress={() => {
                        setSelectedRoom(null);
                        setSelectedTenant(null);
                        setPairQuery('');
                        setPreviousMeter(0);
                        setCurrentMeter('');
                      }}
                    />
                  )}
                </Surface>
              )}

              {/* Billing month */}
              <TouchableOpacity
                onPress={() => {
                  setBillingMonthOpen(true);
                }}
                activeOpacity={0.85}
                style={[
                  styles.billingMonthRow,
                  {
                    borderColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
              >
                <View
                  style={[
                    styles.billingMonthIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="calendar-month-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.billingMonthBody}>
                  <Text style={styles.billingMonthLabel} numberOfLines={1}>
                    Billing month
                  </Text>
                  <View style={styles.billingMonthPillsRow}>
                    <View
                      style={[
                        styles.billingMonthValuePill,
                        {
                          backgroundColor: theme.colors.primaryContainer,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.billingMonthValuePillText,
                          { color: theme.colors.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {formatBillingMonthLabel(billingMonth)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.billingMonthChangePill,
                        {
                          backgroundColor: theme.colors.primaryContainer,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Icon
                        source="pencil-outline"
                        size={14}
                        color={theme.colors.primary}
                      />
                      <Text
                        style={[
                          styles.billingMonthChangeText,
                          { color: theme.colors.primary },
                        ]}
                        numberOfLines={1}
                      >
                        Change
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Surface>

            {/* METER + ADHOC */}
            <Surface style={styles.section} elevation={2}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="counter"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  Meter & charges
                </Text>
              </View>

              <Surface style={styles.readingRow} elevation={0}>
                <Icon source="counter" size={20} color={theme.colors.primary} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ fontWeight: '700' }}>Previous reading</Text>
                  <Text style={{ color: '#666', marginTop: 2 }}>
                    {previousMeter}
                  </Text>
                </View>
              </Surface>

              <FormInput
                label="Current Meter Reading *"
                value={currentMeter}
                onChange={t => {
                  const next = t.replace(/[^\d]/g, '');
                  setCurrentMeter(next);
                }}
                error={errors.currentMeter}
                maxLength={10}
                keyboard="number-pad"
              />

              <FormInput
                label="Ad-hoc Amount"
                value={adHocAmount}
                onChange={t => {
                  const next = t.replace(/[^\d]/g, '');
                  setAdHocAmount(next);
                }}
                error={errors.adHocAmount}
                maxLength={10}
                keyboard="number-pad"
              />

              <FormInput
                label="Ad-hoc Comment"
                value={adHocComment}
                onChange={setAdHocComment}
                error={errors.adHocComment}
                maxLength={100}
              />
            </Surface>

            {/* SUMMARY */}
            <Surface style={styles.section} elevation={2}>
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="receipt"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  Summary
                </Text>
              </View>

              <Surface
                style={[
                  styles.summaryHero,
                  { backgroundColor: theme.colors.surface },
                ]}
                elevation={0}
              >
                <View style={styles.summaryHeroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryHeroLabel}>Total payable</Text>
                    <Text style={styles.summaryHeroValue}>
                      {formatMoney(total)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: theme.colors.errorContainer,
                        borderColor: theme.colors.error,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: theme.colors.error },
                      ]}
                    >
                      UNPAID
                    </Text>
                  </View>
                </View>
              </Surface>

              <Text style={styles.rentSummaryTitle}>Rent Summary</Text>

              <Surface
                style={[
                  styles.rentSummaryList,
                  {
                    borderColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                    backgroundColor: theme.colors.surface,
                  },
                ]}
                elevation={0}
              >
                <RentSummaryRow
                  icon="home-city-outline"
                  label="Rent"
                  value={formatMoney(rent)}
                />
                <View
                  style={[
                    styles.rentSummaryDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <RentSummaryRow
                  icon="water-outline"
                  label="Water"
                  value={formatMoney(water)}
                />
                <View
                  style={[
                    styles.rentSummaryDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <RentSummaryRow
                  icon="flash-outline"
                  label="Electricity"
                  sub={`${diffUnits} × ${settings.electricity_unit}`}
                  value={formatMoney(electricity)}
                />
                <View
                  style={[
                    styles.rentSummaryDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <RentSummaryRow
                  icon="cash-plus"
                  label="Ad-hoc"
                  sub={adHocComment?.trim() ? adHocComment.trim() : undefined}
                  value={formatMoney(adHoc)}
                />
                <View
                  style={[
                    styles.rentSummaryDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <RentSummaryRow
                  icon="counter"
                  label="Prev meter"
                  sub={prevLabel}
                  value={String(previousMeter)}
                />
                <View
                  style={[
                    styles.rentSummaryDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ??
                        theme.colors.outline,
                    },
                  ]}
                />

                <RentSummaryRow
                  icon="counter"
                  label="Curr meter"
                  sub={currLabel}
                  value={
                    currentMeter.trim().length > 0
                      ? String(currentMeterNum)
                      : '-'
                  }
                />
              </Surface>
            </Surface>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <FAB
        icon="content-save"
        style={[
          styles.fab,
          { bottom: 50 + Math.max(0, keyboardHeight - insets.bottom) },
        ]}
        loading={saving}
        onPress={save}
      />

      <BillingMonthPickerDialog
        visible={billingMonthOpen}
        value={billingMonth}
        onDismiss={() => setBillingMonthOpen(false)}
        onConfirm={d => {
          setBillingMonth(d);
          setBillingMonthOpen(false);
        }}
      />
    </>
  );
}

const SummaryTile = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) => {
  const theme = useTheme();
  return (
    <Surface style={styles.summaryTile} elevation={0}>
      <View style={{ flex: 1 }}>
        <View style={styles.tileTop}>
          <Icon source={icon} size={20} color={theme.colors.primary} />
          <Text style={styles.tileLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={styles.tileValue} numberOfLines={1}>
          {value}
        </Text>
        <Text
          style={[styles.tileSub, !sub && styles.tileSubPlaceholder]}
          numberOfLines={1}
        >
          {sub || ' '}
        </Text>
      </View>
    </Surface>
  );
};

const MetaPill = ({ icon, label }: { icon: string; label: string }) => (
  <Surface style={styles.metaPill} elevation={0}>
    <IconWithTheme source={icon} size={16} />
    <Text style={styles.metaPillText} numberOfLines={1}>
      {label}
    </Text>
  </Surface>
);

const MeterTile = ({
  kind,
  title,
  month,
  value,
}: {
  kind: 'prev' | 'curr';
  title: string;
  month: string;
  value: number | null;
}) => {
  const theme = useTheme();
  const monthColor =
    kind === 'curr' ? theme.colors.secondary : theme.colors.primary;
  return (
    <Surface
      style={[
        styles.meterTile,
        kind === 'curr' ? styles.meterTileCurr : styles.meterTilePrev,
      ]}
      elevation={0}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.tileTop}>
          <Icon source="counter" size={20} color={theme.colors.primary} />
          <Text style={styles.tileLabel} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <Text style={styles.tileValue} numberOfLines={1}>
          {value != null ? String(value) : '-'}
        </Text>
        <Text
          style={[
            styles.tileSub,
            { color: monthColor },
            !month && styles.tileSubPlaceholder,
          ]}
          numberOfLines={1}
        >
          {month || ' '}
        </Text>
      </View>
    </Surface>
  );
};

const IconWithTheme = ({ source, size }: { source: string; size: number }) => {
  const theme = useTheme();
  return <Icon source={source} size={size} color={theme.colors.primary} />;
};

const RentSummaryRow = ({
  icon,
  label,
  sub,
  value,
}: {
  icon: string;
  label: string;
  sub?: string;
  value: string;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const badgeBg = (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  return (
    <View style={styles.rentSummaryRow}>
      <View
        style={[
          styles.rentSummaryIconBadge,
          { borderColor: outline, backgroundColor: badgeBg },
        ]}
      >
        <Icon source={icon} size={16} color="#6B7280" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rentSummaryLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.rentSummarySub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text
        style={styles.rentSummaryValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, backgroundColor: '#F4F6FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  section: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  sectionSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
  },

  dropdown: {
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  dropdownClip: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFF',
  },

  selectedTile: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  billingMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  billingMonthIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billingMonthLabel: { fontWeight: '900', fontSize: 14, color: '#111827' },
  billingMonthBody: { flex: 1, minWidth: 0 },
  billingMonthPillsRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billingMonthValuePill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    maxWidth: '100%',
    alignItems: 'center',
  },
  billingMonthValuePillText: { fontSize: 12, fontWeight: '900' },
  billingMonthChangePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  billingMonthChangeText: { fontSize: 12, fontWeight: '900' },

  occupancyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },

  summaryHero: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryHeroLabel: {
    color: '#444',
    fontWeight: '700',
  },
  summaryHeroValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: '900',
    color: '#111827',
  },
  summaryHeroSub: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontWeight: '900',
    fontSize: 14,
  },

  // Match PaymentViewScreen breakdown list
  rentSummaryTitle: {
    marginTop: 14,
    fontWeight: '900',
    fontSize: 16,
    color: '#111827',
  },
  rentSummaryList: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rentSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rentSummaryDivider: { height: StyleSheet.hairlineWidth, opacity: 0.6 },
  rentSummaryIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rentSummaryLabel: { fontSize: 12, fontWeight: '900', color: '#6B7280' },
  rentSummarySub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  rentSummaryValue: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryTile: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    minHeight: 92,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { color: '#6B7280', fontWeight: '800', flex: 1 },
  tileValue: {
    marginTop: 10,
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  tileSub: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '700',
  },
  tileSubPlaceholder: {
    opacity: 0,
  },

  meterSection: {
    marginTop: 12,
  },
  meterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  meterHeaderText: {
    fontWeight: '900',
    color: '#111827',
    flex: 1,
  },
  meterUnitsChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D6DEFF',
  },
  meterUnitsChipText: {
    fontWeight: '900',
    fontSize: 14,
    color: '#1A73E8',
  },
  meterGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  meterTile: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 92,
  },
  meterTilePrev: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  meterTileCurr: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  meterTileTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  meterTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  meterIconWrap: {
    marginTop: 1,
  },
  meterTitle: {
    fontWeight: '900',
    color: '#111827',
  },
  meterMonthText: {
    marginTop: 2,
    fontWeight: '800',
    fontSize: 14,
  },
  meterMonthTextPrev: { color: '#1A73E8' },
  meterMonthTextCurr: { color: '#0F766E' },
  meterValue: {
    marginTop: 10,
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D6DEFF',
    flex: 1,
  },
  metaPillText: { fontWeight: '800', color: '#1A73E8', fontSize: 14, flex: 1 },

  fab: { position: 'absolute', right: 16 },
});
