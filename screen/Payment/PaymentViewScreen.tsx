import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import React from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Keyboard,
  NativeModules,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Share from 'react-native-share';
import RNBlobUtil from 'react-native-blob-util';
import {
  ActivityIndicator,
  Avatar,
  Button,
  FAB,
  Icon,
  IconButton,
  Modal,
  ProgressBar,
  Portal,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import ViewShot from 'react-native-view-shot';
import {
  deleteBill,
  fetchBillById,
  fetchLatestSetting,
  type BillRecord,
  updateBillPayment,
} from '../../service/BillService';
import { fetchRooms } from '../../service/RoomService';
import { fetchTenants } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';
import { FormInput } from '../../components/FormInput';
import { trackEvent } from '../../service/analyticsTracker';

const PDFModule =
  NativeModules?.HtmlToPdf ||
  NativeModules?.RNHTMLtoPDF ||
  NativeModules?.RNHTMLtoPdf;

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
  const prevMonth = new Date(
    billDate.getFullYear(),
    billDate.getMonth() - 1,
    1,
  );

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

function appendPaymentComment(
  existing: string | null | undefined,
  line: string,
) {
  const base = (existing || '').trim();
  return base.length ? `${base}\n${line}` : line;
}

function splitLeadingBracketDate(line: string): { date: string; rest: string } {
  const s = String(line ?? '');
  if (!s.startsWith('[')) return { date: '', rest: s };
  const idx = s.indexOf(']');
  if (idx === -1) return { date: '', rest: s };
  const date = s.slice(0, idx + 1);
  const rest = s.slice(idx + 1).trimStart();
  return { date, rest };
}

function toFileUrl(u: string) {
  const s = String(u ?? '').trim();
  if (!s) return '';
  // If it already has a scheme (file://, content://, http://, etc) keep it.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) return s;
  return `file://${s}`;
}

function stripFileScheme(u: string) {
  const s = String(u ?? '').trim();
  return s.startsWith('file://') ? s.slice('file://'.length) : s;
}

function getExtFromPath(p: string) {
  const cleaned = String(p || '').split('?')[0].split('#')[0];
  const dot = cleaned.lastIndexOf('.');
  if (dot === -1) return '';
  const ext = cleaned.substring(dot + 1).toLowerCase();
  return ext.length <= 8 ? ext : '';
}

function getMimeFromExt(ext: string) {
  const e = (ext || '').toLowerCase();
  if (e === 'pdf') return 'application/pdf';
  if (e === 'png') return 'image/png';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  if (e === 'webp') return 'image/webp';
  if (e === 'heic' || e === 'heif') return 'image/heic';
  return 'application/octet-stream';
}

function safeFileToken(input: string, fallback: string) {
  const raw = String(input || '').trim();
  const token = (raw || fallback)
    .replace(/[^a-zA-Z0-9]+/g, '-') // spaces + symbols → "-"
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return token.length ? token : fallback;
}

export default function PaymentViewScreen() {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const billId: number | undefined = route.params?.billId;
  const openRecordPayment: boolean | undefined =
    route.params?.openRecordPayment;
  const autoOpenedRef = React.useRef(false);

  const [loading, setLoading] = React.useState(true);
  const [bill, setBill] = React.useState<BillRecord | null>(null);
  const [tenantName, setTenantName] = React.useState('-');
  const [roomName, setRoomName] = React.useState('-');
  const [tenantPhotoUrl, setTenantPhotoUrl] = React.useState<
    string | undefined
  >(undefined);
  const [settings, setSettings] = React.useState<{
    electricity_unit: number;
    property_name?: string;
    property_address?: string;
  }>({ electricity_unit: 0 });

  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentSaving, setPaymentSaving] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<
    'CASH' | 'UPI' | 'BANK'
  >('CASH');
  const [paymentNote, setPaymentNote] = React.useState('');
  const [billDeleting, setBillDeleting] = React.useState(false);
  const shareShotRef = React.useRef<ViewShot>(null);
  // Share-image pagination rules:
  // - Page 1: show 5 note lines (avoid making the main receipt too tall)
  // - Page 2+: show 10 note lines per page (notes-only continuation pages)
  const FIRST_PAGE_NOTES_LINES = 3;
  const CONTINUATION_PAGE_NOTES_LINES = 10;
  const [shareNotesPageIndex, setShareNotesPageIndex] = React.useState(0);

  const allPaymentNoteLines = React.useMemo(() => {
    const raw = bill?.paid_amount_comment?.trim();
    if (!raw) return [] as string[];
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }, [bill?.paid_amount_comment]);

  const shareNotesPageCount = React.useMemo(() => {
    const n = allPaymentNoteLines.length;
    if (n === 0) return 1;
    if (n <= FIRST_PAGE_NOTES_LINES) return 1;
    return 1 + Math.ceil((n - FIRST_PAGE_NOTES_LINES) / CONTINUATION_PAGE_NOTES_LINES);
  }, [allPaymentNoteLines.length, FIRST_PAGE_NOTES_LINES, CONTINUATION_PAGE_NOTES_LINES]);

  const visiblePaymentNoteLinesForShare = React.useMemo(() => {
    if (allPaymentNoteLines.length === 0) return [] as string[];
    if (shareNotesPageCount <= 1) {
      return allPaymentNoteLines.slice(0, FIRST_PAGE_NOTES_LINES);
    }
    if (shareNotesPageIndex === 0) {
      return allPaymentNoteLines.slice(0, FIRST_PAGE_NOTES_LINES);
    }
    const start =
      FIRST_PAGE_NOTES_LINES +
      (shareNotesPageIndex - 1) * CONTINUATION_PAGE_NOTES_LINES;
    return allPaymentNoteLines.slice(start, start + CONTINUATION_PAGE_NOTES_LINES);
  }, [
    allPaymentNoteLines,
    shareNotesPageCount,
    shareNotesPageIndex,
    FIRST_PAGE_NOTES_LINES,
    CONTINUATION_PAGE_NOTES_LINES,
  ]);

  // Pad to a fixed number of lines so each captured page has identical height.
  const paddedPaymentNoteLinesForShare = React.useMemo(() => {
    const lines = visiblePaymentNoteLinesForShare.slice();
    // IMPORTANT:
    // - Page 1 should be compact (no extra white space below notes).
    // - Page 2+ can be padded to a fixed height for consistent sharing.
    const isContinuation = shareNotesPageCount > 1 && shareNotesPageIndex > 0;
    if (!isContinuation) return lines;
    while (lines.length < CONTINUATION_PAGE_NOTES_LINES) lines.push('');
    return lines;
  }, [
    visiblePaymentNoteLinesForShare,
    shareNotesPageCount,
    shareNotesPageIndex,
    CONTINUATION_PAGE_NOTES_LINES,
  ]);

  const isShareNotesContinuationPage = shareNotesPageCount > 1 && shareNotesPageIndex > 0;

  const waitForNextPaint = React.useCallback(
    () =>
      new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
    [],
  );
  const [dialogKeyboardHeight, setDialogKeyboardHeight] = React.useState(0);

  const dialogMaxHeight = React.useMemo(
    () => Math.round(Dimensions.get('window').height * 0.88),
    [],
  );
  const dialogScrollMaxHeight = React.useMemo(
    () => Math.round(Dimensions.get('window').height * 0.52),
    [],
  );

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent as any, e => {
      setDialogKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvent as any, () => {
      setDialogKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const effectiveDialogScrollMaxHeight = React.useMemo(() => {
    // Give the scroll area some room to breathe when keyboard is open,
    // and ensure it never collapses too small to use.
    const reduced = dialogScrollMaxHeight - Math.round(dialogKeyboardHeight * 0.55);
    return Math.max(220, reduced);
  }, [dialogScrollMaxHeight, dialogKeyboardHeight]);

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
      setSettings({
        electricity_unit: s.electricity_unit || 0,
        property_name: s.property_name,
        property_address: s.property_address,
      });

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
    Keyboard.dismiss();
    setPaymentAmount('');
    setPaymentMethod('CASH');
    setPaymentNote('');
    setPaymentDialogOpen(true);
    trackEvent('Payment_RecordPayment_Opened', {
      source: 'Payment',
      bill_id: bill?.id,
    });
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
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.emptyWrap}>
        <Avatar.Icon
          size={56}
          icon="file-document-outline"
          style={{ backgroundColor: theme.colors.primaryContainer }}
          color={theme.colors.primary}
        />
        <Text
          variant="titleMedium"
          style={{ fontWeight: '800', marginTop: 12 }}
        >
          Bill not found
        </Text>
        <Text style={{ color: '#666', marginTop: 4 }}>
          This bill may have been deleted or you don’t have access.
        </Text>
      </View>
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
  const rate =
    units > 0 ? twoDp(electricity / units) : settings.electricity_unit || 0;
  const propertyName = settings.property_name || 'Property';
  const propertyAddress = settings.property_address || '';
  const billMonthShort = formatMonthYear(bill.billing_month ?? bill.created_at);

  const { prevLabel, currLabel } = getPrevAndCurrMonthLabels(
    bill.billing_month ?? bill.created_at,
  );
  const billMonth = formatMonthYear(bill.created_at);

  const canEditBill = paid <= 0;
  const canRecordPayment = pending > 0;

  const amountNum = paymentAmount.trim().length ? Number(paymentAmount) : 0;
  const isAmountValid =
    Number.isFinite(amountNum) && amountNum > 0 && amountNum <= pending;
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
  const nextProgress =
    total > 0 ? Math.min(1, Math.max(0, nextPaid / total)) : 0;

  const savePayment = async () => {
    if (paymentSaving) return;
    if (!isAmountValid) return;

    try {
      setPaymentSaving(true);

      const now = new Date();
      const note = paymentNote.trim();
      const line = `[${formatDateTime(
        now,
      )}] ${paymentMethod} received ${formatMoney(amountNum)}${
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

  const buildShareHtml = () => {
    const propName = settings.property_name || 'Property';
    const propAddr = settings.property_address || '';
    const monthShort = formatMonthYear(bill.billing_month ?? bill.created_at);
    const tName = tenantName || 'Tenant';
    const rName = roomName || 'Room';
    const paidAmt = bill.paid_amount || 0;
    const billStatus =
      paidAmt >= total ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'UNPAID';
    const issueDate = formatDate(bill.created_at);
    const prevRead = String(prev);
    const currRead = String(curr);
    const adHocNote = bill.ad_hoc_comment?.trim();
    const payNotes = bill.paid_amount_comment?.trim();
    const noteLines = payNotes
      ? payNotes.split('\n').filter(line => line.trim().length > 0)
      : [];
    const electricityLabel = `Electricity (${units} × ${rate})`;
    const contentWeight =
      noteLines.length +
      (adHocNote ? 1 : 0) +
      (propAddr ? 1 : 0) +
      (tName.length > 22 ? 1 : 0) +
      (rName.length > 22 ? 1 : 0) +
      (electricityLabel.length > 24 ? 1 : 0);
    const compact =
      noteLines.length >= 9
        ? 0.72
        : noteLines.length >= 7
        ? 0.78
        : noteLines.length >= 5
        ? 0.84
        : contentWeight >= 6
        ? 0.88
        : contentWeight >= 4
        ? 0.94
        : 1;
    const lineHeight = Math.max(1.1, 1.3 * compact);
    const notesMaxHeight =
      noteLines.length >= 9
        ? Math.round(90 * compact)
        : noteLines.length >= 7
        ? Math.round(110 * compact)
        : Math.round(140 * compact);
    const basePad = Math.round(40 * compact);
    const innerPad = Math.round(20 * compact);
    const headerGap = Math.round(15 * compact);
    const gridGap = Math.round(15 * compact);
    const dividerGap = Math.round(12 * compact);
    const sectionGap = Math.round(10 * compact);
    const tablePad = Math.round(8 * compact);
    const totalGap = Math.round(15 * compact);
    const footerGap = Math.round(20 * compact);
    const textScale = 1.4 * compact;
    const fontBrand = Math.round(24 * textScale);
    const fontMeta = Math.round(14 * textScale);
    const fontLabel = Math.round(11 * textScale);
    const fontAmount = Math.round(14 * textScale);
    const fontTotal = Math.round(28 * textScale);
    const fontFooter = Math.round(11 * textScale);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            html, body {
              width: 210mm;
              height: 270mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            body { 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
              color: #111827; 
              background: #FFFFFF; 
              line-height: ${lineHeight};
              -webkit-print-color-adjust: exact;
            }
            .page-wrapper {
              width: 210mm;
              height: 270mm;
              padding: ${basePad}px; 
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              position: relative;
              page-break-before: avoid;
              page-break-after: avoid;
              page-break-inside: avoid;
              break-before: avoid;
              break-after: avoid;
              break-inside: avoid;
            }
            .content { 
              flex: 1;
              display: flex;
              flex-direction: column;
              padding: ${innerPad}px; 
              background: #FFFFFF;
              max-height: 100%;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              position: relative;
              z-index: 1;
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              border-bottom: 1px solid #E5E7EB; 
              padding-bottom: ${headerGap}px; 
              margin-bottom: ${headerGap}px; 
              flex-shrink: 0;
            }
            .brand { font-size: ${fontBrand}px; font-weight: 800; color: #111827; }
            .address { font-size: ${Math.round(
              13 * textScale,
            )}px; color: #6B7280; margin-top: 2px; font-weight: 600; }
            .status-pill { border: 1px solid #E5E7EB; border-radius: 999px; padding: ${Math.round(
              6 * compact,
            )}px ${Math.round(
      16 * compact,
    )}px; background: #F8FAFC; font-size: ${Math.round(
      14 * textScale,
    )}px; font-weight: 900; color: #111827; letter-spacing: 0.5px; }
            
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: ${gridGap}px; margin-bottom: ${gridGap}px; flex-shrink: 0; }
            .meta-item { display: flex; flex-direction: column; }
            .meta-label { font-size: ${fontLabel}px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px; }
            .meta-value { font-size: ${fontMeta}px; font-weight: 700; color: #111827; }
            
            .divider { height: 1px; background: #D1D5DB; margin: ${dividerGap}px 0; flex-shrink: 0; }
            
            .readings-row { display: grid; grid-template-columns: 1fr 1fr; gap: ${gridGap}px; margin-bottom: ${Math.round(
      10 * compact,
    )}px; flex-shrink: 0; }
            
            .section-title { font-size: ${Math.round(
              13 * textScale,
            )}px; font-weight: 800; color: #111827; margin: ${sectionGap}px 0 ${Math.round(
      8 * compact,
    )}px 0; flex-shrink: 0; }
            
            .table-container { flex: 0 0 auto; min-height: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: ${Math.round(
              10 * compact,
            )}px; }
            th { text-align: left; padding: ${tablePad}px ${Math.round(
      6 * compact,
    )}px; border-bottom: 1px solid #D1D5DB; color: #6B7280; font-size: ${Math.round(
      12 * textScale,
    )}px; font-weight: 700; }
            td { padding: ${tablePad}px ${Math.round(
      6 * compact,
    )}px; font-size: ${Math.round(
      13 * textScale,
    )}px; color: #111827; border-bottom: 1px solid #D1D5DB; }
            .alt-row { background-color: #F8FAFC; }
            .amount-cell { text-align: right; font-family: monospace; font-size: ${fontAmount}px; }
            
            .total-section { display: flex; justify-content: space-between; align-items: flex-start; margin-top: ${totalGap}px; flex-shrink: 0; }
            .ad-hoc-note { font-size: ${Math.round(
              11 * textScale,
            )}px; color: #6B7280; font-weight: 600; max-width: 60%; }
            .total-box { text-align: right; }
            .total-label { font-size: ${Math.round(
              13 * textScale,
            )}px; font-weight: 700; color: #6B7280; }
            .total-value { font-size: ${fontTotal}px; font-weight: 900; color: #111827; margin-top: 2px; }
            
            .summary-row { display: flex; justify-content: flex-end; gap: ${Math.round(
              30 * compact,
            )}px; margin-top: ${Math.round(8 * compact)}px; flex-shrink: 0; }
            
            .notes-block { margin-top: ${Math.round(
              15 * compact,
            )}px; padding-top: ${Math.round(
      10 * compact,
    )}px; border-top: 1px solid #E5E7EB; flex-shrink: 0; overflow: hidden; }
            .note-line { font-size: ${Math.round(
              13 * textScale,
            )}px; color: #374151; font-weight: 600; margin-top: ${Math.round(
      4 * compact,
    )}px; }
            
            .footer { margin-top: ${Math.round(
              12 * compact,
            )}px; padding-top: ${footerGap}px; text-align: center; font-size: ${fontFooter}px; color: #6B7280; flex-shrink: 0; }
          </style>
        </head>
        <body>
          <div class="page-wrapper">
            <div class="content">
              <div class="header">
                <div>
                  <div class="brand">${propName}</div>
                  ${propAddr ? `<div class="address">${propAddr}</div>` : ''}
                </div>
                <div class="status-pill">${monthShort}</div>
              </div>

              <div class="meta-grid">
                <div class="meta-item">
                  <div class="meta-label">Billed to</div>
                  <div class="meta-value">${tName}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Property / Room</div>
                  <div class="meta-value">${rName}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Payment status</div>
                  <div class="meta-value">${billStatus}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Issue date</div>
                  <div class="meta-value">${issueDate}</div>
                </div>
              </div>

              <div class="readings-row">
                <div class="meta-item">
                  <div class="meta-label">Prev reading</div>
                  <div class="meta-value">${prevRead}</div>
                </div>
                <div class="meta-item">
                  <div class="meta-label">Curr reading</div>
                  <div class="meta-value">${currRead}</div>
                </div>
              </div>
              <div class="divider"></div>

              <div class="section-title">Charges</div>
              <div class="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style="text-align:right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="alt-row">
                      <td>Rent</td>
                      <td class="amount-cell">${formatMoney(bill.rent)}</td>
                    </tr>
                    <tr>
                      <td>Water</td>
                      <td class="amount-cell">${formatMoney(bill.water)}</td>
                    </tr>
                    <tr class="alt-row">
                      <td>${electricityLabel}</td>
                      <td class="amount-cell">${formatMoney(
                        bill.electricity,
                      )}</td>
                    </tr>
                    <tr>
                      <td>Ad hoc</td>
                      <td class="amount-cell">${formatMoney(
                        bill.ad_hoc_amount,
                      )}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="total-section">
                <div class="ad-hoc-note">
                  ${adHocNote ? `Ad-hoc note: ${adHocNote}` : ''}
                </div>
                <div class="total-box">
                  <div class="total-label">Total payable</div>
                  <div class="total-value">${formatMoney(total)}</div>
                </div>
              </div>

              <div class="summary-row">
                <div class="meta-item" style="text-align:right">
                  <div class="meta-label">Paid</div>
                  <div class="meta-value">${formatMoney(paid)}</div>
                </div>
                <div class="meta-item" style="text-align:right">
                  <div class="meta-label">Pending</div>
                  <div class="meta-value">${formatMoney(pending)}</div>
                </div>
              </div>

              ${
                payNotes
                  ? `
                <div class="notes-block">
                  <div class="section-title">Payment notes</div>
                  ${payNotes
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => `<div class="note-line">${l}</div>`)
                    .join('')}
                </div>
              `
                  : ''
              }

              <div class="footer">This is a system generated invoice.</div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const buildReceiptBaseName = () => {
    const dt = bill?.billing_month ?? bill?.created_at ?? undefined;
    const d = dt ? new Date(dt) : new Date();
    const month = d.toLocaleString('en-GB', { month: 'short' }); // e.g. "Jan"
    const year = String(d.getFullYear());
    const nameToken = safeFileToken(tenantName, 'receipt');
    const monthToken = safeFileToken(month, 'month');
    return `${nameToken}-${monthToken}-${year}`;
  };

  const sharePdf = async () => {
    if (!PDFModule?.convert) {
      throw new Error(
        'PDF module not available. Rebuild the app (pod install) and try again.',
      );
    }
    const baseName = buildReceiptBaseName();
    // IMPORTANT (Android): react-native-share’s FileProvider only exposes cache + Download.
    // If we generate into externalFilesDir("Documents"), Android share will open but attach nothing.
    // So: use default cache path on Android, keep Documents on iOS.
    const pdfOptions: any = {
      html: buildShareHtml(),
      fileName: baseName,
    };
    if (Platform.OS === 'ios') pdfOptions.directory = 'Documents';

    const file = await PDFModule.convert(pdfOptions);
    const raw = file?.filePath;
    if (!raw) throw new Error('Could not generate PDF file to share.');
    const rawPath = stripFileScheme(String(raw));
    const ext = getExtFromPath(rawPath) || 'pdf';
    const dir =
      rawPath.lastIndexOf('/') >= 0 ? rawPath.slice(0, rawPath.lastIndexOf('/')) : '';
    const desiredPath = dir ? `${dir}/${baseName}.${ext}` : rawPath;
    if (desiredPath && rawPath !== desiredPath) {
      try {
        await RNBlobUtil.fs.cp(rawPath, desiredPath);
      } catch {
        // If rename/copy fails, fall back to the generated file.
      }
    }
    const finalPath =
      desiredPath && (await RNBlobUtil.fs.exists(desiredPath))
        ? desiredPath
        : rawPath;
    const filePath = toFileUrl(finalPath);
    if (!filePath) throw new Error('Could not generate PDF file to share.');
    await Share.open({
      title: 'Payment Bill',
      message: `Payment bill for ${tenantName}`,
      urls: [filePath],
      type: getMimeFromExt(ext),
      failOnCancel: false,
    });
  };

  const shareImage = async () => {
    const baseName = buildReceiptBaseName();
    const totalNotes = allPaymentNoteLines.length;
    const pages =
      totalNotes === 0
        ? 1
        : totalNotes <= FIRST_PAGE_NOTES_LINES
          ? 1
          : 1 + Math.ceil((totalNotes - FIRST_PAGE_NOTES_LINES) / CONTINUATION_PAGE_NOTES_LINES);

    const urls: string[] = [];
    const ext = 'png';

    for (let p = 0; p < pages; p += 1) {
      if (pages > 1) {
        setShareNotesPageIndex(p);
        await waitForNextPaint();
        // Give layout a beat to apply before capture (prevents blank captures).
        await new Promise<void>(r => setTimeout(r, 30));
      }

      const uri = await shareShotRef.current?.capture?.();
      if (!uri) throw new Error('Could not generate image');
      const srcPath = stripFileScheme(uri);

      const destPath =
        pages > 1
          ? `${RNBlobUtil.fs.dirs.CacheDir}/${baseName}-p${p + 1}.${ext}`
          : `${RNBlobUtil.fs.dirs.CacheDir}/${baseName}.${ext}`;

      let finalPath = srcPath;
      try {
        if (await RNBlobUtil.fs.exists(destPath)) {
          try {
            await RNBlobUtil.fs.unlink(destPath);
          } catch {}
        }
        await RNBlobUtil.fs.cp(srcPath, destPath);
        if (await RNBlobUtil.fs.exists(destPath)) finalPath = destPath;
      } catch {
        // If copy fails, share original capture file.
      }

      const fileUrl = toFileUrl(finalPath);
      if (!fileUrl) throw new Error('Could not generate image');
      urls.push(fileUrl);
    }

    // Reset back to first page so future captures are deterministic.
    if (pages > 1) {
      setShareNotesPageIndex(0);
    }

    await Share.open({
      title: 'Payment Bill',
      message: `Payment bill for ${tenantName}`,
      urls,
      type: getMimeFromExt(ext),
      failOnCancel: false,
    });
  };

  const openShareSheet = () => {
    Alert.alert('Share Bill', 'Choose a format', [
      {
        text: 'Share PDF',
        onPress: () => {
          trackEvent('Payment_Share_Pdf', {
            source: 'Payment',
            bill_id: bill.id,
          });
          sharePdf().catch(e => Alert.alert('Share failed', e.message));
        },
      },
      {
        text: 'Share Image',
        onPress: () => {
          trackEvent('Payment_Share_Image', {
            source: 'Payment',
            bill_id: bill.id,
          });
          shareImage().catch(e => Alert.alert('Share failed', e.message));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const canDeleteBill = status === 'UNPAID' || status === 'PARTIAL';

  const doDeleteBill = async () => {
    if (billDeleting) return;
    try {
      setBillDeleting(true);
      await deleteBill(bill.id);
      // Return to list after deletion
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      } else {
        navigation.navigate('PaymentList');
      }
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Could not delete bill');
    } finally {
      setBillDeleting(false);
    }
  };

  const confirmDeleteBill = () => {
    if (!canDeleteBill) return;
    Alert.alert(
      'Delete Bill',
      'Are you sure you want to delete this bill? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            trackEvent('Payment_Delete_Bill', {
              source: 'Payment',
              bill_id: bill.id,
            });
            void doDeleteBill();
          },
        },
      ],
    );
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* HERO */}
        <Surface style={[styles.hero, { borderColor: outline }]} elevation={2}>
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
              <Image
                source={{ uri: tenantPhotoUrl }}
                style={styles.heroPhoto}
                resizeMode="cover"
              />
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
                  style={[
                    styles.heroMonthPillText,
                    { color: theme.colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {billMonthShort}
                </Text>
              </Surface>
            </View>

            <Text variant="headlineSmall" style={styles.heroTenant}>
              {tenantName}
            </Text>

            <View style={styles.heroRoomRow}>
              <Icon
                source="home-city-outline"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                variant="titleMedium"
                style={styles.heroRoom}
                numberOfLines={1}
              >
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
              onPress={() => {
                trackEvent('Navigation_PaymentView_To_PaymentEdit', {
                  source: 'Payment',
                  bill_id: bill.id,
                });
                navigation.navigate('PaymentForm', { billId: bill.id });
              }}
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

        <View style={styles.shareShotWrap}>
          <ViewShot
            ref={shareShotRef}
            options={{
              format: 'png',
              quality: 1,
              result: 'tmpfile',
                // NOTE: keeping this false avoids blank renders on some devices.
                // We rely on `collapsable={false}` below to keep the view in the native tree.
            }}
          >
            <View style={styles.shareCanvas} collapsable={false}>
              <View style={styles.shareCardFrame}>
                <View style={styles.shareCard}>
                  <View style={styles.shareHeaderRow}>
                    <View style={styles.shareHeaderLeft}>
                      <Text style={styles.shareBrand}>{propertyName}</Text>
                      {!!propertyAddress && (
                        <Text style={styles.shareMuted}>{propertyAddress}</Text>
                      )}
                    </View>
                    <View style={styles.shareStatusPill}>
                      <Text
                        style={styles.shareStatusText}
                        numberOfLines={1}
                        ellipsizeMode="clip"
                      >
                        {billMonthShort}
                      </Text>
                    </View>
                  </View>

                  {!isShareNotesContinuationPage ? (
                    <>
                      <View style={styles.shareMetaGrid}>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Billed to</Text>
                          <Text style={styles.shareMetaValue}>{tenantName}</Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Property / Room</Text>
                          <Text style={styles.shareMetaValue}>{roomName}</Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Payment status</Text>
                          <Text style={styles.shareMetaValue}>
                            {status || 'UNPAID'}
                          </Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Issue date</Text>
                          <Text style={styles.shareMetaValue}>
                            {formatDate(bill.created_at)}
                          </Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Prev reading</Text>
                          <Text style={styles.shareMetaValue}>{String(prev)}</Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Curr reading</Text>
                          <Text style={styles.shareMetaValue}>{String(curr)}</Text>
                        </View>
                      </View>
                      <View style={styles.shareDivider} />
                      <Text style={styles.shareSectionTitle}>Charges</Text>
                      <View style={styles.shareTableHeader}>
                        <Text
                          style={[
                            styles.shareDescCell,
                            styles.shareTableHeaderText,
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.shareAmountCell,
                            styles.shareTableHeaderText,
                          ]}
                        >
                          Amount
                        </Text>
                      </View>
                      <View style={[styles.shareTableRow, styles.shareAltRow]}>
                        <Text style={styles.shareDescCell}>Rent</Text>
                        <Text style={styles.shareAmountCell}>
                          {formatMoney(bill.rent)}
                        </Text>
                      </View>
                      <View style={styles.shareTableRow}>
                        <Text style={styles.shareDescCell}>Water</Text>
                        <Text style={styles.shareAmountCell}>
                          {formatMoney(bill.water)}
                        </Text>
                      </View>
                      <View style={[styles.shareTableRow, styles.shareAltRow]}>
                        <Text style={styles.shareDescCell}>
                          Electricity ({units} × {rate})
                        </Text>
                        <Text style={styles.shareAmountCell}>
                          {formatMoney(bill.electricity)}
                        </Text>
                      </View>
                      <View style={styles.shareTableRow}>
                        <Text style={styles.shareDescCell}>Ad hoc</Text>
                        <Text style={styles.shareAmountCell}>
                          {formatMoney(bill.ad_hoc_amount)}
                        </Text>
                      </View>
                      <View style={styles.shareTotalRow}>
                        <View style={styles.shareTotalLeft}>
                          {!!bill.ad_hoc_comment?.trim() && (
                            <Text style={styles.shareNote}>
                              Ad-hoc note: {bill.ad_hoc_comment.trim()}
                            </Text>
                          )}
                        </View>
                        <View>
                          <Text style={styles.shareTotalLabel}>Total payable</Text>
                          <Text style={styles.shareTotalValue}>
                            {formatMoney(total)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.shareDivider} />

                      <View style={styles.shareMetaGrid}>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Paid</Text>
                          <Text style={styles.shareMetaValue}>
                            {formatMoney(paid)}
                          </Text>
                        </View>
                        <View style={styles.shareMetaItem}>
                          <Text style={styles.shareMetaLabel}>Pending</Text>
                          <Text style={styles.shareMetaValue}>
                            {formatMoney(pending)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.shareDivider} />
                    </>
                  ) : (
                    <View style={styles.shareContinuedIntro}>
                      <Text style={styles.shareContinuedKicker}>
                        PAYMENT NOTES — CONTINUED
                      </Text>
                      <Text style={styles.shareContinuedTitle} numberOfLines={1}>
                        {tenantName}
                      </Text>
                      <Text style={styles.shareContinuedSub} numberOfLines={1}>
                        {roomName} • {billMonthShort}
                      </Text>
                      <View style={styles.shareDivider} />
                    </View>
                  )}
                  {!!bill.paid_amount_comment?.trim() && (
                    <View style={styles.shareNotesBlock}>
                      <View style={styles.shareNotesHeaderRow}>
                        <Text style={styles.shareSectionTitle}>
                          {isShareNotesContinuationPage
                            ? 'Notes continued'
                            : 'Payment notes'}
                        </Text>
                        {shareNotesPageCount > 1 ? (
                          <Text style={styles.shareNotesPageText}>
                            Page {shareNotesPageIndex + 1}/{shareNotesPageCount}
                          </Text>
                        ) : null}
                      </View>
                      {paddedPaymentNoteLinesForShare.map((line, idx) => (
                        <Text
                          key={`${shareNotesPageIndex}-${idx}`}
                          style={[
                            styles.shareNoteLine,
                            idx === 0 ? styles.shareNoteLineFirst : null,
                            isShareNotesContinuationPage
                              ? styles.shareNoteLineContinued
                              : null,
                            !line ? styles.shareNoteLinePlaceholder : null,
                          ]}
                        >
                          {(() => {
                            const raw = line || '';
                            if (!raw.trim()) return ' ';
                            const { date, rest } = splitLeadingBracketDate(raw);
                            if (!date) return raw;
                            return (
                              <>
                                <Text style={styles.shareNoteDate}>{date}</Text>
                                <Text>{rest ? ` ${rest}` : ''}</Text>
                              </>
                            );
                          })()}
                        </Text>
                      ))}
                      <View style={styles.shareDivider} />
                    </View>
                  )}
                  <Text style={styles.shareFooter}>
                    This is a system generated invoice.
                  </Text>
                </View>
              </View>
            </View>
          </ViewShot>
        </View>

        {/* BILL PREVIEW (no-scroll layout) */}
        <Surface
          style={[styles.billCard, { borderColor: outline }]}
          elevation={2}
        >
          <View style={styles.billCardClip}>
            <Surface
              style={[
                styles.billTop,
                // Align with RoomView: keep surfaces mostly white, use primaryContainer
                // only for small accents (not a full-width block).
                { backgroundColor: theme.colors.surface },
              ]}
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
                      styles.billStatusPill,
                      {
                        backgroundColor: statusTone.bg,
                        borderColor: statusTone.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: statusTone.text },
                      ]}
                      numberOfLines={1}
                    >
                      {status}
                    </Text>
                  </View>

                  <TouchableRipple
                    onPress={openPaymentDialog}
                    disabled={!canRecordPayment}
                    borderless
                    style={[
                      styles.recordChip,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: canRecordPayment
                          ? theme.colors.primary
                          : theme.colors.outline,
                        opacity: canRecordPayment ? 1 : 0.6,
                      },
                    ]}
                  >
                    <View style={styles.recordChipInner}>
                      <Icon
                        source="cash-plus"
                        size={16}
                        color={
                          canRecordPayment
                            ? theme.colors.primary
                            : theme.colors.outline
                        }
                      />
                      <Text
                        style={[
                          styles.recordChipText,
                          {
                            color: canRecordPayment
                              ? theme.colors.primary
                              : theme.colors.outline,
                          },
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
                    borderColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
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
                          (theme.colors as any).outlineVariant ??
                          theme.colors.outline,
                      },
                    ]}
                  />
                  <PaymentStat
                    icon="clock-outline"
                    label="Pending"
                    amount={formatMoney(pending)}
                    color={
                      pending > 0 ? theme.colors.error : theme.colors.primary
                    }
                  />
                </View>
                <ProgressBar
                  progress={paidProgress}
                  color={
                    pending > 0 ? theme.colors.primary : theme.colors.primary
                  }
                  style={styles.paymentProgress}
                />
              </Surface>
            </Surface>

            <Text style={styles.breakdownTitle}>Rent Summary</Text>

            {/* Charges & meters (RoomView-style: flat rows + dividers, no tiny tiles) */}
            <Surface
              style={[
                styles.breakdownList,
                {
                  borderColor:
                    (theme.colors as any).outlineVariant ??
                    theme.colors.outline,
                  backgroundColor: theme.colors.surface,
                },
              ]}
              elevation={0}
            >
              <BreakdownRow
                icon="home-city-outline"
                label="Rent"
                value={formatMoney(rent)}
              />
              <View
                style={[
                  styles.breakdownDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <BreakdownRow
                icon="water-outline"
                label="Water"
                value={formatMoney(water)}
              />
              <View
                style={[
                  styles.breakdownDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <BreakdownRow
                icon="flash-outline"
                label="Electricity"
                sub={`${units} × ${rate}`}
                value={formatMoney(electricity)}
              />
              <View
                style={[
                  styles.breakdownDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <BreakdownRow
                icon="cash-plus"
                label="Ad-hoc"
                sub={
                  bill.ad_hoc_comment?.trim()
                    ? bill.ad_hoc_comment.trim()
                    : undefined
                }
                value={formatMoney(adHoc)}
              />
              <View
                style={[
                  styles.breakdownDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <BreakdownRow
                icon="counter"
                label="Prev meter"
                sub={prevLabel}
                value={String(prev)}
              />
              <View
                style={[
                  styles.breakdownDivider,
                  {
                    backgroundColor:
                      (theme.colors as any).outlineVariant ??
                      theme.colors.outline,
                  },
                ]}
              />
              <BreakdownRow
                icon="counter"
                label="Curr meter"
                sub={currLabel}
                value={String(curr)}
              />
            </Surface>

            <View style={styles.notesSection}>
              {!!bill.paid_amount_comment?.trim() && (
                <View style={styles.commentBox}>
                  <View style={styles.commentHeader}>
                    <Icon
                      source="note-text-outline"
                      size={16}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.commentHeaderText}>Payment notes</Text>
                  </View>
                  <View>
                    {bill.paid_amount_comment
                      .trim()
                      .split('\n')
                      .map(l => l.trim())
                      .filter(l => l.length > 0)
                      .map((line, idx) => (
                        <Text
                          key={String(idx)}
                          style={[
                            styles.commentText,
                            idx === 0 ? styles.commentTextFirst : styles.commentTextGap,
                          ]}
                        >
                          {(() => {
                            const { date, rest } = splitLeadingBracketDate(line);
                            if (!date) return line;
                            return (
                              <>
                                <Text style={styles.commentDate}>{date}</Text>
                                <Text>{rest ? ` ${rest}` : ''}</Text>
                              </>
                            );
                          })()}
                        </Text>
                      ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </Surface>
      </ScrollView>

      <FAB icon="share-variant" style={styles.fab} onPress={openShareSheet} />

      {canDeleteBill ? (
        <FAB
          icon="trash-can-outline"
          style={[
            styles.deleteFab,
            { backgroundColor: theme.colors.errorContainer },
          ]}
          color={theme.colors.error}
          onPress={confirmDeleteBill}
          loading={billDeleting}
          disabled={billDeleting}
        />
      ) : null}

      <Portal>
        <Modal
          visible={paymentDialogOpen}
          onDismiss={() => setPaymentDialogOpen(false)}
          contentContainerStyle={[
            styles.payModalContainer,
            dialogKeyboardHeight > 0
              ? styles.payModalContainerKeyboardOpen
              : styles.payModalContainerKeyboardClosed,
          ]}
        >
          <Surface
            style={[
              styles.payDialog,
              {
                maxHeight: dialogMaxHeight,
                borderColor: outline,
                borderWidth: 1,
              },
            ]}
            elevation={2}
          >
            <View
              style={[styles.payDialogHeader, { borderBottomColor: outline }]}
            >
              <View style={styles.payDialogHeaderRow}>
                <View
                  style={[
                    styles.payDialogIconWrap,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="cash-plus"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>

                <View style={styles.payDialogTextCol}>
                  <View style={styles.payDialogTitleRow}>
                    <Text style={styles.payDialogTitle} numberOfLines={1}>
                      Record payment
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        styles.payDialogStatusPill,
                        {
                          backgroundColor: statusTone.bg,
                          borderColor: statusTone.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          styles.payDialogStatusPillText,
                          { color: statusTone.text },
                        ]}
                        numberOfLines={1}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.payDialogSub} numberOfLines={1}>
                    {tenantName} • {roomName}
                  </Text>
                </View>

                <IconButton
                  icon="close"
                  onPress={() => setPaymentDialogOpen(false)}
                  disabled={paymentSaving}
                  accessibilityLabel="Close"
                  style={styles.payDialogCloseBtn}
                />
              </View>
            </View>

            <View
              style={[
                styles.payDialogTopActions,
                { borderBottomColor: outline },
              ]}
            >
              <Button
                mode="outlined"
                onPress={() => setPaymentDialogOpen(false)}
                disabled={paymentSaving}
                style={styles.topActionBtn}
                contentStyle={styles.topActionBtnContent}
                labelStyle={styles.topActionBtnLabel}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={savePayment}
                loading={paymentSaving}
                disabled={!isAmountValid || paymentSaving}
                style={styles.topActionBtn}
                contentStyle={styles.topActionBtnContent}
                labelStyle={styles.topActionBtnLabel}
              >
                Save
              </Button>
            </View>

            <View
              style={[
                styles.payDialogScrollArea,
                { maxHeight: effectiveDialogScrollMaxHeight },
              ]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.dialogContent,
                  {
                    // Critical: allow scrolling the last field (Note) above the keyboard.
                    paddingBottom: 12 + Math.max(0, dialogKeyboardHeight),
                  },
                ]}
              >
                <FormInput
                  label="Amount received"
                  value={paymentAmount}
                  onChange={t =>
                    setPaymentAmount(String(t ?? '').replace(/[^\d]/g, ''))
                  }
                  keyboard="number-pad"
                  error={
                    paymentAmount.trim().length > 0 && !isAmountValid
                      ? `Enter an amount between 1 and ${Math.round(pending)}`
                      : undefined
                  }
                />

                <View style={styles.quickRow}>
                  <Text style={styles.quickLabel}>Quick fill</Text>
                  <View style={styles.quickChipsRow}>
                    {(() => {
                      const q25 = Math.max(1, Math.round(pending * 0.25));
                      const q50 = Math.max(1, Math.round(pending * 0.5));
                      const qFull = Math.max(1, Math.round(pending));
                      const selected25 = pending > 0 && amountNum === q25;
                      const selected50 = pending > 0 && amountNum === q50;
                      const selectedFull = pending > 0 && amountNum === qFull;

                      const pillTone = (selected: boolean) => ({
                        bg: selected
                          ? theme.colors.primaryContainer
                          : theme.colors.surface,
                        border: selected ? theme.colors.primary : outline,
                        text: selected ? theme.colors.primary : '#6B7280',
                      });

                      const tone25 = pillTone(selected25);
                      const tone50 = pillTone(selected50);
                      const toneFull = pillTone(selectedFull);

                      return (
                        <>
                    <TouchableRipple
                      onPress={() =>
                        setPaymentAmount(
                          String(q25),
                        )
                      }
                      disabled={pending <= 0}
                      borderless
                      style={[
                        styles.quickPill,
                        {
                          backgroundColor: tone25.bg,
                          borderColor: tone25.border,
                          opacity: pending > 0 ? 1 : 0.5,
                        },
                      ]}
                    >
                      <View style={styles.quickPillInner}>
                        <Text style={[styles.quickPillText, { color: tone25.text }]}>
                          25%
                        </Text>
                      </View>
                    </TouchableRipple>

                    <TouchableRipple
                      onPress={() =>
                        setPaymentAmount(
                          String(q50),
                        )
                      }
                      disabled={pending <= 0}
                      borderless
                      style={[
                        styles.quickPill,
                        {
                          backgroundColor: tone50.bg,
                          borderColor: tone50.border,
                          opacity: pending > 0 ? 1 : 0.5,
                        },
                      ]}
                    >
                      <View style={styles.quickPillInner}>
                        <Text style={[styles.quickPillText, { color: tone50.text }]}>
                          50%
                        </Text>
                      </View>
                    </TouchableRipple>

                    <TouchableRipple
                      onPress={() => setPaymentAmount(String(qFull))}
                      disabled={pending <= 0}
                      borderless
                      style={[
                        styles.quickPill,
                        {
                          backgroundColor: toneFull.bg,
                          borderColor: toneFull.border,
                          opacity: pending > 0 ? 1 : 0.5,
                        },
                      ]}
                    >
                      <View style={styles.quickPillInner}>
                        {selectedFull ? (
                          <Icon
                            source="check-circle-outline"
                            size={16}
                            color={toneFull.text}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.quickPillText,
                            { color: toneFull.text },
                          ]}
                          numberOfLines={1}
                        >
                          Full {formatMoney(pending)}
                        </Text>
                      </View>
                    </TouchableRipple>
                        </>
                      );
                    })()}
                  </View>
                </View>

                <View style={styles.methodBlock}>
                  <Text style={styles.methodLabel}>Method</Text>
                  <View style={styles.methodRow}>
                    {(
                      [
                        { id: 'CASH', icon: 'cash' },
                        { id: 'UPI', icon: 'qrcode-scan' },
                        { id: 'BANK', icon: 'bank-outline' },
                      ] as const
                    ).map(m => {
                      const selected = paymentMethod === (m.id as any);
                      return (
                        <TouchableRipple
                          key={m.id}
                          onPress={() => setPaymentMethod(m.id as any)}
                          borderless
                          style={[
                            styles.methodChip,
                            {
                              backgroundColor: selected
                                ? theme.colors.primaryContainer
                                : theme.colors.surface,
                              borderColor: selected
                                ? theme.colors.primary
                                : outline,
                            },
                          ]}
                        >
                          <View style={styles.methodChipInner}>
                            <Icon
                              source={m.icon}
                              size={16}
                              color={
                                selected ? theme.colors.primary : '#6B7280'
                              }
                            />
                            <Text
                              style={[
                                styles.methodChipText,
                                {
                                  color: selected
                                    ? theme.colors.primary
                                    : '#6B7280',
                                },
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

                <FormInput
                  label="Note (saved in bill notes)"
                  value={paymentNote}
                  onChange={setPaymentNote}
                  maxLength={100}
                />

                <Surface
                  style={[
                    styles.previewBox,
                    {
                      backgroundColor: theme.colors.surface,
                      borderColor: outline,
                    },
                  ]}
                  elevation={0}
                >
                  <View style={styles.previewHeaderRow}>
                    <Text style={styles.previewHeaderText}>
                      Payment Summary
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: nextStatusTone.bg,
                          borderColor: nextStatusTone.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: nextStatusTone.text },
                        ]}
                        numberOfLines={1}
                      >
                        {nextStatus}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Paid</Text>
                    <Text style={styles.previewValue}>
                      {formatMoney(nextPaid)}
                    </Text>
                  </View>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Pending</Text>
                    <Text style={styles.previewValue}>
                      {formatMoney(nextPending)}
                    </Text>
                  </View>
                  <ProgressBar
                    progress={nextProgress}
                    color={theme.colors.primary}
                    style={styles.previewProgress}
                  />
                  {!isAmountValid && paymentAmount.trim().length > 0 && (
                    <Text
                      style={[styles.amountHint, { color: theme.colors.error }]}
                    >
                      Enter an amount between 1 and {Math.round(pending)}.
                    </Text>
                  )}
                </Surface>

                {/* Internal bottom breathing room (keeps content off dialog edge) */}
                <View pointerEvents="none" style={styles.dialogBottomSpacer} />
              </ScrollView>
            </View>
          </Surface>
        </Modal>
      </Portal>
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
}) => {
  const theme = useTheme();
  return (
    <Surface style={styles.tile} elevation={0}>
      <View style={styles.tileInner}>
        <View style={styles.tileTop}>
          <Icon source={icon} size={20} color={theme.colors.primary} />
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
};

const BreakdownRow = ({
  icon,
  label,
  sub,
  value,
}: {
  icon: string;
  label: string;
  sub?: string;
  value: string;
}) => {
  const theme = useTheme();
  const outline = (theme.colors as any).outlineVariant ?? theme.colors.outline;
  const badgeBg = (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  return (
    <View style={styles.breakdownRow}>
      <View
        style={[
          styles.breakdownIconBadge,
          { borderColor: outline, backgroundColor: badgeBg },
        ]}
      >
        <Icon source={icon} size={16} color="#6B7280" />
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.breakdownLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={styles.breakdownSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>

      <Text
        style={styles.breakdownValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {value}
      </Text>
    </View>
  );
};

const MetaPill = ({
  icon,
  label,
  color,
  backgroundColor,
  borderColor,
}: {
  icon: string;
  label: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}) => {
  const theme = useTheme();
  const c = color ?? theme.colors.primary;
  const bg = backgroundColor ?? theme.colors.primaryContainer;
  const bc = borderColor ?? theme.colors.primary;
  return (
    <Surface
      style={[styles.metaPill, { backgroundColor: bg, borderColor: bc }]}
      elevation={0}
    >
      <Icon source={icon} size={16} color={c} />
      <Text style={[styles.metaPillText, { color: c }]} numberOfLines={1}>
        {label}
      </Text>
    </Surface>
  );
};

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
  container: {
    flexGrow: 1,
    padding: 16,
    // Keep space for FAB(s) like Room/Tenant screens
    paddingBottom: 120,
    backgroundColor: '#F4F6FA',
  },
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
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    // Keep vertical rhythm consistent: bill card will use marginTop
    marginBottom: 0,
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroEditBtn: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    margin: 0,
    borderWidth: 1,
    zIndex: 10,
    elevation: 10,
  },
  heroPhotoWrap: {
    width: 58,
    height: 58,
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
    letterSpacing: 0.6,
    fontSize: 12,
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
    fontWeight: '800',
    fontSize: 13,
    flex: 1,
  },

  billCard: {
    borderRadius: 16,
    padding: 0,
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billCardClip: {
    borderRadius: 16,
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
    color: '#6B7280',
    fontWeight: '800',
  },
  billTopValue: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
  },
  billTopSub: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '800',
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Fixed width only for the main bill card status (symmetry across PAID/PARTIAL/UNPAID).
  billStatusPill: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
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

  // RoomView-style breakdown list (replaces tile grid on main UI)
  breakdownTitle: {
    marginTop: 14,
    marginHorizontal: 14,
    fontWeight: '900',
    fontSize: 16,
    color: '#111827',
  },
  breakdownList: {
    marginTop: 10,
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  breakdownIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  breakdownLabel: { fontSize: 12, fontWeight: '900', color: '#6B7280' },
  breakdownSub: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  breakdownValue: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
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

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
  deleteFab: {
    position: 'absolute',
    right: 16,
    bottom: 96, // above share FAB
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
  paymentStatAmount: {
    marginTop: 6,
    fontWeight: '900',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
  },
  paymentProgress: {
    marginTop: 10,
    height: 6,
    borderRadius: 999,
  },
  previewBox: {
    marginTop: 5,
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
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 560,
    overflow: 'hidden',
  },
  payModalContainer: {
    alignItems: 'center',
  },
  payModalContainerKeyboardClosed: {
    paddingHorizontal: 18,
  },
  payModalContainerKeyboardOpen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  payDialogHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  payDialogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payDialogCloseBtn: { margin: 0 },
  payDialogTextCol: {
    flex: 1,
    minWidth: 0,
  },
  payDialogTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  payDialogStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payDialogStatusPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  payDialogTopActions: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topActionBtn: { flex: 1, borderRadius: 999 },
  topActionBtnContent: { paddingVertical: 7 },
  topActionBtnLabel: { fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },
  payDialogIconWrap: {
    width: 36,
    height: 36,
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
    fontWeight: '800',
    fontSize: 13,
  },

  dialogContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  payDialogScrollArea: {
    flexGrow: 1,
    width: '100%',
    paddingTop: 2,
  },
  dialogBottomSpacer: {
    height: 14,
  },

  quickRow: { marginTop: 4 },
  quickLabel: {
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  quickPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quickPillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quickPillText: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#6B7280',
  },

  methodBlock: { marginTop: 12 },
  methodLabel: {
    color: '#6B7280',
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 8,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    paddingBottom: 10,
  },
  methodChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  methodChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodChipText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.2 },
  amountHint: { marginTop: 8, fontWeight: '800' },

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
  commentDate: {
    fontWeight: '700',
    color: '#111827',
  },
  commentTextFirst: {
    marginTop: 0,
  },
  commentTextGap: {
    marginTop: 10,
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

  shareShotWrap: {
    // Keep it in layout (not off-screen) so it reliably renders for capture.
    // Opacity 0 keeps it invisible to the user.
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    // Ensure it never steals touches / accessibility focus.
    pointerEvents: 'none',
  },
  shareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    padding: 18,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  shareCardFrame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
    borderRadius: 16,
    padding: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  shareCanvas: {
    width: 400,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  shareHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    marginBottom: 12,
  },
  shareHeaderLeft: { flex: 1, paddingRight: 10 },
  shareBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    flexShrink: 1,
  },
  shareMuted: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  shareStatusPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    width: 99,
    alignItems: 'center',
  },
  shareStatusText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 0.6,
  },
  shareMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shareMetaItem: {
    width: '48%',
  },
  shareMetaLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  shareMetaValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  shareSectionTitle: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
  },
  shareDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D1D5DB',
    marginTop: 10,
    marginBottom: 6,
  },
  shareReadingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  shareReadingsItem: {
    width: '48%',
  },
  shareTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
    paddingVertical: 8,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  shareTableHeaderText: { color: '#6B7280', fontWeight: '700' },
  shareTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  shareAltRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  shareTableCell: { flex: 1, fontSize: 12, color: '#111827' },
  shareAmount: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  shareDescCell: { flex: 2, fontSize: 12, color: '#111827' },
  shareAmountCell: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  shareNote: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
  },
  shareTotalRow: {
    marginTop: 10,
    paddingTop: 0,
    borderTopWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shareTotalLeft: { flex: 1, paddingRight: 10 },
  shareTotalLabel: { color: '#6B7280', fontSize: 12, fontWeight: '700' },
  shareTotalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 4,
    textAlign: 'right',
  },
  shareTotalsInlineRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    justifyContent: 'flex-end',
  },
  shareTotalsItem: { flex: 1 },
  shareNotesBlock: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  shareNotesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  shareNotesPageText: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '800',
  },
  shareContinuedIntro: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  shareContinuedKicker: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
  },
  shareContinuedTitle: {
    marginTop: 6,
    color: '#111827',
    fontSize: 16,
    fontWeight: '900',
  },
  shareContinuedSub: {
    marginTop: 2,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '700',
  },
  shareNoteLine: {
    marginTop: 10, // ~10px spacing between note lines
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  shareNoteDate: {
    fontWeight: '700',
    color: '#111827',
  },
  shareNoteLineFirst: {
    marginTop: 0,
  },
  shareNoteLineContinued: {
    fontSize: 13,
    lineHeight: 18,
  },
  shareNoteLinePlaceholder: {
    color: 'transparent',
  },
  shareFooter: {
    marginTop: 12,
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 11,
  },
});
