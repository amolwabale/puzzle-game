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
  Text,
} from 'react-native-paper';
import { listTickets } from '../../service/ticketService';
import type { Ticket } from '../../service/ticketTypes';
import { TicketCard } from '../Support/components/TicketCard';

export default function SupportScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);

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

  const goNew = () => navigation.navigate('SupportNewTicket');
  const goChat = (ticketId: string) =>
    navigation.navigate('SupportTicketChat', { ticketId });

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
          data={tickets}
          keyExtractor={t => t.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TicketCard ticket={item} onPress={() => goChat(item.id)} />
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
