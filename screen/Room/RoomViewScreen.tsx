import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  FAB,
  Icon,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { RoomStackParamList } from '../../navigation/StackParam';
import { fetchRoomById, RoomRecord } from '../../service/RoomService';
import {
  fetchActiveTenantForRoom,
  fetchTenantHistoryForRoom,
  TenantHistoryRecord,
  TenantRoomRecord,
} from '../../service/TenantRoomService';
import { fetchLatestMeterReading } from '../../service/MeterReadingService';

type Props = NativeStackScreenProps<RoomStackParamList, 'RoomView'>;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

const getInitials = (name?: string | null) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'T';
  return parts.map(p => p[0]?.toUpperCase()).join('');
};

const formatIntIN = (v: any) => {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  if (!s) return '-';
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  // Indian grouping: 12,34,567
  const restWithCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${restWithCommas},${last3}`;
};

export default function RoomViewScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<Props['navigation']>();
  const { roomId } = route.params;
  const theme = useTheme();

  const [room, setRoom] = React.useState<RoomRecord | null>(null);
  const [activeTenant, setActiveTenant] =
    React.useState<TenantRoomRecord | null>(null);
  const [activeMeterUnit, setActiveMeterUnit] = React.useState<number | null>(
    null,
  );
  const [tenantHistory, setTenantHistory] = React.useState<
    TenantHistoryRecord[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchRoomById(roomId);
      if (!data) {
        Alert.alert('Not found', 'Room not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setRoom(data);

      const [active, history] = await Promise.all([
        fetchActiveTenantForRoom(roomId),
        fetchTenantHistoryForRoom(roomId),
      ]);
      setActiveTenant(active);
      setTenantHistory(history || []);

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
      } else {
        setActiveMeterUnit(null);
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !room) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* HERO (Support-style) */}
        <Surface style={styles.hero} elevation={2}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="home-city-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroTitle} numberOfLines={1}>
                {room.name || 'Room'}
              </Text>
              <Text style={styles.heroSub} numberOfLines={1}>
                {room.type || '—'}
              </Text>
            </View>
          </View>

          {/* KPI rows (flat, no mini-tile boxes; prevents truncation) */}
          <View
            style={[
              styles.kpiList,
              { borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
            ]}
          >
            <KpiRow
              icon="ruler-square"
              label="Area (sq ft)"
              value={formatIntIN(room.area)}
            />
            <View
              style={[
                styles.kpiDivider,
                { backgroundColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
              ]}
            />
            <KpiRow icon="currency-inr" label="Rent" value={`₹${formatIntIN(room.rent)}`} />
            <View
              style={[
                styles.kpiDivider,
                { backgroundColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
              ]}
            />
            <KpiRow icon="bank" label="Deposit" value={`₹${formatIntIN(room.deposit)}`} />
          </View>
        </Surface>

        <Section title="Additional details" icon="comment-text-outline">
          <InfoRow icon="comment-text-outline" label="Comment" value={room.comment} />
        </Section>

        <Section title="Tenant occupancy" icon="account-outline">
          {activeTenant ? (
            <Surface style={[styles.subCard, { borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline }]} elevation={0}>
              <View style={styles.occHeader}>
                <Avatar.Text
                  size={44}
                  label={getInitials(activeTenant.tenant?.name)}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                  color={theme.colors.primary}
                />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                  <Text style={styles.occName} numberOfLines={1}>
                    {activeTenant.tenant?.name || '-'}
                  </Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    Active tenant
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: theme.colors.secondaryContainer, borderColor: theme.colors.secondary }]}>
                  <Text style={[styles.statusPillText, { color: theme.colors.secondary }]}>Occupied</Text>
                </View>
              </View>

              <View style={styles.occMetaRow}>
                <View style={styles.metaRow}>
                  <IconButton icon="counter" size={18} style={styles.metaIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metaLabel}>Meter reading</Text>
                    <Text style={styles.metaValue}>
                      {activeMeterUnit != null ? String(activeMeterUnit) : '-'}
                    </Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <IconButton icon="calendar" size={18} style={styles.metaIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.metaLabel}>Joining date</Text>
                    <Text style={styles.metaValue}>{formatDate(activeTenant.joining_date)}</Text>
                  </View>
                </View>
              </View>
            </Surface>
          ) : (
            <Surface
              style={[
                styles.emptyInline,
                { backgroundColor: theme.colors.surface, borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
              ]}
              elevation={0}
            >
              <Avatar.Icon size={40} icon="account-off-outline" style={{ backgroundColor: 'transparent' }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.emptyInlineTitle}>Not assigned</Text>
                <Text style={styles.emptyInlineSub}>No tenant is currently occupying this room.</Text>
              </View>
            </Surface>
          )}
        </Section>

        <Section title="Tenant history" icon="history">
          {tenantHistory.length > 0 ? (
            tenantHistory.map((h, i) => (
              <Surface
                key={`${h.tenant_name ?? 'tenant'}-${h.joining_date ?? ''}-${h.leaving_date ?? ''}-${i}`}
                style={[
                  styles.historyRow,
                  { borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline, backgroundColor: theme.colors.surface },
                ]}
                elevation={0}
              >
                <Avatar.Text
                  size={40}
                  label={getInitials(h.tenant_name)}
                  style={{ backgroundColor: theme.colors.primaryContainer }}
                  color={theme.colors.primary}
                />
                <View style={{ marginLeft: 12, flex: 1, minWidth: 0 }}>
                  <Text style={styles.historyName} numberOfLines={1}>
                    {h.tenant_name || '-'}
                  </Text>
                  <Text style={styles.historyDates} numberOfLines={1}>
                    {formatDate(h.joining_date)} → {formatDate(h.leaving_date)}
                  </Text>
                </View>
              </Surface>
            ))
          ) : (
            <Text style={styles.emptyInlineSub}>No history yet</Text>
          )}
        </Section>
      </ScrollView>

      <FAB
        icon="pencil"
        style={styles.fab}
        onPress={() =>
          navigation.navigate('RoomForm', { mode: 'edit', roomId })
        }
      />
    </>
  );
}

/* ---------------- COMPONENTS ---------------- */

const KpiRow = ({ icon, label, value }: any) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const badgeBg = (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  return (
    <View style={styles.kpiRow}>
      <View style={[styles.kpiIconBadge, { borderColor: outline, backgroundColor: badgeBg }]}>
        <Icon source={icon} size={16} color="#6B7280" />
      </View>
      <Text style={styles.kpiLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
        {value}
      </Text>
    </View>
  );
};

const InfoRow = ({ icon, label, value }: any) => (
  <View style={styles.infoRow}>
    <IconButton icon={icon} size={18} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  </View>
);

const Section = ({ title, icon, children }: any) => {
  const theme = useTheme();
  return (
    <Surface style={styles.section} elevation={2}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon source={icon} size={18} color={theme.colors.primary} />
        </View>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </Surface>
  );
};

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },

  hero: {
    borderRadius: 18,
    padding: 14,
    // Keep vertical rhythm consistent: sections already use marginTop.
    // If hero also has marginBottom, the first gap becomes double.
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  heroSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 13 },

  kpiList: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kpiDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  kpiIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  kpiLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '900',
    color: '#6B7280',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    marginLeft: 10,
  },

  section: {
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  sectionIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
    color: '#111827',
  },

  muted: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '800',
  },

  subCard: { borderRadius: 16, borderWidth: 1, padding: 12 },
  occHeader: { flexDirection: 'row', alignItems: 'center' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  occName: { fontWeight: '900', fontSize: 14, color: '#111827' },
  occMetaRow: { marginTop: 12, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaIcon: {
    margin: 0,
    marginRight: 6,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
    color: '#111827',
  },
  emptyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  emptyInlineTitle: { fontWeight: '900', fontSize: 14, color: '#111827' },
  emptyInlineSub: { color: '#6B7280', marginTop: 2, fontSize: 13, fontWeight: '800' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  historyName: { fontWeight: '900', fontSize: 14, color: '#111827' },
  historyDates: { color: '#6B7280', marginTop: 2, fontSize: 12, fontWeight: '800' },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
