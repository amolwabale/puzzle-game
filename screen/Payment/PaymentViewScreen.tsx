import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Dialog,
  Icon,
  IconButton,
  ProgressBar,
  Provider as PaperProvider,
  Portal,
  Surface,
  Text,
  TextInput,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { fetchBillById, fetchLatestSetting, type BillRecord, updateBillPayment } from '../../service/BillService';
import { fetchRooms } from '../../service/RoomService';
import { fetchTenants } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';

const formatMoney = (n?: number | null) => `₹${Math.round(Number(n || 0))}`;
const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';
const formatMonthYear = (d?: string | null) =>
  d
    ? new Date(d)
        .toLocaleDateString('en-GB', {
          month: 'short',
          year: 'numeric',
        })
        .toUpperCase()
    : '-';

const formatMonth = (d: Date) =>
  d.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  });

function getPrevAndCurrMonthLabels(dateString?: string | null) {
  const billDate = dateString ? new Date(dateString) : new Date();
  const currMonth = new Date(billDate.getFullYear(), billDate.getMonth(), 1);
  const prevMonth = new Date(billDate.getFullYear(), billDate.getMonth() - 1, 1);

  const currLabel = formatMonth(currMonth);
  const prevLabel =
    prevMonth.getFullYear() !== currMonth.getFullYear()
      ? formatMonth(prevMonth)
      : prevMonth.toLocaleDateString('en-GB', { month: 'short' });

  return { prevLabel, currLabel };
}

function twoDp(n: number) {
  return Math.round(n * 100) / 100;
}

const formatDateTime = (d: Date) =>
  d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function appendPaymentComment(existing: string | null | undefined, line: string) {
  const base = (existing || '').trim();
  return base.length ? `${base}\n${line}` : line;
}

const scalePaperThemeFonts = (t: any, scale: number) => {
  const s = Number.isFinite(scale) ? scale : 1;
  const fonts = t?.fonts ?? {};
  const nextFonts: Record<string, any> = { ...fonts };
  Object.keys(nextFonts).forEach((k) => {
    const v = nextFonts[k];
    if (!v || typeof v !== 'object') return;
    const nv: any = { ...v };
    if (typeof nv.fontSize === 'number') nv.fontSize = Math.round(nv.fontSize * s);
    if (typeof nv.lineHeight === 'number') nv.lineHeight = Math.round(nv.lineHeight * s);
    if (typeof nv.letterSpacing === 'number') nv.letterSpacing = Number((nv.letterSpacing * s).toFixed(2));
    nextFonts[k] = nv;
  });
  return { ...t, fonts: nextFonts };
};

