import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Chip,
  Dialog,
  Icon,
  Portal,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';

export type BillingMonthDraft = { year: number; monthIdx: number };

export const BILLING_MONTHS: Array<{ label: string; idx: number }> = [
  { label: 'Jan', idx: 0 },
  { label: 'Feb', idx: 1 },
  { label: 'Mar', idx: 2 },
  { label: 'Apr', idx: 3 },
  { label: 'May', idx: 4 },
  { label: 'Jun', idx: 5 },
  { label: 'Jul', idx: 6 },
  { label: 'Aug', idx: 7 },
  { label: 'Sep', idx: 8 },
  { label: 'Oct', idx: 9 },
  { label: 'Nov', idx: 10 },
  { label: 'Dec', idx: 11 },
];

export function normalizeBillingMonthDate(d: Date) {
  // Store as a single datetime representing the month (1st day).
  // Use UTC noon to avoid timezone edge-cases around day/month boundaries.
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 12, 0, 0));
}

export function billingMonthDraftFromDate(d: Date): BillingMonthDraft {
  const nd = normalizeBillingMonthDate(d);
  return { year: nd.getUTCFullYear(), monthIdx: nd.getUTCMonth() };
}

export function billingMonthDateFromDraft(draft: BillingMonthDraft): Date {
  return normalizeBillingMonthDate(new Date(draft.year, draft.monthIdx, 1));
}

export function formatBillingMonthLabel(d: Date) {
  const nd = normalizeBillingMonthDate(d);
  const monthIdx = nd.getUTCMonth();
  const year = nd.getUTCFullYear();
  const m = BILLING_MONTHS[monthIdx]?.label ?? nd.toLocaleDateString('en-GB', { month: 'short' });
  return `${m} ${year}`.toUpperCase();
}

function getYearOptions(centerYear: number, span: number) {
  const years: number[] = [];
  for (let y = centerYear - span; y <= centerYear + span; y += 1) years.push(y);
  return years;
}

export function BillingMonthPickerDialog({
  visible,
  value,
  onDismiss,
  onConfirm,
  yearSpan = 2,
  title = 'Billing month',
}: {
  visible: boolean;
  value: Date;
  onDismiss: () => void;
  onConfirm: (value: Date) => void;
  yearSpan?: number;
  title?: string;
}) {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const surfaceVariant = (theme.colors as any).surfaceVariant ?? theme.colors.surface;

  const [draft, setDraft] = React.useState<BillingMonthDraft>(() =>
    billingMonthDraftFromDate(value ?? new Date()),
  );

  React.useEffect(() => {
    if (!visible) return;
    setDraft(billingMonthDraftFromDate(value ?? new Date()));
  }, [visible, value]);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          { backgroundColor: theme.colors.surface, borderColor: outline },
        ]}
      >
        <Dialog.Title style={{ color: theme.colors.onSurface }}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
            Select month and year.
          </Text>

          <View style={[styles.selectedRow, { borderColor: outline, backgroundColor: theme.colors.surface }]}>
            <View style={[styles.selectedIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="calendar-month-outline" size={18} color={theme.colors.primary} />
            </View>
            <Text style={[styles.selectedLabel, { color: theme.colors.onSurfaceVariant }]}>
              Selected
            </Text>
            <Chip
              compact
              showSelectedCheck={false}
              style={[styles.selectedChip, { backgroundColor: theme.colors.primaryContainer }]}
              textStyle={{ fontWeight: '900', color: theme.colors.primary }}
            >
              {BILLING_MONTHS[draft.monthIdx]?.label} {draft.year}
            </Chip>
          </View>

          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Month</Text>
          <View style={styles.chipGrid}>
            {BILLING_MONTHS.map((m) => {
              const selected = draft.monthIdx === m.idx;
              return (
                <Chip
                  key={m.idx}
                  compact
                  showSelectedCheck={false}
                  selected={selected}
                  onPress={() => setDraft((p) => ({ ...p, monthIdx: m.idx }))}
                  style={[
                    styles.chip,
                    {
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.primary : outline,
                      backgroundColor: selected ? theme.colors.primaryContainer : surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    fontSize: 12,
                    fontWeight: selected ? '900' : '800',
                    color: selected ? theme.colors.primary : theme.colors.onSurface,
                  }}
                >
                  {m.label}
                </Chip>
              );
            })}
          </View>

          <Text style={[styles.label, { color: theme.colors.onSurface }]}>Year</Text>
          <View style={styles.chipGrid}>
            {getYearOptions(draft.year, yearSpan).map((y) => {
              const selected = draft.year === y;
              return (
                <Chip
                  key={y}
                  compact
                  showSelectedCheck={false}
                  selected={selected}
                  onPress={() => setDraft((p) => ({ ...p, year: y }))}
                  style={[
                    styles.chip,
                    {
                      borderWidth: 1,
                      borderColor: selected ? theme.colors.primary : outline,
                      backgroundColor: selected ? theme.colors.primaryContainer : surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    fontSize: 12,
                    fontWeight: selected ? '900' : '800',
                    color: selected ? theme.colors.primary : theme.colors.onSurface,
                  }}
                >
                  {String(y)}
                </Chip>
              );
            })}

            {/* Quick action: placed on the right side of the wrapped year row */}
            <TouchableRipple
              onPress={() => setDraft(billingMonthDraftFromDate(new Date()))}
              borderless
              style={[
                styles.currentMonthInline,
                styles.quickPill,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: theme.colors.primary,
                },
              ]}
            >
              <View style={styles.quickPillInner}>
                <Icon
                  source="calendar-today"
                  size={14}
                  color={theme.colors.primary}
                />
                <Text
                  style={[styles.quickPillText, { color: theme.colors.primary }]}
                  numberOfLines={1}
                >
                  Current month
                </Text>
              </View>
            </TouchableRipple>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button mode="contained" onPress={() => onConfirm(billingMonthDateFromDraft(draft))}>
            Done
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: { borderRadius: 16, borderWidth: 1 },
  hint: { marginTop: -2, marginBottom: 10, fontWeight: '700' },
  label: { marginTop: 10, marginBottom: 8, fontWeight: '900' },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  selectedIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedLabel: { fontWeight: '900', marginRight: 10 },
  selectedChip: { borderRadius: 999, overflow: 'hidden' },
  currentMonthInline: {
    marginLeft: 'auto',
  },
  quickPill: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  quickPillInner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  quickPillText: { fontSize: 12, fontWeight: '900' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { marginBottom: 8, borderRadius: 999, overflow: 'hidden' },
});

