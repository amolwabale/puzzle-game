import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
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
  HelperText,
  Icon,
  IconButton,
  Provider as PaperProvider,
  Surface,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
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

const scalePaperThemeFonts = (t: any, scale: number) => {
  const s = Number.isFinite(scale) ? scale : 1;
  const fonts = t?.fonts ?? {};
  const nextFonts: Record<string, any> = { ...fonts };
  Object.keys(nextFonts).forEach((k) => {
    const v = nextFonts[k];
    if (!v || typeof v !== 'object') return;
    const nv: any = { ...v };
    if (typeof nv.fontSize === 'number') nv.fontSize = Math.round(nv.fontSize * s);
    if (typeof nv.lineHeight === 'number') nv.lineHeight = Math.round(nv.lineHeight * s);
    if (typeof nv.letterSpacing === 'number') nv.letterSpacing = Number((nv.letterSpacing * s).toFixed(2));
    nextFonts[k] = nv;
  });
  return { ...t, fonts: nextFonts };
};

export default function PaymentFormScreen() {
  const theme = useTheme();
  const scaledTheme = React.useMemo(() => scalePaperThemeFonts(theme, 1.15), [theme]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const billId: number | undefined = route.params?.billId;
  const isEdit = !!billId;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editingBill, setEditingBill] = React.useState<BillRecord | null>(null);

  const [rooms, setRooms] = React.useState<RoomRecord[]>([]);
  const [assignments, setAssignments] = React.useState<
    Array<{ room: RoomRecord; tenant: TenantRecord }>
  >([]);
  const [settings, setSettings] = React.useState<{ water: number; electricity_unit: number }>({
    water: 0,
    electricity_unit: 0,
  });

  const [pairQuery, setPairQuery] = React.useState('');
  const [selectedRoom, setSelectedRoom] = React.useState<RoomRecord | null>(null);
  const [selectedTenant, setSelectedTenant] = React.useState<TenantRecord | null>(null);

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

      const roomIdList = (r || []).map((x) => x.id);
      const activeByRoom = await fetchActiveTenantsForRooms(roomIdList);
      const pairs: Array<{ room: RoomRecord; tenant: TenantRecord }> = [];

      (r || []).forEach((room) => {
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
          Alert.alert('Not allowed', 'You can edit a bill only when paid amount is 0.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
          return;
        }

        setEditingBill(b);

        const room = (r || []).find((x) => x.id === b.room_id) || null;
        const tenant = (t || []).find((x) => x.id === b.tenant_id) || null;

        if (!room || !tenant) {
          throw new Error('Could not load room/tenant for this bill');
        }

        setSelectedRoom(room);
        setSelectedTenant(tenant);
        setPairQuery('');
        setErrors({});

        setPreviousMeter(Number(b.previous_month_meter_reading || 0));
        setCurrentMeter(String(Number(b.current_month_meter_reading || 0)));
        setAdHocAmount(b.ad_hoc_amount != null ? String(Number(b.ad_hoc_amount || 0)) : '');
        setAdHocComment(b.ad_hoc_comment || '');
      } else {
        setEditingBill(null);
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
    if (adHocAmount && !/^\d+$/.test(adHocAmount)) e.adHocAmount = 'Numbers only';

    if (selectedRoom && currentMeter && Number(currentMeter) < previousMeter) {
      e.currentMeter = `Must be ≥ previous (${previousMeter})`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const selectPair = async (pair: { room: RoomRecord; tenant: TenantRecord }) => {
    setSelectedRoom(pair.room);
    setSelectedTenant(pair.tenant);
    setPairQuery('');
    setErrors((p) => ({ ...p, pair: '' }));

    try {
      const latest = await fetchLatestMeterReadingForRoom({ roomId: pair.room.id });
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

      if (isEdit && billId) {
        const paidAmount = editingBill?.paid_amount != null ? Number(editingBill.paid_amount) : 0;
        const status = editingBill?.status ? String(editingBill.status) : 'UNPAID';

        await updateBill({
          billId,
          tenantId: selectedTenant.id,
          roomId: selectedRoom.id,
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
            const latestMr = await fetchLatestMeterReadingForRoom({ roomId: selectedRoom.id });
            if (latestMr?.id != null) {
              await updateMeterReading({ id: latestMr.id, unit: curr });
            }
          }
        } catch {
          // non-blocking: bill is updated; meter sync is best-effort
        }

        Alert.alert('Updated', 'Payment updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      // 1) Create bill
      await createBill({
        tenantId: selectedTenant.id,
        roomId: selectedRoom.id,
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
      <PaperProvider theme={scaledTheme}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  return (
    <>
      <PaperProvider theme={scaledTheme}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View>
            {/* HERO */}
            <Surface style={styles.hero} elevation={2}>
              <Avatar.Icon
                size={52}
                icon="file-document-outline"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.primary}
              />
              <View style={{ marginLeft: 14 }}>
                <Text variant="titleLarge" style={{ fontWeight: '800' }}>
                  {isEdit ? 'Edit Payment' : 'Add Payment'}
                </Text>
                <Text style={{ color: '#666', marginTop: 2 }}>
                  {isEdit ? 'Update this bill' : 'Capture rent & utilities'}
                </Text>
              </View>
            </Surface>

            {/* SELECTION */}
            <Surface style={styles.section} elevation={2}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Select Tenant & Room
              </Text>

            {!selectedRoom || !selectedTenant ? (
              <>
                <Surface style={styles.occupancyHint} elevation={0}>
                  <Avatar.Icon
                    size={40}
                    icon="swap-horizontal"
                    style={{ backgroundColor: theme.colors.primaryContainer }}
                    color={theme.colors.primary}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '700' }}>Select an occupied room</Text>
                    <Text style={{ color: '#666', marginTop: 2 }}>
                      Search by room or tenant name (Room - Tenant).
                    </Text>
                  </View>
                </Surface>

                <TextInput
                  label="Search Room - Tenant *"
                  mode="outlined"
                  value={pairQuery}
                  onChangeText={(t) => {
                    setPairQuery(t);
                    setErrors((p) => ({ ...p, pair: '' }));
                  }}
                  left={<TextInput.Icon icon="magnify" />}
                  error={!!errors.pair}
                />
                <HelperText type="error" visible={!!errors.pair}>
                  {errors.pair || ' '}
                </HelperText>

                {filteredPairs.length > 0 && (
                  <Surface style={styles.dropdown} elevation={2}>
                    <View style={styles.dropdownClip}>
                      {filteredPairs.slice(0, 8).map(({ room, tenant }) => (
                        <TouchableOpacity
                          key={`${room.id}-${tenant.id}`}
                          style={styles.dropdownItem}
                          onPress={() => selectPair({ room, tenant })}
                        >
                          <Text style={{ fontWeight: '800' }}>
                            {(room.name || '-') + ' - ' + (tenant.name || '-')}
                          </Text>
                          <Text style={{ color: '#666', fontSize: 14, marginTop: 2 }}>
                            Rent: {room.rent ? formatMoney(Number(room.rent)) : '-'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Surface>
                )}

                {pairQuery.trim().length > 0 && filteredPairs.length === 0 && (
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
                    {(selectedRoom.name || '-') + ' - ' + (selectedTenant.name || '-')}
                  </Text>
                  <Text style={{ color: '#666', marginTop: 2 }}>
                    Rent {selectedRoom.rent ? formatMoney(Number(selectedRoom.rent)) : '-'}
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
          </Surface>

          {/* METER + ADHOC */}
          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Meter & Charges
            </Text>

            <Surface style={styles.readingRow} elevation={0}>
              <Icon source="counter" size={20} color={theme.colors.primary} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontWeight: '700' }}>Previous reading</Text>
                <Text style={{ color: '#666', marginTop: 2 }}>{previousMeter}</Text>
              </View>
            </Surface>

            <TextInput
              label="Current Meter Reading *"
              value={currentMeter}
              onChangeText={(t) => {
                const next = t.replace(/[^\d]/g, '');
                setCurrentMeter(next);
                setErrors((p) => ({ ...p, currentMeter: '' }));
              }}
              mode="outlined"
              keyboardType="number-pad"
              left={<TextInput.Icon icon="counter" />}
              error={!!errors.currentMeter}
            />
            <HelperText type="error" visible={!!errors.currentMeter}>
              {errors.currentMeter || ' '}
            </HelperText>

            <TextInput
              label="Ad-hoc Amount"
              value={adHocAmount}
              onChangeText={(t) => {
                const next = t.replace(/[^\d]/g, '');
                setAdHocAmount(next);
                setErrors((p) => ({ ...p, adHocAmount: '' }));
              }}
              mode="outlined"
              keyboardType="number-pad"
              left={<TextInput.Icon icon="cash-plus" />}
              error={!!errors.adHocAmount}
            />
            <HelperText type="error" visible={!!errors.adHocAmount}>
              {errors.adHocAmount || ' '}
            </HelperText>

            <TextInput
              label="Ad-hoc Comment"
              value={adHocComment}
              onChangeText={setAdHocComment}
              mode="outlined"
              multiline
              left={<TextInput.Icon icon="comment-text-outline" />}
            />
          </Surface>

          {/* SUMMARY */}
          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Summary
            </Text>

            <Surface
              style={[
                styles.summaryHero,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
              elevation={0}
            >
              <View style={styles.summaryHeroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryHeroLabel}>Total payable</Text>
                  <Text style={styles.summaryHeroValue}>{formatMoney(total)}</Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>UNPAID</Text>
                </View>
              </View>
            </Surface>

            <View style={styles.tileGrid}>
              <SummaryTile
                icon="home-city-outline"
                label="Rent"
                value={formatMoney(rent)}
              />
              <SummaryTile
                icon="water-outline"
                label="Water"
                value={formatMoney(water)}
              />
              <SummaryTile
                icon="flash-outline"
                label="Electricity"
                value={formatMoney(electricity)}
                sub={`${diffUnits} × ${settings.electricity_unit}`}
              />
              <SummaryTile
                icon="cash-plus"
                label="Ad-hoc"
                value={formatMoney(adHoc)}
                sub={adHocComment?.trim() ? adHocComment.trim() : undefined}
              />
            </View>

            <View style={styles.meterSection}>
              <View style={styles.meterGrid}>
                <MeterTile kind="prev" title="Previous" month={prevLabel} value={previousMeter} />
                <MeterTile
                  kind="curr"
                  title="Current"
                  month={currLabel}
                  value={currentMeter.trim().length > 0 ? currentMeterNum : null}
                />
              </View>
            </View>
          </Surface>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <FAB
          icon="content-save"
          style={styles.fab}
          loading={saving}
          onPress={save}
        />
      </PaperProvider>
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
}) => (
  <Surface style={styles.summaryTile} elevation={0}>
    <View style={{ flex: 1 }}>
      <View style={styles.tileTop}>
        <Icon source={icon} size={20} color="#1A73E8" />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.tileSub, !sub && styles.tileSubPlaceholder]} numberOfLines={1}>
        {sub || ' '}
      </Text>
    </View>
  </Surface>
);

const MetaPill = ({ icon, label }: { icon: string; label: string }) => (
  <Surface style={styles.metaPill} elevation={0}>
    <Icon source={icon} size={16} color="#1A73E8" />
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
}) => (
  <Surface
    style={[
      styles.meterTile,
      kind === 'curr' ? styles.meterTileCurr : styles.meterTilePrev,
    ]}
    elevation={0}
  >
    <View style={{ flex: 1 }}>
      <View style={styles.tileTop}>
        <Icon source="counter" size={20} color="#1A73E8" />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value != null ? String(value) : '-'}
      </Text>
      <Text style={[styles.tileSub, !month && styles.tileSubPlaceholder]} numberOfLines={1}>
        {month || ' '}
      </Text>
    </View>
  </Surface>
);

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, backgroundColor: '#F4F6FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },

  dropdown: {
    borderRadius: 12,
    marginBottom: 12,
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
    backgroundColor: '#EEF2FF',
  },

  occupancyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F8FF',
    marginBottom: 12,
  },

  readingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F8FF',
    marginBottom: 12,
  },

  summaryHero: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
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
    backgroundColor: '#FFF5F5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#F3B5B5',
  },
  statusPillText: {
    color: '#D32F2F',
    fontWeight: '900',
    fontSize: 14,
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
  tileLabel: { color: '#666', fontWeight: '800', flex: 1 },
  tileValue: {
    marginTop: 10,
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  tileSub: {
    marginTop: 4,
    color: '#777',
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

  fab: { position: 'absolute', right: 16, bottom: 24 },
});

