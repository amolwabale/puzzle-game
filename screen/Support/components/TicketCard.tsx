import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import type { Ticket } from '../../../service/ticketTypes';
import { StatusChip } from './StatusChip';

const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export function TicketCard({
  ticket,
  onPress,
}: {
  ticket: Ticket;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={2}>
            {ticket.title || 'Untitled'}
          </Text>
          <StatusChip status={ticket.status} />
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          Created {formatDate(ticket.created_at)}
        </Text>

        {!!ticket.description && (
          <Text style={styles.preview} numberOfLines={2}>
            {ticket.description}
          </Text>
        )}

        {!!ticket.upload_url && (
          <Text
            style={[styles.attachment, { color: theme.colors.primary }]}
            numberOfLines={1}
          >
            Attachment added
          </Text>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  content: { paddingVertical: 14 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { flex: 1, fontWeight: '900', fontSize: 16, color: '#111827' },
  meta: { marginTop: 8, color: '#6B7280', fontWeight: '800', fontSize: 12 },
  preview: {
    marginTop: 6,
    color: '#374151',
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 18,
  },
  attachment: { marginTop: 8, fontWeight: '900', fontSize: 12 },
});
