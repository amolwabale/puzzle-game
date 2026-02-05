import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  InteractionManager,
  Keyboard,
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
import {
  closeTicket,
  getTicket,
  listTicketChat,
  sendTicketChat,
} from '../../service/ticketService';
import { createSignedUrlFromPublicUrl } from '../../service/MenuService';
import { ChatBubble } from './components/ChatBubble';
import { StatusChip } from './components/StatusChip';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';

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
  const [composerHeight, setComposerHeight] = React.useState(0);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const keyboardAnim = React.useRef(new Animated.Value(0)).current;

  const listRef = React.useRef<FlatList<TicketChat>>(null);
  const inputRef = React.useRef<any>(null);

  const scrollToLatest = React.useCallback((animated = true) => {
    // FlatList scroll-to-bottom can be flaky if called before layout settles
    // (especially when keyboard height and composer height change).
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        // Small delay lets RN commit content size + margin changes first.
        const run = (anim: boolean) => {
          try {
            listRef.current?.scrollToEnd({ animated: anim });
          } catch {
            // ignore
          }
        };

        // Pass 1: quick snap/animate.
        setTimeout(() => run(animated), 40);
        // Pass 2: after keyboard/tab-bar animations settle, ensure the LAST bubble is fully visible.
        setTimeout(() => run(false), 220);
      });
    });
  }, []);

  const load = React.useCallback(
    async (isRefresh = false) => {
      try {
        isRefresh ? setRefreshing(true) : setLoading(true);
        const [t, chat] = await Promise.all([
          getTicket(ticketId),
          listTicketChat(ticketId),
        ]);

        if (!t) {
          Alert.alert('Not found', 'Ticket could not be loaded.', [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
          return;
        }

        setTicket(t);
        setMessages(chat || []);
      } catch (e: any) {
        Alert.alert('Load failed', e?.message || 'Could not load ticket');
      } finally {
        isRefresh ? setRefreshing(false) : setLoading(false);
      }
    },
    [ticketId, navigation],
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
            trackEvent('Support_TicketClosed', {
              source: 'Support',
              ticket_id: ticketId,
            });
          } catch (e: any) {
            Alert.alert('Failed', e?.message || 'Could not close ticket');
          }
        },
      },
    ]);
  }, [ticket, ticketId]);

  useFocusEffect(
    React.useCallback(() => {
      load(false);
    }, [load]),
  );

  React.useEffect(() => {
    if (!loading && messages.length) {
      scrollToLatest(false);
    }
  }, [loading, messages.length, scrollToLatest]);

  // WhatsApp-like composer: move the input bar by actual keyboard height.
  // This avoids inconsistencies with KeyboardAvoidingView + tab bars.
  React.useEffect(() => {
    // WhatsApp-like: on iOS follow keyboard animation using WillShow/WillHide + duration.
    // On Android the window resizes (adjustResize), so DidShow/DidHide is sufficient.
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ? Number(e.endCoordinates.height) : 0;
      // When typing, keep focus on conversation: collapse details.
      setDetailsOpen(false);
      setKeyboardHeight(h);
      // Smoothly track keyboard (iOS), snap on Android.
      keyboardAnim.stopAnimation();
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardAnim, {
          toValue: h,
          duration: typeof e?.duration === 'number' ? e.duration : 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        keyboardAnim.setValue(h);
      }

      // When keyboard opens, ensure the latest message is visible (WhatsApp-like).
      scrollToLatest(false);
    };

    const onHide = (e: any) => {
      setKeyboardHeight(0);
      keyboardAnim.stopAnimation();
      if (Platform.OS === 'ios') {
        Animated.timing(keyboardAnim, {
          toValue: 0,
          duration: typeof e?.duration === 'number' ? e.duration : 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      } else {
        keyboardAnim.setValue(0);
      }

      // When keyboard closes (tap outside), keep view anchored to latest message.
      scrollToLatest(false);
    };

    const s1 = Keyboard.addListener(showEvt as any, onShow);
    const s2 = Keyboard.addListener(hideEvt as any, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, [keyboardAnim, scrollToLatest]);

  const canChat = ticket?.status !== 'CLOSED';

  const onSend = async () => {
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

    // Clear the input immediately (WhatsApp-like) and keep focus.
    setInput('');
    requestAnimationFrame(() => inputRef.current?.focus?.());
    setSending(true);
    setMessages(prev => [...prev, temp]);
    // Scroll after the message is actually appended/rendered.
    scrollToLatest(true);

    trackEvent('Support_MessageSent', {
      source: 'Support',
      ticket_id: ticketId,
      message: text,
    });
    try {
      const saved = await sendTicketChat({ ticketId, chat: text });
      setMessages(prev => prev.map(m => (m.id === temp.id ? saved : m)));
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== temp.id));
      // If user already started typing the next message, don't overwrite it.
      setInput(curr => (curr.trim().length === 0 ? text : curr));
      Alert.alert('Send failed', e?.message || 'Could not send message');
    } finally {
      setSending(false);
      // Keep focus for rapid consecutive messages and ensure we're at bottom.
      requestAnimationFrame(() => {
        if (canChat) inputRef.current?.focus?.();
        scrollToLatest(true);
      });
    }
  };

  if (loading || !ticket) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* 🔒 PINNED HEADER */}
      <Surface style={styles.pinnedHeader} elevation={3}>
        <TouchableRipple onPress={() => setDetailsOpen(v => !v)} borderless>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {ticket.title}
            </Text>
            <StatusChip status={ticket.status} />
            <Icon
              source={detailsOpen ? 'chevron-up' : 'chevron-down'}
              size={20}
            />
          </View>
        </TouchableRipple>

        {detailsOpen && (
          <View style={styles.details}>
            {/* FULL TITLE */}
            <Text style={styles.detailLabel}>Title</Text>
            <Text style={styles.detailValue}>{ticket.title || '-'}</Text>

            {/* DESCRIPTION */}
            <Text style={[styles.detailLabel, { marginTop: 10 }]}>
              Description
            </Text>
            <Text style={styles.detailValue}>{ticket.description || '-'}</Text>

            {/* META */}
            <Text style={styles.metaText}>
              Created {formatDate(ticket.created_at)}
            </Text>

            {/* ACTIONS (same-row buttons) */}
            {ticket.upload_url && ticket.status !== 'CLOSED' ? (
              <View style={styles.detailActionsRow}>
                <Button
                  mode="outlined"
                  icon="paperclip"
                  style={styles.detailActionBtn}
                  onPress={async () => {
                    try {
                      const signed = await createSignedUrlFromPublicUrl(
                        ticket.upload_url!,
                      );
                      trackEvent('Support_AttachmentViewed', {
                        source: 'Support',
                        ticket_id: ticketId,
                        attachment_url: signed,
                      });
                      navigation.navigate('SupportDocument', {
                        title: 'Attachment',
                        url: signed,
                      });
                    } catch (e: any) {
                      Alert.alert(
                        'Failed',
                        e?.message || 'Could not open attachment',
                      );
                    }
                  }}
                >
                  View attachment
                </Button>

                <Button
                  mode="outlined"
                  icon="check-circle-outline"
                  style={styles.detailActionBtn}
                  onPress={onCloseTicket}
                >
                  Mark as Closed
                </Button>
              </View>
            ) : ticket.upload_url ? (
              <View style={styles.detailActionsRow}>
                <Button
                  mode="outlined"
                  icon="paperclip"
                  style={styles.detailActionBtnSingle}
                  onPress={async () => {
                    try {
                      const signed = await createSignedUrlFromPublicUrl(
                        ticket.upload_url!,
                      );
                      navigation.navigate('SupportDocument', {
                        title: 'Attachment',
                        url: signed,
                      });
                    } catch (e: any) {
                      Alert.alert(
                        'Failed',
                        e?.message || 'Could not open attachment',
                      );
                    }
                  }}
                >
                  View attachment
                </Button>
              </View>
            ) : ticket.status !== 'CLOSED' ? (
              <View style={styles.detailActionsRow}>
                <Button
                  mode="outlined"
                  icon="check-circle-outline"
                  style={styles.detailActionBtnSingle}
                  onPress={onCloseTicket}
                >
                  Mark as Closed
                </Button>
              </View>
            ) : null}
          </View>
        )}
      </Surface>

      <View style={styles.body}>
        {/* 💬 CHAT LIST */}
        <FlatList
          ref={listRef}
          style={[
            styles.list,
            // Shrink the visible chat area so it always ends ABOVE
            // the composer + keyboard (WhatsApp behavior) without moving under the header.
            { marginBottom: composerHeight + keyboardHeight },
          ]}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <ChatBubble msg={item} isMe={item.user_role === 'USER'} />
          )}
          contentContainerStyle={styles.chatContent}
          // IMPORTANT: use a real footer spacer instead of paddingBottom.
          // Some RN versions don't include contentContainer padding in scrollToEnd,
          // which can make it stop with the LAST message partially hidden.
          ListFooterComponent={<View style={{ height: 12 }} />}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          onContentSizeChange={() => scrollToLatest(false)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
        />

        {/* ⌨️ INPUT BAR */}
        <Animated.View
          style={[
            styles.composerWrap,
            {
              transform: [{ translateY: Animated.multiply(keyboardAnim, -1) }],
            },
          ]}
        >
          <Surface
            style={[
              styles.inputBar,
              {
                borderColor:
                  (theme.colors as any).outlineVariant ?? theme.colors.outline,
              },
            ]}
            elevation={2}
            onLayout={e => setComposerHeight(e.nativeEvent.layout.height)}
          >
            <TextInput
              ref={inputRef}
              mode="outlined"
              placeholder={canChat ? 'Type a message…' : 'Ticket closed'}
              value={input}
              onChangeText={setInput}
              // WhatsApp-style: keep input editable even while a message is sending
              // so the keyboard doesn't dismiss and the user can type the next message.
              editable={canChat}
              dense
              blurOnSubmit={false}
              style={{ flex: 1 }}
            />
            <Button
              mode="contained"
              onPress={onSend}
              disabled={!canChat || sending || !input.trim()}
            >
              Send
            </Button>
          </Surface>
        </Animated.View>
      </View>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  pinnedHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontWeight: '900',
    fontSize: 15,
    color: '#111827',
  },

  details: {
    marginTop: 10,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  detailValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  metaText: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  detailActionBtn: {
    flex: 1,
  },
  detailActionBtnSingle: {
    flex: 1,
    alignSelf: 'flex-start',
  },

  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  body: { flex: 1 },
  list: { flex: 1 },
  composerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
});