export default function PaymentViewScreen() {
  const theme = useTheme();
  const scaledTheme = React.useMemo(() => scalePaperThemeFonts(theme, 1.15), [theme]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const billId: number | undefined = route.params?.billId;
  const openRecordPayment: boolean | undefined = route.params?.openRecordPayment;
  const autoOpenedRef = React.useRef(false);

  const [loading, setLoading] = React.useState(true);
  const [bill, setBill] = React.useState<BillRecord | null>(null);
  const [tenantName, setTenantName] = React.useState('-');
  const [roomName, setRoomName] = React.useState('-');
  const [tenantPhotoUrl, setTenantPhotoUrl] = React.useState<string | undefined>(undefined);
  const [settings, setSettings] = React.useState<{ electricity_unit: number }>({ electricity_unit: 0 });

  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentSaving, setPaymentSaving] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<'CASH' | 'UPI' | 'BANK'>('UPI');
  const [paymentNote, setPaymentNote] = React.useState('');

  const dialogMaxHeight = React.useMemo(
    () => Math.round(Dimensions.get('window').height * 0.88),
    [],
  );
  const dialogScrollMaxHeight = React.useMemo(
    () => Math.round(Dimensions.get('window').height * 0.52),
    [],
  );

  // same approach as Tenant/Payment list (signed URLs for private bucket)
  const createSignedUrl = async (fullUrl?: string | null) => {
    if (!fullUrl) return undefined;
    const marker = '/tenant-manager/';
    const index = fullUrl.indexOf(marker);
    if (index === -1) return undefined;
    const filePath = fullUrl.substring(index + marker.length);

    const { data, error } = await supabase.storage
      .from('tenant-manager')
      .createSignedUrl(filePath, 60 * 60);

    if (error) return undefined;
    return data.signedUrl;
  };

  const load = React.useCallback(async () => {
    if (!billId) {
      setBill(null);
      return;
    }

    try {
      setLoading(true);
      setTenantPhotoUrl(undefined);

      const [b, rooms, tenants, s] = await Promise.all([
        fetchBillById(billId),
        fetchRooms(),
        fetchTenants(),
        fetchLatestSetting(),
      ]);

      setBill(b);
      setSettings({ electricity_unit: s.electricity_unit || 0 });

      const roomMap: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomMap[r.id] = r.name || '-';
      });
      const tenantMap: Record<number, string> = {};
      (tenants || []).forEach((t: any) => {
        if (t?.id != null) tenantMap[t.id] = t.name || '-';
      });

      const rn = b?.room_id != null ? roomMap[b.room_id] : '-';
      const tn = b?.tenant_id != null ? tenantMap[b.tenant_id] : '-';

      setRoomName(rn || '-');
      setTenantName(tn || '-');

      // signed URL for tenant photo (square thumbnail in header)
      if (b?.tenant_id != null) {
        const t = (tenants || []).find((x: any) => x?.id === b.tenant_id);
        const signed = await createSignedUrl((t as any)?.profile_photo_url);
        if (signed) setTenantPhotoUrl(signed);
      }
    } catch (e: any) {
      Alert.alert('Load Failed', e.message || 'Could not load bill');
    } finally {
      setLoading(false);
    }
  }, [billId]);

  useFocusEffect(
    React.useCallback(() => {
      load();
    }, [load]),
  );

  // ---- Record-payment auto-open (must be BEFORE early returns to keep hook order stable)
  const totalForGate = Number(bill?.total_amount || 0);
  const paidForGate = Number(bill?.paid_amount || 0);
  const pendingForGate = Math.max(0, totalForGate - paidForGate);
  const canRecordPaymentGate = !!bill && pendingForGate > 0;

  const openPaymentDialog = React.useCallback(() => {
    setPaymentAmount('');
    setPaymentMethod('UPI');
    setPaymentNote('');
    setPaymentDialogOpen(true);
  }, []);

  // Reset the auto-open gate when navigating to a different bill.
  React.useEffect(() => {
    autoOpenedRef.current = false;
  }, [billId]);

  React.useEffect(() => {
    if (autoOpenedRef.current) return;
    if (!openRecordPayment) return;
    if (!canRecordPaymentGate) return;
    // open once when bill is loaded and pending > 0
    autoOpenedRef.current = true;
    openPaymentDialog();
  }, [openRecordPayment, canRecordPaymentGate, bill?.id, openPaymentDialog]);

  if (loading) {
    return (
      <PaperProvider theme={scaledTheme}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" />
        </View>
      </PaperProvider>
    );
  }

  if (!bill) {
    return (
      <PaperProvider theme={scaledTheme}>
        <View style={styles.emptyWrap}>
          <Avatar.Icon
            size={56}
            icon="file-document-outline"
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.primary}
          />
          <Text variant="titleMedium" style={{ fontWeight: '800', marginTop: 12 }}>
            Bill not found
          </Text>
          <Text style={{ color: '#666', marginTop: 4 }}>
            This bill may have been deleted or you don’t have access.
          </Text>
        </View>
      </PaperProvider>
    );
  }

  const rent = Number(bill.rent || 0);
  const water = Number(bill.water || 0);
  const electricity = Number(bill.electricity || 0);
  const adHoc = Number(bill.ad_hoc_amount || 0);
  const total = Number(bill.total_amount || 0);
  const paid = Number(bill.paid_amount || 0);
  const pending = Math.max(0, total - paid);
  const status = (bill.status || '-').toUpperCase();
  const paidProgress = total > 0 ? Math.min(1, Math.max(0, paid / total)) : 0;
  const statusTone =
    status === 'PAID'
      ? { bg: '#ECFDF3', border: '#86EFAC', text: '#16A34A' } // green
      : status === 'PARTIAL'
        ? { bg: '#FFF7ED', border: '#FDBA74', text: '#F97316' } // orange
        : { bg: '#FFF5F5', border: '#FECACA', text: '#EF4444' }; // red (UNPAID/default)

  const prev = Number(bill.previous_month_meter_reading || 0);
  const curr = Number(bill.current_month_meter_reading || 0);
  const units = Math.max(0, curr - prev);
  const rate = units > 0 ? twoDp(electricity / units) : settings.electricity_unit || 0;

  const { prevLabel, currLabel } = getPrevAndCurrMonthLabels(bill.created_at);
  const billMonth = formatMonthYear(bill.created_at);

  const canEditBill = paid <= 0;
  const canRecordPayment = pending > 0;

  const amountNum = paymentAmount.trim().length ? Number(paymentAmount) : 0;
  const isAmountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= pending;
  const nextPaid = Math.min(total, paid + (isAmountValid ? amountNum : 0));
  const nextPending = Math.max(0, total - nextPaid);
  const nextStatus: 'UNPAID' | 'PARTIAL' | 'PAID' =
    nextPaid <= 0 ? 'UNPAID' : nextPending <= 0 ? 'PAID' : 'PARTIAL';
  const nextStatusTone =
    nextStatus === 'PAID'
      ? { bg: '#ECFDF3', border: '#86EFAC', text: '#16A34A' }
      : nextStatus === 'PARTIAL'
        ? { bg: '#FFF7ED', border: '#FDBA74', text: '#F97316' }
        : { bg: '#FFF5F5', border: '#FECACA', text: '#EF4444' };
  const nextProgress = total > 0 ? Math.min(1, Math.max(0, nextPaid / total)) : 0;

  const savePayment = async () => {
    if (paymentSaving) return;
    if (!isAmountValid) return;

    try {
      setPaymentSaving(true);

      const now = new Date();
      const note = paymentNote.trim();
      const line = `[${formatDateTime(now)}] ${paymentMethod} received ${formatMoney(amountNum)}${
        note ? ` • ${note}` : ''
      } (Paid ${formatMoney(nextPaid)}, Pending ${formatMoney(nextPending)})`;

      const nextComment = appendPaymentComment(bill.paid_amount_comment, line);

      // Update existing bill row: paid_amount + status + paid_amount_comment
      await updateBillPayment({
        billId: bill.id,
        paidAmount: nextPaid,
        status: nextStatus,
        paidAmountComment: nextComment,
      });

      setPaymentDialogOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'Could not record payment');
    } finally {
      setPaymentSaving(false);
    }
  };

  return (
    <>
      <PaperProvider theme={scaledTheme}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
      {/* HERO */}
      <Surface style={styles.hero} elevation={2}>
        <View
          style={[
            styles.heroPhotoWrap,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.primary,
            },
          ]}
        >
          {tenantPhotoUrl ? (
            <Image source={{ uri: tenantPhotoUrl }} style={styles.heroPhoto} resizeMode="cover" />
          ) : (
            <Icon source="account" size={28} color={theme.colors.primary} />
          )}
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <View style={styles.heroKickerRow}>
            <Text style={styles.heroKicker} numberOfLines={1}>
              BILL SUMMARY
            </Text>
            <Surface
              style={[
                styles.heroMonthPill,
                {
                  backgroundColor: theme.colors.primaryContainer,
                  borderColor: theme.colors.primary,
                },
              ]}
              elevation={0}
            >
              <Text
                style={[styles.heroMonthPillText, { color: theme.colors.primary }]}
                numberOfLines={1}
              >
                {billMonth}
              </Text>
            </Surface>
          </View>

          <Text variant="headlineSmall" style={styles.heroTenant} numberOfLines={1}>
            {tenantName}
          </Text>

          <View style={styles.heroRoomRow}>
            <Icon source="home-city-outline" size={18} color={theme.colors.primary} />
            <Text variant="titleMedium" style={styles.heroRoom} numberOfLines={1}>
              {roomName}
            </Text>
          </View>

          <View style={styles.heroMetaRow}>
            <Icon source="calendar" size={16} color="#6B7280" />
            <Text style={styles.heroMetaText} numberOfLines={1}>
              Issued {formatDate(bill.created_at)}
            </Text>
          </View>
        </View>

        {/* Edit allowed only when paid_amount is 0 */}
        {canEditBill ? (
          <IconButton
            icon="pencil"
            size={20}
            onPress={() => navigation.navigate('PaymentForm', { billId: bill.id })}
            iconColor={theme.colors.primary}
            style={[
              styles.heroEditBtn,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
            ]}
          />
        ) : null}
      </Surface>

      {/* BILL PREVIEW (no-scroll layout) */}
      <Surface style={styles.billCard} elevation={2}>
        <View style={styles.billCardClip}>
          <Surface
            style={[styles.billTop, { backgroundColor: theme.colors.primaryContainer }]}
            elevation={0}
          >
            <View style={styles.billTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.billTopLabel}>Total Rent</Text>
                <Text
                  style={styles.billTopValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatMoney(total)}
                </Text>
                
              </View>
              <View style={styles.statusCol}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: statusTone.bg, borderColor: statusTone.border },
                  ]}
                >
                  <Text style={[styles.statusPillText, { color: statusTone.text }]}>{status}</Text>
                </View>

                <TouchableRipple
                  onPress={openPaymentDialog}
                  disabled={!canRecordPayment}
                  borderless
                  style={[
                    styles.recordChip,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: canRecordPayment ? theme.colors.primary : theme.colors.outline,
                      opacity: canRecordPayment ? 1 : 0.6,
                    },
                  ]}
                >
                  <View style={styles.recordChipInner}>
                    <Icon
                      source="cash-plus"
                      size={16}
                      color={canRecordPayment ? theme.colors.primary : theme.colors.outline}
                    />
                    <Text
                      style={[
                        styles.recordChipText,
                        { color: canRecordPayment ? theme.colors.primary : theme.colors.outline },
                      ]}
                      numberOfLines={1}
                    >
                      Record
                    </Text>
                  </View>
                </TouchableRipple>
              </View>
            </View>

            <Surface
              style={[
                styles.paymentStrip,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline,
                },
              ]}
              elevation={0}
            >
              <View style={styles.paymentStripRow}>
                <PaymentStat
                  icon="cash"
                  label="Paid"
                  amount={formatMoney(paid)}
                  color={theme.colors.primary}
                />
                <View
                  style={[
                    styles.paymentStripDivider,
                    {
                      backgroundColor:
                        (theme.colors as any).outlineVariant ?? theme.colors.outline,
                    },
                  ]}
                />
                <PaymentStat
                  icon="clock-outline"
                  label="Pending"
                  amount={formatMoney(pending)}
                  color={pending > 0 ? theme.colors.error : theme.colors.primary}
                />
              </View>
              <ProgressBar
                progress={paidProgress}
                color={pending > 0 ? theme.colors.primary : theme.colors.primary}
                style={styles.paymentProgress}
              />
            </Surface>
          </Surface>

          <View style={styles.tileGrid}>
            <BreakdownTile icon="home-city-outline" label="Rent" value={formatMoney(rent)} />
            <BreakdownTile icon="water-outline" label="Water" value={formatMoney(water)} />
            <BreakdownTile
              icon="flash-outline"
              label="Electricity"
              value={formatMoney(electricity)}
              sub={`${units} × ${rate}`}
            />
            <BreakdownTile
              icon="cash-plus"
              label="Ad-hoc"
              value={formatMoney(adHoc)}
              sub={bill.ad_hoc_comment?.trim() ? bill.ad_hoc_comment.trim() : undefined}
            />
            <BreakdownTile
              icon="counter"
              label="Prev meter"
              value={String(prev)}
              sub={prevLabel}
            />
            <BreakdownTile
              icon="counter"
              label="Curr meter"
              value={String(curr)}
              sub={currLabel}
            />
          </View>

          <View style={styles.notesSection}>
            {!!bill.paid_amount_comment?.trim() && (
              <View style={styles.commentBox}>
                <View style={styles.commentHeader}>
                  <Icon source="note-text-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.commentHeaderText}>Payment notes</Text>
                </View>
                <Text style={styles.commentText}>{bill.paid_amount_comment.trim()}</Text>
              </View>
            )}
          </View>
        </View>
      </Surface>
        </ScrollView>

        <Portal>
          <KeyboardAvoidingView
            style={styles.dialogKav}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <Dialog
              visible={paymentDialogOpen}
              onDismiss={() => setPaymentDialogOpen(false)}
              style={[styles.payDialog, { maxHeight: dialogMaxHeight }]}
            >
              <View style={styles.payDialogHeader}>
                <View style={styles.payDialogHeaderRow}>
                  <Surface
                    style={[
                      styles.payDialogIconWrap,
                      { backgroundColor: theme.colors.primaryContainer },
                    ]}
                    elevation={0}
                  >
                    <Icon source="cash-plus" size={22} color={theme.colors.primary} />
                  </Surface>

                  <View style={{ flex: 1 }}>
                    <Text variant="titleMedium" style={styles.payDialogTitle}>
                      Record payment
                    </Text>
                    <Text style={styles.payDialogSub} numberOfLines={1}>
                      {tenantName} • {roomName}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusTone.bg, borderColor: statusTone.border },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: statusTone.text }]}>{status}</Text>
                  </View>
                </View>
              </View>

              <Dialog.ScrollArea style={{ maxHeight: dialogScrollMaxHeight }}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.dialogContent}
                >
              <TextInput
                label="Amount received"
                mode="outlined"
                keyboardType="number-pad"
                value={paymentAmount}
                onChangeText={(t) => setPaymentAmount(t.replace(/[^\d]/g, ''))}
                left={<TextInput.Icon icon="currency-inr" />}
                error={paymentAmount.trim().length > 0 && !isAmountValid}
              />
              <View style={styles.quickRow}>
                <Text style={styles.quickLabel}>Quick fill</Text>
                <View style={styles.quickChipsRow}>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => setPaymentAmount(String(Math.max(1, Math.round(pending * 0.25))))}
                    disabled={pending <= 0}
                  >
                    25%
                  </Button>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => setPaymentAmount(String(Math.max(1, Math.round(pending * 0.5))))}
                    disabled={pending <= 0}
                  >
                    50%
                  </Button>
                  <Button
                    mode="contained-tonal"
                    compact
                    onPress={() => setPaymentAmount(String(pending))}
                    disabled={pending <= 0}
                  >
                    Full {formatMoney(pending)}
                  </Button>
                </View>
              </View>

              <View style={styles.methodBlock}>
                <Text style={styles.methodLabel}>Method</Text>
                <View style={styles.methodRow}>
                  {([
                    { id: 'CASH', icon: 'cash' },
                    { id: 'UPI', icon: 'qrcode-scan' },
                    { id: 'BANK', icon: 'bank-outline' },
                  ] as const).map((m) => {
                    const selected = paymentMethod === (m.id as any);
                    return (
                      <TouchableRipple
                        key={m.id}
                        onPress={() => setPaymentMethod(m.id as any)}
                        borderless
                        style={[
                          styles.methodChip,
                          {
                            backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surface,
                            borderColor: selected
                              ? theme.colors.primary
                              : ((theme.colors as any).outlineVariant ?? theme.colors.outline),
                          },
                        ]}
                      >
                        <View style={styles.methodChipInner}>
                          <Icon source={m.icon} size={16} color={selected ? theme.colors.primary : '#6B7280'} />
                          <Text
                            style={[
                              styles.methodChipText,
                              { color: selected ? theme.colors.primary : '#6B7280' },
                            ]}
                            numberOfLines={1}
                          >
                            {m.id}
                          </Text>
                        </View>
                      </TouchableRipple>
                    );
                  })}
                </View>
              </View>

              <TextInput
                label="Note (will be saved in bill notes)"
                mode="outlined"
                value={paymentNote}
                onChangeText={setPaymentNote}
                left={<TextInput.Icon icon="note-text-outline" />}
                multiline
                style={{ marginTop: 10 }}
              />

              <Surface
                style={[
                  styles.previewBox,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: (theme.colors as any).outlineVariant ?? theme.colors.outline,
                  },
                ]}
                elevation={0}
              >
                <View style={styles.previewHeaderRow}>
                  <Text style={styles.previewHeaderText}>Payment Summary</Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: nextStatusTone.bg, borderColor: nextStatusTone.border },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: nextStatusTone.text }]}>{nextStatus}</Text>
                  </View>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Paid</Text>
                  <Text style={styles.previewValue}>{formatMoney(nextPaid)}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Pending</Text>
                  <Text style={styles.previewValue}>{formatMoney(nextPending)}</Text>
                </View>
                <ProgressBar progress={nextProgress} color={theme.colors.primary} style={styles.previewProgress} />
                {!isAmountValid && paymentAmount.trim().length > 0 && (
                  <Text style={{ marginTop: 8, color: theme.colors.error, fontWeight: '700' }}>
                    Enter an amount between 1 and {Math.round(pending)}.
                  </Text>
                )}
              </Surface>
                </ScrollView>
              </Dialog.ScrollArea>

              <Dialog.Actions style={styles.dialogActions}>
                <Button onPress={() => setPaymentDialogOpen(false)} disabled={paymentSaving}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={savePayment} loading={paymentSaving} disabled={!isAmountValid}>
                  Save
                </Button>
              </Dialog.Actions>
            </Dialog>
          </KeyboardAvoidingView>
        </Portal>
      </PaperProvider>
    </>
  );
}

