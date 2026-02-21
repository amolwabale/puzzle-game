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
  FAB,
  Searchbar,
  Text,
} from 'react-native-paper';
import { listTickets } from '../../service/ticketService';
import type { Ticket } from '../../service/ticketTypes';
import { TicketCard } from '../Support/components/TicketCard';
import { trackEvent } from '../../service/analyticsTracker';

export default function SupportScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const rows = await listTickets();
      setTickets(rows || []);
    } catch (e: any) {
      Alert.alert('Load Failed', e?.message || 'Could not load tickets');
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  const goNew = () => {
    trackEvent('Support_NewTicket_Opened', {
      source: 'Support',
    });
    navigation.navigate('SupportNewTicket');
  };
  const goChat = (ticketId: string) => {
    trackEvent('Support_TicketDetails_Opened', {
      source: 'Support',
      ticket_id: ticketId,
    });
    navigation.navigate('SupportTicketChat', { ticketId });
  };

  const visibleTickets = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? tickets
      : (tickets || []).filter(t => {
          const hay = `${String((t as any)?.title ?? '')} ${String(
            (t as any)?.description ?? '',
          )}`.toLowerCase();
          return hay.includes(q);
        });

    // Sort order:
    // 1) Opened cases first (anything except CLOSED)
    // 2) Within each group: latest created_at first
    return [...(filtered || [])].sort((a, b) => {
      const aClosed = String((a as any)?.status ?? '')
        .toUpperCase()
        .trim() === 'CLOSED';
      const bClosed = String((b as any)?.status ?? '')
        .toUpperCase()
        .trim() === 'CLOSED';
      if (aClosed !== bClosed) return aClosed ? 1 : -1;

      const at = new Date(String((a as any)?.created_at ?? '')).getTime();
      const bt = new Date(String((b as any)?.created_at ?? '')).getTime();
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at;
      if (Number.isFinite(at) && !Number.isFinite(bt)) return -1;
      if (!Number.isFinite(at) && Number.isFinite(bt)) return 1;

      // Stable fallback.
      return String((a as any)?.id ?? '').localeCompare(String((b as any)?.id ?? ''));
    });
  }, [tickets, query]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.emptyState}>
          <Avatar.Icon size={72} icon="lifebuoy" style={styles.emptyIcon} />
          <Text variant="titleMedium" style={styles.emptyTitle}>
            No tickets yet
          </Text>
          <Text style={styles.emptySubtitle}>
            Raise a support request and track the conversation here.
          </Text>
          <Button mode="contained" onPress={goNew}>
            Create Ticket
          </Button>
        </View>
      ) : (
        <FlatList
          data={visibleTickets}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            tickets.length > 1 ? (
              <View style={styles.listHeader}>
                <Searchbar
                  placeholder="Search tickets"
                  placeholderTextColor="#9CA3AF"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.search}
                  inputStyle={styles.searchInput}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            query.trim().length ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>
                  No tickets match your search.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TicketCard
              ticket={item}
              onPress={() => goChat(item.id)}
              query={query}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
        />
      )}

      <FAB icon="plus" style={styles.fab} onPress={goNew} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6FA' },
  listContent: { padding: 16, paddingBottom: 120 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24 },

  listHeader: { marginBottom: 12 },
  search: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: { fontSize: 15, fontWeight: '800' },
  noResults: { paddingVertical: 18, alignItems: 'center' },
  noResultsText: { color: '#6B7280', fontWeight: '800' },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIcon: { marginBottom: 16, backgroundColor: '#E0E0E0' },
  emptyTitle: { fontWeight: '600', marginBottom: 6, fontSize: 18 },
  emptySubtitle: {
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
});
