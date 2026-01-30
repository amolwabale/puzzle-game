import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  FAB,
  HelperText,
  Provider as PaperProvider,
  Surface,
  Text,
  TextInput,
  Button,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';

import { RoomStackParamList } from '../../navigation/StackParam';
import { fetchRoomById, saveRoom } from '../../service/RoomService';
import {
  addTenantToRoom,
  fetchActiveTenantForRoom,
  fetchTenantHistoryForRoom,
  updateJoiningDate,
  vacateRoom,
  TenantRoomRecord,
  TenantHistoryRecord,
} from '../../service/TenantRoomService';
import { fetchTenants, TenantRecord } from '../../service/tenantService';
import {
  createMeterReading,
  deleteMeterReading,
  fetchLatestMeterReading,
  updateMeterReading,
} from '../../service/MeterReadingService';

/* ---------------- TYPES ---------------- */

type Props = NativeStackScreenProps<RoomStackParamList, 'RoomForm'>;

/* ---------------- HELPERS ---------------- */

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.length ? parts.map(p => p[0]).join('').toUpperCase() : 'R';
};

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

/* ---------------- SCREEN ---------------- */

export default function RoomFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<Props['route']>();
  const theme = useTheme();
  const scaledTheme = React.useMemo(() => scalePaperThemeFonts(theme, 1.15), [theme]);

  const mode = route.params?.mode ?? 'add';
  const roomId = mode === 'edit' ? route.params?.roomId : undefined;

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  /* ROOM */
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');
  const [area, setArea] = React.useState('');
  const [rent, setRent] = React.useState('');
  const [deposit, setDeposit] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  /* TENANT */
  const [activeTenant, setActiveTenant] = React.useState<TenantRoomRecord | null>(null);
  const [tenantHistory, setTenantHistory] = React.useState<TenantHistoryRecord[]>([]);
  const [allTenants, setAllTenants] = React.useState<TenantRecord[]>([]);
  const [tenantQuery, setTenantQuery] = React.useState('');
  const [selectedTenant, setSelectedTenant] = React.useState<TenantRecord | null>(null);
  const [editingOccupancy, setEditingOccupancy] = React.useState(false);

  /* DATE */
  const [joiningDate, setJoiningDate] = React.useState<Date | null>(null);
  const [dateModalOpen, setDateModalOpen] = React.useState(false);

  /* METER READING */
  const [meterReading, setMeterReading] = React.useState('');
  const [meterReadingId, setMeterReadingId] = React.useState<number | null>(null);
  const [meterReadingPrevUnit, setMeterReadingPrevUnit] = React.useState<number | null>(null);
  const [activeMeterUnit, setActiveMeterUnit] = React.useState<number | null>(null);

  /* ---------------- LOAD ---------------- */

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      if (mode === 'edit' && roomId) {
        const r = await fetchRoomById(roomId);
        if (r) {
          setName(r.name || '');
          setType(r.type || '');
          setArea(r.area || '');
          setRent(r.rent || '');
          setDeposit(r.deposit || '');
          setComment(r.comment || '');
        }
        setMeterReading('');

        const [active, history, tenants] = await Promise.all([
          fetchActiveTenantForRoom(roomId),
          fetchTenantHistoryForRoom(roomId),
          fetchTenants(),
        ]);

        setActiveTenant(active);
        setTenantHistory(history);
        setAllTenants(tenants);
        setEditingOccupancy(false);
        setSelectedTenant(null);
        setJoiningDate(null);
        setTenantQuery('');
        setMeterReadingId(null);
        setMeterReadingPrevUnit(null);
        setActiveMeterUnit(null);

        // Show meter reading in view mode (above joining date)
        if (active) {
          try {
            const latest = await fetchLatestMeterReading({
              roomId,
              tenantId: active.tenant_id,
            });
            setActiveMeterUnit(latest?.unit ?? null);
          } catch {
            setActiveMeterUnit(null);
          }
        }
      } else {
        // Add mode: still need tenants list for search/selection
        setActiveTenant(null);
        setTenantHistory([]);
        setSelectedTenant(null);
        setJoiningDate(null);
        setMeterReading('');
        setEditingOccupancy(false);
        setTenantQuery('');
        setMeterReadingId(null);
        setMeterReadingPrevUnit(null);
        setActiveMeterUnit(null);
        const tenants = await fetchTenants();
        setAllTenants(tenants);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, roomId]);

  useFocusEffect(React.useCallback(() => { load(); }, [load]));

  /* ---------------- VALIDATE ---------------- */

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!type.trim()) e.type = 'Required';
    if (!/^\d+$/.test(rent)) e.rent = 'Numbers only';
    if (!/^\d+$/.test(deposit)) e.deposit = 'Numbers only';

    if (selectedTenant && !joiningDate) {
      e.joiningDate = 'Joining date is required';
    }

    if (selectedTenant) {
      if (!meterReading.trim()) {
        e.meterReading = 'Meter reading is required';
      } else if (!/^\d+$/.test(meterReading.trim())) {
        e.meterReading = 'Numbers only';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ---------------- SAVE ---------------- */

  const save = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      const savedRoom = await saveRoom({
        id: mode === 'edit' ? roomId : undefined,
        name,
        type,
        area,
        rent,
        deposit,
        comment,
      });

      const shouldApplyOccupancy =
        !!selectedTenant &&
        !!joiningDate &&
        (!activeTenant || editingOccupancy);

      if (shouldApplyOccupancy) {
        const meterUnit = Number(meterReading);
        // For edit-occupancy same tenant: update existing meter_reading row (no new row).
        // Otherwise: create a new meter_reading row and roll it back on failure.
        const isEditSameTenant =
          !!activeTenant &&
          editingOccupancy &&
          selectedTenant!.id === activeTenant.tenant_id;

        const createdReadingRow = isEditSameTenant
          ? null
          : await createMeterReading({
              roomId: savedRoom.id,
              tenantId: selectedTenant!.id,
              unit: meterUnit,
            });

        try {
          if (activeTenant && editingOccupancy) {
            // Edit existing occupancy
            if (selectedTenant!.id === activeTenant.tenant_id) {
              if (meterReadingId) {
                await updateMeterReading({ id: meterReadingId, unit: meterUnit });
              } else {
                // If no existing reading found, create one
                await createMeterReading({
                  roomId: savedRoom.id,
                  tenantId: selectedTenant!.id,
                  unit: meterUnit,
                });
              }

              // Same tenant: update joining date on mapping
              await updateJoiningDate(activeTenant.id, joiningDate!.toISOString());
            } else {
              // Different tenant: vacate current and create new mapping
              await vacateRoom(activeTenant.id);
              await addTenantToRoom({
                tenant_id: selectedTenant!.id,
                room_id: savedRoom.id,
                joining_date: joiningDate!.toISOString(),
              });
            }
          } else {
            // No active tenant: create new mapping
            await addTenantToRoom({
              tenant_id: selectedTenant!.id,
              room_id: savedRoom.id,
              joining_date: joiningDate!.toISOString(),
            });
          }
        } catch (err) {
          // rollback meter reading if mapping fails
          if (createdReadingRow?.id) {
            await deleteMeterReading(createdReadingRow.id);
          } else if (isEditSameTenant && meterReadingId && meterReadingPrevUnit != null) {
            // restore previous unit if we updated an existing row
            try {
              await updateMeterReading({ id: meterReadingId, unit: meterReadingPrevUnit });
            } catch {
              // ignore rollback failure
            }
          }
          throw err;
        } finally {
          // reset edit state after occupancy changes
          if (editingOccupancy) {
            setEditingOccupancy(false);
            setSelectedTenant(null);
            setJoiningDate(null);
            setMeterReading('');
            setTenantQuery('');
            setMeterReadingId(null);
            setMeterReadingPrevUnit(null);
            load();
          }
        }
      }

      Alert.alert('Saved', 'Room saved successfully', [
        { text: 'OK', onPress: navigation.goBack },
      ]);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator size="large" /></View>;
  }

  const filteredTenants =
    tenantQuery.length > 0
      ? allTenants.filter(t =>
          t.name?.toLowerCase().includes(tenantQuery.toLowerCase()),
        )
      : [];

  /* ---------------- UI ---------------- */

  return (
    <>
      <PaperProvider theme={scaledTheme}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* ===== ROOM DETAILS (ENHANCED) ===== */}
          <Surface style={styles.roomHero} elevation={2}>
            <View style={styles.roomHeroHeader}>
              <Avatar.Icon
                size={52}
                icon="home-city-outline"
                style={{ backgroundColor: theme.colors.primaryContainer }}
                color={theme.colors.primary}
              />
              <View style={{ marginLeft: 14 }}>
                <Text variant="titleLarge" style={{ fontWeight: '800' }}>
                  Room Details
                </Text>
                <Text style={{ color: '#666' }}>
                  Configuration & pricing
                </Text>
              </View>
            </View>

            <FormInput label="Room Name *" value={name} onChange={setName} error={errors.name} icon="home-outline" />
            <FormInput label="Room Type *" value={type} onChange={setType} error={errors.type} icon="shape-outline" />
            <FormInput label="Area (sq ft)" value={area} onChange={setArea} icon="ruler-square" />

            <View style={styles.moneyRow}>
              <MoneyInput label="Rent (₹)" value={rent} onChange={setRent} error={errors.rent} />
              <MoneyInput label="Deposit (₹)" value={deposit} onChange={setDeposit} error={errors.deposit} />
            </View>
          </Surface>

          {/* ===== TENANT OCCUPANCY ===== */}
          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Tenant Occupancy
            </Text>

            {activeTenant && !editingOccupancy ? (
              <>
                <Surface style={styles.occupancyCard} elevation={1}>
                  <View style={styles.occupancyHeader}>
                    <Avatar.Text
                      size={44}
                      label={getInitials(activeTenant.tenant.name)}
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                      color={theme.colors.primary}
                    />

                    <View style={styles.occupancyHeaderText}>
                      <Text variant="titleMedium" style={styles.occupancyName}>
                        {activeTenant.tenant.name}
                      </Text>
                      <Text style={styles.occupancySub}>Active tenant</Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: theme.colors.secondaryContainer },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: theme.colors.secondary }]}>
                        Occupied
                      </Text>
                    </View>
                  </View>

                  <View style={styles.occupancyMetaRow}>
                    <View style={styles.metaRow}>
                      <IconButton icon="counter" size={18} style={styles.metaIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Joining Meter reading</Text>
                        <Text style={styles.metaValue}>
                          {activeMeterUnit != null ? String(activeMeterUnit) : '-'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.metaRow, { marginTop: 10 }]}>
                      <IconButton icon="calendar" size={18} style={styles.metaIcon} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Joining date</Text>
                        <Text style={styles.metaValue}>{formatDate(activeTenant.joining_date)}</Text>
                      </View>
                    </View>
                  </View>
                </Surface>

                <Button
                  mode="outlined"
                  icon="pencil-outline"
                  style={{ marginTop: 12 }}
                  onPress={async () => {
                    setEditingOccupancy(true);
                    setSelectedTenant(activeTenant.tenant);
                    setJoiningDate(new Date(activeTenant.joining_date));
                    try {
                      const latest = await fetchLatestMeterReading({
                        roomId: roomId as number,
                        tenantId: activeTenant.tenant_id,
                      });
                      setMeterReading(latest?.unit != null ? String(latest.unit) : '');
                      setMeterReadingId(latest?.id ?? null);
                      setMeterReadingPrevUnit(latest?.unit ?? null);
                    } catch {
                      setMeterReading('');
                      setMeterReadingId(null);
                      setMeterReadingPrevUnit(null);
                    }
                    setTenantQuery('');
                    setErrors((prev) => ({
                      ...prev,
                      meterReading: '',
                      joiningDate: '',
                    }));
                  }}
                >
                  Edit Occupancy
                </Button>

                <Button
                  mode="contained-tonal"
                  icon="home-remove-outline"
                  style={{ marginTop: 12 }}
                  onPress={() =>
                    Alert.alert('Mark Vacant', 'Confirm tenant vacated?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Confirm',
                        style: 'destructive',
                        onPress: async () => {
                          await vacateRoom(activeTenant.id);
                          load();
                        },
                      },
                    ])
                  }
                >
                  Mark Vacant
                </Button>
              </>
            ) : (
              <>
                {!selectedTenant && (
                  <>
                    <Surface style={styles.occupancyHint} elevation={0}>
                      <Avatar.Icon
                        size={40}
                        icon="account-plus-outline"
                        style={{ backgroundColor: theme.colors.primaryContainer }}
                        color={theme.colors.primary}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontWeight: '700' }}>No tenant assigned</Text>
                        <Text style={{ color: '#666', marginTop: 2 }}>
                          Search and select a tenant to occupy this room.
                        </Text>
                      </View>
                    </Surface>

                    <TextInput
                      label="Search Tenant"
                      value={tenantQuery}
                      onChangeText={setTenantQuery}
                      mode="outlined"
                      left={<TextInput.Icon icon="magnify" />}
                    />

                    {filteredTenants.length > 0 && (
                      <Surface style={styles.dropdown} elevation={2}>
                        {filteredTenants.map(t => (
                          <TouchableOpacity
                            key={t.id}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setSelectedTenant(t);
                              setTenantQuery('');
                            }}
                          >
                            <Text>{t.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </Surface>
                    )}
                  </>
                )}

                {selectedTenant && (
                  <Surface style={styles.selectedTenant} elevation={1}>
                    <Avatar.Text
                      size={40}
                      label={getInitials(selectedTenant.name)}
                      style={{ backgroundColor: theme.colors.primaryContainer }}
                      color={theme.colors.primary}
                    />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: '800' }}>{selectedTenant.name}</Text>
                      <Text style={{ color: '#666', marginTop: 2 }}>
                        Selected tenant
                      </Text>
                    </View>

                    <IconButton
                      icon="close"
                      onPress={() => setSelectedTenant(null)}
                      accessibilityLabel="Remove selected tenant"
                    />
                  </Surface>
                )}

                {selectedTenant && (
                  <>
                    <TextInput
                      label="Joining Meter Reading *"
                      value={meterReading}
                      onChangeText={(text) => {
                        const next = text.replace(/[^\d]/g, '');
                        setMeterReading(next);
                        setErrors((prev) => ({ ...prev, meterReading: '' }));
                      }}
                      mode="outlined"
                      keyboardType="number-pad"
                      left={<TextInput.Icon icon="counter" />}
                      error={!!errors.meterReading}
                      style={{ marginTop: 12 }}
                    />
                    {!!errors.meterReading && (
                      <HelperText type="error" visible>
                        {errors.meterReading}
                      </HelperText>
                    )}
                  </>
                )}

                <Button
                  mode="contained-tonal"
                  icon="calendar"
                  style={{ marginTop: 12 }}
                  onPress={() => setDateModalOpen(true)}
                >
                  {joiningDate
                    ? `Joining Date: ${formatDate(joiningDate.toISOString())}`
                    : 'Select Joining Date'}
                </Button>

                {!!errors.joiningDate && (
                  <HelperText type="error" visible>
                    {errors.joiningDate}
                  </HelperText>
                )}

                {editingOccupancy && activeTenant && (
                  <Button
                    mode="outlined"
                    icon="close"
                    onPress={() => {
                      setEditingOccupancy(false);
                      setSelectedTenant(null);
                      setJoiningDate(null);
                      setMeterReading('');
                      setTenantQuery('');
                      setMeterReadingId(null);
                      setMeterReadingPrevUnit(null);
                      setErrors((prev) => ({
                        ...prev,
                        meterReading: '',
                        joiningDate: '',
                      }));
                    }}
                    textColor="#D32F2F"
                    style={{
                      marginTop: 12,
                      borderColor: '#F3B5B5',
                      backgroundColor: '#FFF5F5',
                    }}
                  >
                    Cancel occupancy edit
                  </Button>
                )}
              </>
            )}
          </Surface>

          {/* ===== TENANT HISTORY ===== */}
          {tenantHistory.length > 0 && (
            <Surface style={styles.section} elevation={2}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Tenant History
              </Text>

              {tenantHistory.map((h, i) => (
                <Surface key={i} style={styles.historyCard} elevation={1}>
                  <Avatar.Icon size={36} icon="account" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontWeight: '600' }}>{h.tenant_name}</Text>
                    <Text style={{ color: '#666' }}>
                      {formatDate(h.joining_date)} → {formatDate(h.leaving_date)}
                    </Text>
                  </View>
                </Surface>
              ))}
            </Surface>
          )}

          </ScrollView>
        </KeyboardAvoidingView>

        <FAB icon="content-save" style={styles.fab} loading={saving} onPress={save} />

        <DatePickerModal
          locale="en"
          mode="single"
          visible={dateModalOpen}
          date={joiningDate ?? new Date()}
          onDismiss={() => setDateModalOpen(false)}
          onConfirm={({ date }) => {
            setDateModalOpen(false);
            setJoiningDate(date ?? null);
          }}
        />
      </PaperProvider>
    </>
  );
}