const BreakdownTile = ({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) => (
  <Surface style={styles.tile} elevation={0}>
    <View style={styles.tileInner}>
      <View style={styles.tileTop}>
        <Icon source={icon} size={20} color="#1A73E8" />
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={[styles.tileSub, !sub && styles.tileSubPlaceholder]}
        numberOfLines={1}
      >
        {sub || ' '}
      </Text>
    </View>
  </Surface>
);

const MetaPill = ({
  icon,
  label,
  color = '#1A73E8',
  backgroundColor = '#EEF2FF',
  borderColor = '#1A73E8',
}: {
  icon: string;
  label: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}) => (
  <Surface style={[styles.metaPill, { backgroundColor, borderColor }]} elevation={0}>
    <Icon source={icon} size={16} color={color} />
    <Text style={[styles.metaPillText, { color }]} numberOfLines={1}>
      {label}
    </Text>
  </Surface>
);

const PaymentStat = ({
  icon,
  label,
  amount,
  color,
}: {
  icon: string;
  label: string;
  amount: string;
  color: string;
}) => (
  <View style={styles.paymentStat}>
    <View style={styles.paymentStatTop}>
      <Icon source={icon} size={16} color={color} />
      <Text style={styles.paymentStatLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
    <Text
      style={[styles.paymentStatAmount, { color }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
    >
      {amount}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingBottom: 24, backgroundColor: '#F4F6FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  hero: {
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  heroEditBtn: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    margin: 0,
    borderWidth: 1,
    zIndex: 10,
    elevation: 10,
  },
  heroPhotoWrap: {
    width: 76,
    height: 76,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroKicker: {
    color: '#6B7280',
    fontWeight: '900',
    letterSpacing: 1.2,
    fontSize: 13,
    flex: 1,
  },
  heroMonthPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  heroMonthPillText: {
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.6,
  },
  heroTenant: {
    fontWeight: '900',
    marginTop: 6,
    color: '#111827',
  },
  heroRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  heroRoom: {
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  heroMetaText: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },

  billCard: {
    borderRadius: 18,
    padding: 0,
  },
  billCardClip: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  billTop: {
    padding: 14,
  },
  billTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  billTopLabel: {
    color: '#444',
    fontWeight: '800',
  },
  billTopValue: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: '900',
    color: '#111827',
  },
  billTopSub: {
    marginTop: 6,
    color: '#666',
    fontSize: 14,
    fontWeight: '700',
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillText: {
    fontWeight: '900',
    fontSize: 14,
  },

  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 14,
    paddingTop: 12,
  },
  tile: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    minHeight: 92,
  },
  tileInner: {
    flex: 1,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileLabel: { color: '#666', fontWeight: '800', flex: 1 },
  tileValue: {
    marginTop: 10,
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  tileSub: {
    marginTop: 4,
    color: '#777',
    fontSize: 13,
    fontWeight: '700',
  },
  tileSubPlaceholder: {
    opacity: 0,
  },

  notesSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  statusCol: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    flexWrap: 'wrap',
  },
  recordChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  recordChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordChipText: {
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.2,
  },

  paymentStrip: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
  },
  paymentStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  paymentStripDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    borderRadius: 1,
  },
  paymentStat: { flex: 1 },
  paymentStatTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  paymentStatLabel: { color: '#6B7280', fontWeight: '800', fontSize: 13 },
  paymentStatAmount: { marginTop: 6, fontWeight: '900', fontSize: 18, fontVariant: ['tabular-nums'] },
  paymentProgress: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
  },
  previewBox: {
    marginTop: 10,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  previewHeaderText: {
    fontWeight: '900',
    color: '#111827',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  previewLabel: { color: '#6B7280', fontWeight: '800' },
  previewValue: { color: '#111827', fontWeight: '900' },
  previewProgress: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
  },

  payDialog: {
    borderRadius: 18,
  },
  dialogKav: {
    flex: 1,
    justifyContent: 'center',
  },
  payDialogHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 2,
  },
  payDialogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payDialogIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDialogTitle: {
    fontWeight: '900',
    color: '#111827',
  },
  payDialogSub: {
    marginTop: 2,
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 14,
  },

  quickRow: {
    marginTop: 10,
  },
  quickLabel: {
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },

  methodBlock: {
    marginTop: 12,
  },
  methodLabel: {
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  methodChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  methodChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodChipText: { fontWeight: '900', fontSize: 14, letterSpacing: 0.2 },
  dialogContent: { paddingBottom: 6 },
  dialogActions: { paddingTop: 6 },

  commentBox: {
    marginTop: 12,
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#F6F8FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D6DEFF',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  commentHeaderText: {
    fontWeight: '900',
    color: '#111827',
  },
  commentText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
  },
  metaPillText: { fontWeight: '800', fontSize: 14, flex: 1 },
});

