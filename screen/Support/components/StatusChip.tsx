import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip, useTheme } from 'react-native-paper';
import type { TicketStatus } from '../../../service/ticketTypes';

const toneFor = (status: TicketStatus) => {
  switch (status) {
    case 'OPEN':
      return { bg: '#FFF7ED', border: '#FDBA74', text: '#F97316', icon: 'alert-circle-outline' };
    case 'IN_PROGRESS':
      return { bg: '#EFF6FF', border: '#93C5FD', text: '#2563EB', icon: 'progress-clock' };
    case 'RESOLVED':
      return { bg: '#ECFDF3', border: '#86EFAC', text: '#16A34A', icon: 'check-circle-outline' };
    case 'CLOSED':
    default:
      return { bg: '#F3F4F6', border: '#D1D5DB', text: '#6B7280', icon: 'lock-outline' };
  }
};

export function StatusChip({ status }: { status: TicketStatus }) {
  const theme = useTheme();
  const t = toneFor(status);
  return (
    <Chip
      compact
      icon={t.icon}
      style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}
      textStyle={[styles.text, { color: t.text }]}
      selectedColor={theme.colors.primary}
    >
      {status.replace('_', ' ')}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
  },
  text: { fontWeight: '900', fontSize: 12, letterSpacing: 0.3 },
});

