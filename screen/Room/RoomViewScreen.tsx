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
  IconButton,
  Surface,
  Text,
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

export default function RoomViewScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<Props['navigation']>();
  const { roomId } = route.params;

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO */}
        <Surface style={styles.hero} elevation={3}>
          <Avatar.Icon size={64} icon="home-city-outline" />
          <View style={styles.heroText}>
            <Text variant="titleLarge" style={styles.roomName}>
              {room.name || 'Room'}
            </Text>
            <Text style={styles.roomType}>{room.type}</Text>
          </View>
        </Surface>

        {/* HIGHLIGHTS */}
        <View style={styles.highlightRow}>
          <HighlightCard
            icon="ruler-square"
            label="Area (sq ft)"
            value={`${room.area ?? '-'}`}
          />
          <HighlightCard
            icon="currency-inr"
            label="Rent (₹)"
            value={`₹${room.rent ?? '-'}`}
          />
          <HighlightCard
            icon="bank"
            label="Deposit (₹)"
            value={`₹${room.deposit ?? '-'}`}
          />
        </View>

        {/* DETAILS */}
        <Surface style={styles.section} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Additional Details
          </Text>
          <InfoRow
            icon="comment-text-outline"
            label="Comment"
            value={room.comment}
          />
        </Surface>

        {/* TENANT OCCUPANCY (VIEW ONLY) */}
        <Surface style={styles.section} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Tenant Occupancy
          </Text>

          {activeTenant ? (
            <Surface style={styles.occupancyCard} elevation={1}>
              <View style={styles.occupancyHeader}>
                <Avatar.Text
                  size={44}
                  label={getInitials(activeTenant.tenant?.name)}
                />

                <View style={styles.occupancyHeaderText}>
                  <Text variant="titleMedium" style={styles.occupancyName}>
                    {activeTenant.tenant?.name || '-'}
                  </Text>
                  <Text style={styles.occupancySub}>Active tenant</Text>
                </View>

                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>Occupied</Text>
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
                    <Text style={styles.metaLabel}>Joining Meter reading</Text>
                    <Text style={styles.metaValue}>
                      {activeMeterUnit != null ? String(activeMeterUnit) : '-'}
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
          ) : (
            <Surface style={styles.occupancyHint} elevation={0}>
              <Avatar.Icon size={40} icon="account-off-outline" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.occupancyHintTitle}>Not assigned</Text>
                <Text style={styles.occupancyHintSub}>
                  No tenant is currently occupying this room.
                </Text>
              </View>
            </Surface>
          )}
        </Surface>

        {/* TENANT HISTORY (VIEW ONLY) */}
        <Surface style={styles.section} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Tenant History
          </Text>

          {tenantHistory.length > 0 ? (
            tenantHistory.map((h, i) => (
              <Surface key={i} style={styles.historyCard} elevation={1}>
                <Avatar.Icon size={36} icon="account" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.historyName}>{h.tenant_name}</Text>
                  <Text style={styles.historyDates}>
                    {formatDate(h.joining_date)} → {formatDate(h.leaving_date)}
                  </Text>
                </View>
              </Surface>
            ))
          ) : (
            <Text style={styles.muted}>No history yet</Text>
          )}
        </Surface>
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

const HighlightCard = ({ icon, label, value }: any) => (
  <Surface style={styles.highlightCard} elevation={2}>
    <IconButton icon={icon} size={22} />
    <Text style={styles.highlightLabel}>{label}</Text>
    <Text style={styles.highlightValue}>{value}</Text>
  </Surface>
);

const InfoRow = ({ icon, label, value }: any) => (
  <View style={styles.infoRow}>
    <IconButton icon={icon} size={18} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  </View>
);

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#F4F6FA',
  },

  scrollContent: {
    flexGrow: 1, // ✅ KEY FIX
    padding: 16,
    paddingBottom: 120,
  },

  hero: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroText: {
    marginLeft: 16,
  },
  roomName: {
    fontWeight: '700',
    fontSize: 25, // +~15%
  },
  roomType: {
    color: '#666',
    marginTop: 4,
    fontSize: 16, // +~15%
  },

  highlightRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  highlightCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  highlightLabel: {
    fontSize: 14, // +~15%
    color: '#777',
    marginTop: 4,
  },
  highlightValue: {
    fontWeight: '700',
    marginTop: 4,
    fontSize: 17, // +~15%
  },

  section: {
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 18, // +~15%
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14, // +~15%
    color: '#888',
  },
  infoValue: {
    fontSize: 17, // +~15%
    fontWeight: '500',
    marginTop: 2,
  },

  muted: {
    color: '#999',
    fontSize: 14, // +~15%
    marginTop: 4,
  },

  /* --- Tenant occupancy styles (copied from RoomForm for consistency) --- */
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
    fontSize: 18, // +~15%
  },
  occupancySub: {
    color: '#666',
    marginTop: 2,
    fontSize: 14, // +~15%
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  statusPillText: {
    fontSize: 14, // +~15%
    fontWeight: '800',
    color: '#1A73E8',
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
    fontSize: 14, // +~15%
    color: '#888',
  },
  metaValue: {
    fontSize: 17, // +~15%
    fontWeight: '700',
    marginTop: 2,
  },
  occupancyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F8FF',
    marginTop: 8,
  },
  occupancyHintTitle: { fontWeight: '700', fontSize: 18 },
  occupancyHintSub: { color: '#666', marginTop: 2, fontSize: 14 },

  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 8,
    borderRadius: 14,
  },
  historyName: { fontWeight: '600', fontSize: 16 },
  historyDates: { color: '#666', marginTop: 2, fontSize: 14 },

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
