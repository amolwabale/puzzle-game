import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  Dimensions,
  Keyboard,
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
  Portal,
  TouchableRipple,
  Surface,
  Text,
  Button,
  IconButton,
  Icon,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePickerModal } from 'react-native-paper-dates';

import { RoomStackParamList } from '../../navigation/StackParam';
import { FormInput } from '../../components/FormInput';
import { fetchRoomById, fetchRooms, saveRoom } from '../../service/RoomService';
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
import { trackEvent } from '../../service/analyticsTracker';

/* ---------------- TYPES ---------------- */

type Props = NativeStackScreenProps<RoomStackParamList, 'RoomForm'>;

/* ---------------- HELPERS ---------------- */

const TENANT_DROPDOWN_MAX_H = 320;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

const renderHighlightedText = (label: string, query: string) => {
  if (!query) return <Text style={styles.dropdownItemTitle}>{label}</Text>;
  const low = label.toLowerCase();
  const q = query.toLowerCase();
  const idx = low.indexOf(q);
  if (idx < 0) return <Text style={styles.dropdownItemTitle}>{label}</Text>;

  const before = label.slice(0, idx);
  const match = label.slice(idx, idx + query.length);
  const after = label.slice(idx + query.length);
  return (
    <Text style={styles.dropdownItemTitle} numberOfLines={1}>
      {before}
      <Text style={styles.dropdownItemMatch}>{match}</Text>
      {after}
    </Text>
  );
};

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).slice(0, 2);
  return parts.length
    ? parts
        .map(p => p[0])
        .join('')
        .toUpperCase()
    : 'R';
};

/* ---------------- SCREEN ---------------- */

