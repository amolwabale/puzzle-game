import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { TicketChat } from '../../../service/ticketTypes';

const formatTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export function ChatBubble({ msg, isMe }: { msg: TicketChat; isMe: boolean }) {
  const theme = useTheme();
  const bubbleBg = isMe ? theme.colors.primaryContainer : '#FFFFFF';
  const bubbleBorder =
    (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const textColor = theme.colors.onSurface;

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBg,
            borderColor: bubbleBorder,
            borderTopLeftRadius: isMe ? 16 : 6,
            borderTopRightRadius: isMe ? 6 : 16,
          },
        ]}
      >
        <Text style={[styles.chatText, { color: textColor }]}>{msg.chat}</Text>
        <Text style={styles.timeText}>{formatTime(msg.created_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 10, flexDirection: 'row' },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatText: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  timeText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    alignSelf: 'flex-end',
  },
});