/* ---------------- COMPONENTS ---------------- */

const FormInput = ({ label, value, onChange, error, icon }: any) => (
  <>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChange}
      mode="outlined"
      left={<TextInput.Icon icon={icon} />}
      error={!!error}
    />
    <HelperText type="error" visible={!!error}>{error || ' '}</HelperText>
  </>
);

const MoneyInput = ({ label, value, onChange, error }: any) => (
  <View style={{ flex: 1 }}>
    <TextInput
      label={label}
      value={value}
      onChangeText={onChange}
      mode="outlined"
      keyboardType="number-pad"
      left={<TextInput.Icon icon="currency-inr" />}
      error={!!error}
    />
    <HelperText type="error" visible={!!error}>{error || ' '}</HelperText>
  </View>
);

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120, backgroundColor: '#F4F6FA' },
  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  roomHero: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  roomHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  moneyRow: {
    flexDirection: 'row',
    gap: 12,
  },

  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },

  occupancyCard: {
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  occupancyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  occupancyHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  occupancyName: {
    fontWeight: '800',
  },
  occupancySub: {
    color: '#666',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
  occupancyMetaRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E6E6E6',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaIcon: {
    margin: 0,
    marginRight: 6,
  },
  metaLabel: {
    fontSize: 14,
    color: '#888',
  },
  metaValue: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 2,
  },
  occupancyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F8FF',
    marginBottom: 12,
  },

  dropdown: {
    marginTop: 6,
    borderRadius: 8,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  selectedTenant: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
  },
});
