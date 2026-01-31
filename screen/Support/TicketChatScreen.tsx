import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Icon,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import type { Ticket, TicketChat } from '../../service/ticketTypes';
import { closeTicket, getTicket, listTicketChat, sendTicketChat } from '../../service/ticketService';
import { createSignedUrlFromPublicUrl } from '../../service/MenuService';
import { ChatBubble } from './components/ChatBubble';
import { StatusChip } from './components/StatusChip';

type RouteParams = { ticketId: string };

const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export default function TicketChatScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ticketId } = (route.params || {}) as RouteParams;

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [messages, setMessages] = React.useState<TicketChat[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  React.useEffect(() => {
    // Default to collapsed for long tickets; expanded for short ones.
    if (!ticket) return;
    const score = (ticket.title?.length || 0) + (ticket.description?.length || 0);
    setDetailsOpen(score <= 180);
    // Only when a new ticket loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const load = React.useCallback(async (isRefresh = false) => {
    try {
      isRefresh ? setRefreshing(true) : setLoading(true);
      const [t, chat] = await Promise.all([getTicket(ticketId), listTicketChat(ticketId)]);
      if (!t) {
        Alert.alert('Not found', 'Ticket could not be loaded.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      setTicket(t);
      setMessages(chat || []);
    } catch (e: any) {
      Alert.alert('Load Failed', e?.message || 'Could not load ticket');
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [ticketId, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  const onCloseTicket = React.useCallback(() => {
    if (!ticket || ticket.status === 'CLOSED') return;
    Alert.alert('Close ticket', 'Mark this ticket as CLOSED?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark as Closed',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await closeTicket(ticketId);
            setTicket(updated);
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Could not close ticket');
          }
        },
      },
    ]);
  }, [ticket, ticketId]);

  const canChat = ticket?.status !== 'CLOSED';

  const openAttachment = React.useCallback(async () => {
    const url = ticket?.upload_url;
    if (!url) {
      Alert.alert('Not available', 'No attachment was uploaded for this ticket.');
      return;
    }
    try {
      const signed = await createSignedUrlFromPublicUrl(url);
      if (!signed) {
        Alert.alert('Open failed', 'Could not generate a secure link. Please try again.');
        return;
      }
      navigation.navigate('SupportDocument', { title: 'Attachment', url: signed });
    } catch {
      Alert.alert('Open failed', 'Could not open attachment.');
    }
  }, [ticket?.upload_url, navigation]);

  const onSend = React.useCallback(async () => {
    if (!canChat) return;
    const text = input.trim();
    if (!text) return;

    const temp: TicketChat = {
      id: `local-${Date.now()}`,
      ticket_id: ticketId,
      user_id: 'me',
      user_role: 'USER',
      created_at: new Date().toISOString(),
      chat: text,
    };

    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, temp]);

    try {
      const saved = await sendTicketChat({ ticketId, chat: text });
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
    } catch (e: any) {
      // rollback optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== temp.id));
      Alert.alert('Send failed', e?.message || 'Could not send message');
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [canChat, input, ticketId]);

  if (loading || !ticket) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Surface style={styles.hero} elevation={2}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {ticket.title}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              Ticket conversation
            </Text>
          </View>
          <StatusChip status={ticket.status} />
        </View>

        {ticket.status === 'CLOSED' ? (
          <View style={[styles.banner, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="lock-outline" size={16} color={theme.colors.primary} />
            <Text style={[styles.bannerText, { color: theme.colors.primary }]}>
              This ticket is closed. Chat is disabled.
            </Text>
          </View>
        ) : (
          <View style={styles.heroActions}>
            <Button mode="outlined" onPress={onCloseTicket} icon="check-circle-outline">
              Mark as Closed
            </Button>
            <Button mode="text" onPress={() => void load(true)} icon="refresh">
              Refresh
            </Button>
          </View>
        )}

        {/* DETAILS (collapsible) */}
        <Surface
          style={[
            styles.detailsCard,
            { borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline },
          ]}
          elevation={0}
        >
          <TouchableRipple onPress={() => setDetailsOpen((v) => !v)} borderless style={styles.detailsHeader}>
            <View style={styles.detailsHeaderInner}>
              <View style={[styles.detailsIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                <Icon source="information-outline" size={16} color={theme.colors.primary} />
              </View>
              <Text style={styles.detailsTitle} numberOfLines={1}>
                Ticket details
              </Text>
              <Icon source={detailsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
            </View>
          </TouchableRipple>

          {detailsOpen ? (
            <View style={styles.detailsBody}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Title</Text>
                <Text style={styles.detailValue}>{ticket.title || '-'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Description</Text>
                <Text style={styles.detailValue}>{ticket.description || '-'}</Text>
              </View>
              <View style={styles.detailMetaRow}>
                <View style={styles.metaPill}>
                  <Icon source="calendar" size={14} color="#6B7280" />
                  <Text style={styles.metaText}>Created {formatDate(ticket.created_at)}</Text>
                </View>

                {ticket.upload_url ? (
                  <TouchableRipple onPress={() => void openAttachment()} borderless style={styles.attachPill}>
                    <View style={styles.attachPillInner}>
                      <Icon source="paperclip" size={14} color={theme.colors.primary} />
                      <Text style={[styles.attachText, { color: theme.colors.primary }]} numberOfLines={1}>
                        View attachment
                      </Text>
                    </View>
                  </TouchableRipple>
                ) : null}
              </View>
            </View>
          ) : null}
        </Surface>
      </Surface>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.chatContent}
        renderItem={({ item }) => (
          <ChatBubble msg={item} isMe={item.user_role === 'USER'} />
        )}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      <Surface style={styles.inputBar} elevation={2}>
        <TextInput
          mode="outlined"
          placeholder={canChat ? 'Type a message…' : 'Ticket closed'}
          value={input}
          onChangeText={setInput}
          editable={canChat && !sending}
          dense
          style={{ flex: 1 }}
          contentStyle={styles.inputContent}
        />
        <Button
          mode="contained"
          onPress={() => void onSend()}
          disabled={!canChat || sending || !input.trim()}
          loading={sending}
          style={styles.sendBtn}
          compact
        >
          Send
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6FA' },

  hero: { borderRadius: 18, padding: 14, margin: 16, marginBottom: 10, backgroundColor: '#FFFFFF' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  heroSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  heroActions: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  banner: {
    marginTop: 10,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: { fontWeight: '900', fontSize: 13, flex: 1 },

  detailsCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  detailsHeader: { borderRadius: 16 },
  detailsHeaderInner: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsIcon: { width: 28, height: 28, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailsTitle: { flex: 1, fontWeight: '900', fontSize: 13, color: '#111827' },
  detailsBody: { paddingHorizontal: 12, paddingBottom: 12 },
  detailRow: { marginTop: 10 },
  detailLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280', marginBottom: 4 },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  detailMetaRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  metaText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  attachPill: { borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  attachPillInner: { paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachText: { fontSize: 12, fontWeight: '900' },

  chatContent: { paddingHorizontal: 16, paddingBottom: 88 },

  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  inputContent: { paddingVertical: 8 },
  sendBtn: { borderRadius: 12 },
});

