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

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const safe = escapeRegExp(q);
  const re = new RegExp(`(${safe})`, 'ig');
  const parts = String(text ?? '').split(re);
  if (parts.length <= 1) return text;
  return parts.map((p, idx) => {
    const isHit = re.test(p);
    // Reset RegExp state due to global flag
    re.lastIndex = 0;
    return (
      <Text key={idx} style={isHit ? styles.highlight : undefined}>
        {p}
      </Text>
    );
  });
}

export function TicketCard({
  ticket,
  onPress,
  query,
}: {
  ticket: Ticket;
  onPress: () => void;
  query?: string;
}) {
  const theme = useTheme();
  return (
    <Card style={styles.card} mode="elevated" onPress={onPress}>
      <Card.Content style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={2}>
            {highlightText(ticket.title || 'Untitled', query || '')}
          </Text>
          <StatusChip status={ticket.status} />
        </View>

        <Text style={styles.meta} numberOfLines={1}>
          Created {formatDate(ticket.created_at)}
        </Text>

        {!!ticket.description && (
          <Text style={styles.preview} numberOfLines={2}>
            {highlightText(ticket.description, query || '')}
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
  highlight: {
    backgroundColor: '#FEF08A',
    color: '#111827',
  },
});