export default function RoomFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<Props['route']>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const winH = Dimensions.get('window').height;

  const mode = route.params?.mode ?? 'add';
  const roomId = mode === 'edit' ? route.params?.roomId : undefined;

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const getKeyboardHeight = (e: any) => {
      const h = Number(e?.endCoordinates?.height ?? 0);
      if (Number.isFinite(h) && h > 0) return h;

      const screenY = Number(e?.endCoordinates?.screenY ?? NaN);
      if (Number.isFinite(screenY) && screenY > 0) {
        const winH = Dimensions.get('window').height;
        return Math.max(0, winH - screenY);
      }

      return 0;
    };

    const subShow = Keyboard.addListener(showEvent as any, e => {
      setKeyboardHeight(getKeyboardHeight(e));
    });
    const subHide = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardHeight(0);
    });
    const subFrame =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardDidChangeFrame' as any, e => {
            setKeyboardHeight(getKeyboardHeight(e));
          })
        : null;

    return () => {
      subShow.remove();
      subHide.remove();
      subFrame?.remove();
    };
  }, []);

  React.useEffect(() => {
    if (saving) setDateModalOpen(false);
  }, [saving]);

  /* ROOM */
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState('');
  const [area, setArea] = React.useState('');
  const [rent, setRent] = React.useState('');
  const [deposit, setDeposit] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  /* TENANT */
  const [activeTenant, setActiveTenant] =
    React.useState<TenantRoomRecord | null>(null);
  const [tenantHistory, setTenantHistory] = React.useState<
    TenantHistoryRecord[]
  >([]);
  const [allTenants, setAllTenants] = React.useState<TenantRecord[]>([]);
  const [tenantQuery, setTenantQuery] = React.useState('');
  const [selectedTenant, setSelectedTenant] =
    React.useState<TenantRecord | null>(null);
  const [editingOccupancy, setEditingOccupancy] = React.useState(false);
  const tenantSearchAnchorRef =
    React.useRef<React.ElementRef<typeof View> | null>(null);
  const [tenantSearchAnchorRect, setTenantSearchAnchorRect] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  /* DATE */
  const [joiningDate, setJoiningDate] = React.useState<Date | null>(null);
  const [dateModalOpen, setDateModalOpen] = React.useState(false);

  /* METER READING */
  const [meterReading, setMeterReading] = React.useState('');
  const [meterReadingId, setMeterReadingId] = React.useState<number | null>(
    null,
  );
  const [meterReadingPrevUnit, setMeterReadingPrevUnit] = React.useState<
    number | null
  >(null);
  const [activeMeterUnit, setActiveMeterUnit] = React.useState<number | null>(
    null,
  );

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

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  /* ---------------- VALIDATE ---------------- */

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    else if (name.trim().length > 70) e.name = 'Max 70 characters';
    if (!type.trim()) e.type = 'Required';
    else if (type.trim().length > 30) e.type = 'Max 30 characters';
    if (String(area || '').trim().length > 10) e.area = 'Max 10 digits';
    if (!rent.trim()) e.rent = 'Required';
    else if (!/^\d+$/.test(rent.trim())) e.rent = 'Numbers only';
    else if (rent.trim().length > 10) e.rent = 'Max 10 digits';
    if (!/^\d+$/.test(deposit)) e.deposit = 'Numbers only';
    else if (deposit.trim().length > 10) e.deposit = 'Max 10 digits';
    if (String(comment || '').trim().length > 100)
      e.comment = 'Max 100 characters';

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

      // Room name uniqueness (case-insensitive, trimmed)
      const normalized = name.trim().toLowerCase();
      const existing = await fetchRooms();
      const duplicate = (existing || []).find((r: any) => {
        const rn = String(r?.name || '')
          .trim()
          .toLowerCase();
        if (!rn) return false;
        if (mode === 'edit' && roomId != null && r?.id === roomId) return false;
        return rn === normalized;
      });
      if (duplicate) {
        setErrors(prev => ({
          ...prev,
          name: 'Room with same name already exists',
        }));
        return;
      }

      const savedRoom = await saveRoom({
        id: mode === 'edit' ? roomId : undefined,
        name,
        type,
        area,
        rent,
        deposit,
        comment,
      });

      var event = 'Room_Added';
      if (mode === 'edit') {
        event = 'Room_Updated';
      }

      trackEvent(event, {
        source: 'Room',
        room_id: savedRoom.id,
        name: name,
        type: type,
        area: area,
        rent: rent,
        deposit: deposit,
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
                await updateMeterReading({
                  id: meterReadingId,
                  unit: meterUnit,
                });
              } else {
                // If no existing reading found, create one
                await createMeterReading({
                  roomId: savedRoom.id,
                  tenantId: selectedTenant!.id,
                  unit: meterUnit,
                });
              }

              // Same tenant: update joining date on mapping
              await updateJoiningDate(
                activeTenant.id,
                joiningDate!.toISOString(),
              );
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
          } else if (
            isEditSameTenant &&
            meterReadingId &&
            meterReadingPrevUnit != null
          ) {
            // restore previous unit if we updated an existing row
            try {
              await updateMeterReading({
                id: meterReadingId,
                unit: meterReadingPrevUnit,
              });
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

  const filteredTenants = React.useMemo(() => {
    if (tenantQuery.length === 0) return [];
    const q = tenantQuery.toLowerCase();
    return allTenants.filter(t => t.name?.toLowerCase().includes(q));
  }, [tenantQuery, allTenants]);

  const scrollPadBottom =
    20 + Math.max(0, keyboardHeight);

  const clamp = React.useCallback(
    (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
    [],
  );

  const measureTenantAnchor = React.useCallback(() => {
    const node = tenantSearchAnchorRef.current as any;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x: number, y: number, width: number, height: number) =>
      setTenantSearchAnchorRect({ x, y, width, height }),
    );
  }, []);

  React.useEffect(() => {
    if (filteredTenants.length === 0 || selectedTenant) return;
    const id = requestAnimationFrame(measureTenantAnchor);
    return () => cancelAnimationFrame(id);
  }, [
    filteredTenants.length,
    selectedTenant,
    keyboardHeight,
    tenantQuery,
    measureTenantAnchor,
  ]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.screenRoot}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android needs explicit behavior; 'height' is most reliable with ScrollView forms.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: scrollPadBottom }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View pointerEvents={saving ? 'none' : 'auto'}>
          {/* ===== ROOM DETAILS ===== */}
          <Surface style={styles.roomHero} elevation={2}>
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="home-city-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.sectionTitle} numberOfLines={1}>
                  Room details
                </Text>
                <Text style={styles.sectionSub} numberOfLines={1}>
                  Configuration & pricing
                </Text>
              </View>
            </View>

            <FormInput
              label="Room Name *"
              value={name}
              onChange={setName}
              error={errors.name}
              maxLength={50}
            />
            <FormInput
              label="Room Type *"
              value={type}
              onChange={setType}
              error={errors.type}
              maxLength={30}
            />
            <FormInput
              label="Area (sq ft)"
              value={area}
              onChange={v =>
                setArea(
                  String(v ?? '')
                    .replace(/[^\d]/g, '')
                    .slice(0, 10),
                )
              }
              keyboard="number-pad"
              error={errors.area}
              maxLength={10}
            />

            <View style={styles.moneyRow}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Rent (₹) *"
                  value={rent}
                  onChange={v =>
                    setRent(
                      String(v ?? '')
                        .replace(/[^\d]/g, '')
                        .slice(0, 10),
                    )
                  }
                  error={errors.rent}
                  keyboard="number-pad"
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Deposit (₹)"
                  value={deposit}
                  onChange={v =>
                    setDeposit(
                      String(v ?? '')
                        .replace(/[^\d]/g, '')
                        .slice(0, 10),
                    )
                  }
                  error={errors.deposit}
                  keyboard="number-pad"
                  maxLength={10}
                />
              </View>
            </View>

            <FormInput
              label="Comment"
              value={comment}
              onChange={setComment}
              error={errors.comment}
              maxLength={100}
              multiline={true}
            />
          </Surface>

          {/* ===== TENANT OCCUPANCY ===== */}
          <Surface style={styles.section} elevation={2}>
            <View style={styles.sectionTitleRow}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="account-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <Text style={styles.sectionTitle}>Tenant occupancy</Text>
            </View>

            {activeTenant && !editingOccupancy ? (
              <>
                <Surface style={styles.occupancyCard} elevation={1}>
                  <View style={styles.occupancyHeader}>
                    <Avatar.Text
                      size={44}
                      label={getInitials(activeTenant.tenant.name)}
                      style={{
                        backgroundColor: theme.colors.primaryContainer,
                      }}
                      color={theme.colors.primary}
                    />

                    <View style={styles.occupancyHeaderText}>
                      <Text variant="titleMedium" style={styles.occupancyName}>
                        {activeTenant.tenant.name}
                      </Text>
                      <Text style={styles.muted}>Active tenant</Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: theme.colors.secondaryContainer },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: theme.colors.secondary },
                        ]}
                      >
                        Occupied
                      </Text>
                    </View>
                  </View>

                  <View style={styles.occupancyMetaRow}>
                    <View style={styles.metaRow}>
                      <IconButton
                        icon="counter"
                        size={18}
                        style={styles.metaIcon}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>
                          Joining meter reading
                        </Text>
                        <Text style={styles.metaValue}>
                          {activeMeterUnit != null
                            ? String(activeMeterUnit)
                            : '-'}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.metaRow, { marginTop: 10 }]}>
                      <IconButton
                        icon="calendar"
                        size={18}
                        style={styles.metaIcon}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.metaLabel}>Joining date</Text>
                        <Text style={styles.metaValue}>
                          {formatDate(activeTenant.joining_date)}
                        </Text>
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
                      setMeterReading(
                        latest?.unit != null ? String(latest.unit) : '',
                      );
                      setMeterReadingId(latest?.id ?? null);
                      setMeterReadingPrevUnit(latest?.unit ?? null);
                    } catch {
                      setMeterReading('');
                      setMeterReadingId(null);
                      setMeterReadingPrevUnit(null);
                    }
                    setTenantQuery('');
                    setErrors(prev => ({
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
                    <Surface
                      style={[
                        styles.occupancyHint,
                        {
                          borderColor:
                            (theme.colors as any).outlineVariant ??
                            theme.colors.outline,
                        },
                      ]}
                      elevation={0}
                    >
                      <Avatar.Icon
                        size={40}
                        icon="account-plus-outline"
                        style={{
                          backgroundColor: theme.colors.primaryContainer,
                        }}
                        color={theme.colors.primary}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.hintTitle}>No tenant assigned</Text>
                        <Text style={styles.hintSub}>
                          Search and select a tenant to occupy this room.
                        </Text>
                      </View>
                    </Surface>

                    <View
                      ref={tenantSearchAnchorRef}
                      collapsable={false}
                      onLayout={measureTenantAnchor}
                    >
                      <FormInput
                        label="Search tenant"
                        value={tenantQuery}
                        onChange={v => {
                          setTenantQuery(v);
                        }}
                      />
                    </View>
                  </>
                )}

                {selectedTenant && (
                  <Surface style={styles.selectedTenant} elevation={1}>
                    <Avatar.Text
                      size={40}
                      label={getInitials(selectedTenant.name)}
                      style={{
                        backgroundColor: theme.colors.primaryContainer,
                      }}
                      color={theme.colors.primary}
                    />

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: '800' }}>
                        {selectedTenant.name}
                      </Text>
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
                    <FormInput
                      label="Joining Meter Reading *"
                      value={meterReading}
                      onChange={(text: string) => {
                        const next = text.replace(/[^\d]/g, '');
                        setMeterReading(next);
                        setErrors(prev => ({ ...prev, meterReading: '' }));
                      }}
                      error={errors.meterReading}
                      keyboard="number-pad"
                    />
                  </>
                )}

                <Button
                  mode="contained-tonal"
                  icon="calendar"
                  style={{ marginTop: 12 }}
                  onPress={() => {
                    Keyboard.dismiss();
                    setTimeout(() => setDateModalOpen(true), 0);
                  }}
                >
                  {joiningDate
                    ? `Joining Date: ${formatDate(joiningDate.toISOString())}`
                    : 'Select Joining Date'}
                </Button>

                {!!errors.joiningDate ? (
                  <Text
                    style={[styles.errorText, { color: theme.colors.error }]}
                  >
                    {errors.joiningDate}
                  </Text>
                ) : null}

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
                      setErrors(prev => ({
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
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="history"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.sectionTitle}>Tenant history</Text>
              </View>

              {tenantHistory.map((h, i) => (
                <Surface key={i} style={styles.historyCard} elevation={1}>
                  <Avatar.Icon size={36} icon="account" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={{ fontWeight: '600' }}>{h.tenant_name}</Text>
                    <Text style={{ color: '#666' }}>
                      {formatDate(h.joining_date)} →{' '}
                      {formatDate(h.leaving_date)}
                    </Text>
                  </View>
                </Surface>
              ))}
            </Surface>
          )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {!selectedTenant &&
      filteredTenants.length > 0 &&
      tenantSearchAnchorRect != null ? (
        <Portal>
          <Surface
            style={[
              styles.dropdownPortal,
              {
                left: tenantSearchAnchorRect.x,
                width: tenantSearchAnchorRect.width,
                bottom: clamp(
                  winH - tenantSearchAnchorRect.y + 8,
                  insets.bottom + 8,
                  Math.max(
                    insets.bottom + 8,
                    winH - (insets.top + 8) - TENANT_DROPDOWN_MAX_H,
                  ),
                ),
              },
            ]}
            elevation={3}
          >
            <View style={styles.dropdownHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.dropdownHeaderTitle} numberOfLines={1}>
                  Select tenant
                </Text>
                <Text style={styles.dropdownHeaderSub} numberOfLines={1}>
                  {filteredTenants.length} suggestion
                  {filteredTenants.length === 1 ? '' : 's'}
                </Text>
              </View>
              <IconButton
                icon="close"
                size={18}
                style={{ margin: 0 }}
                onPress={() => setTenantQuery('')}
                accessibilityLabel="Close tenant suggestions"
              />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: TENANT_DROPDOWN_MAX_H }}
            >
              {filteredTenants.map((t, idx) => {
                const isLast = idx === filteredTenants.length - 1;
                return (
                  <TouchableRipple
                    key={t.id}
                    borderless={false}
                    rippleColor="rgba(17, 24, 39, 0.08)"
                    style={[
                      styles.dropdownItem,
                      isLast ? styles.dropdownItemLast : null,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedTenant(t);
                      setTenantQuery('');
                    }}
                  >
                    <View style={styles.dropdownItemRow}>
                      <Avatar.Text
                        size={36}
                        label={getInitials(t.name)}
                        style={styles.dropdownAvatar}
                        color={theme.colors.primary}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        {renderHighlightedText(t.name ?? '-', tenantQuery)}
                        <Text style={styles.dropdownItemHint} numberOfLines={1}>
                          Tap to assign this tenant
                        </Text>
                      </View>
                      <Icon source="chevron-right" size={20} color="#9CA3AF" />
                    </View>
                  </TouchableRipple>
                );
              })}
            </ScrollView>
          </Surface>
        </Portal>
      ) : null}

      <FAB
        icon="content-save"
        style={[
          styles.fab,
          { bottom: keyboardHeight > 0 ? keyboardHeight + 75 : 24 },
        ]}
        loading={saving}
        onPress={save}
        disabled={saving}
      />

      <DatePickerModal
        locale="en"
        mode="single"
        visible={dateModalOpen && !saving}
        date={joiningDate ?? new Date()}
        onDismiss={() => setDateModalOpen(false)}
        onConfirm={({ date }) => {
          setDateModalOpen(false);
          setJoiningDate(date ?? null);
        }}
      />
      {saving ? <View pointerEvents="none" style={styles.screenScrim} /> : null}
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    position: 'relative',
  },
  container: { padding: 16, paddingBottom: 120, backgroundColor: '#F4F6FA' },
  section: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fab: { position: 'absolute', right: 16 },
  screenScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
  },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  roomHero: {
    borderRadius: 18,
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
  moneyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  errorText: { marginTop: 6, fontSize: 12, fontWeight: '800' },

  occupancyCard: {
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    fontWeight: '900',
    color: '#111827',
  },
  muted: { color: '#6B7280', marginTop: 2, fontWeight: '800', fontSize: 12 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusPillText: {
    fontWeight: '800',
    fontSize: 12,
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
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '800',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    color: '#111827',
  },
  occupancyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    marginBottom: 12,
  },
  hintTitle: { fontWeight: '900', fontSize: 14, color: '#111827' },
  hintSub: { color: '#6B7280', marginTop: 2, fontSize: 13, fontWeight: '800' },

  dropdownPortal: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    maxHeight: TENANT_DROPDOWN_MAX_H,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  dropdownHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dropdownHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111827',
  },
  dropdownHeaderSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  dropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownAvatar: { backgroundColor: '#EEF2FF' },
  dropdownItemTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
  },
  dropdownItemMatch: {
    color: '#111827',
    backgroundColor: '#FEF3C7',
    fontWeight: '900',
  },
  dropdownItemHint: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  selectedTenant: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
