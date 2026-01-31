import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Alert, ScrollView, Share, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  FAB,
  IconButton,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import RNBlobUtil from 'react-native-blob-util';
import { TenantStackParamList } from '../../navigation/StackParam';
import { fetchTenantById, TenantRecord } from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient'; // ✅ REQUIRED
import { fetchRooms } from '../../service/RoomService';
import { fetchActiveRoomForTenants } from '../../service/TenantRoomService';

type Props = NativeStackScreenProps<TenantStackParamList, 'TenantView'>;

const formatDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '-';

export default function TenantViewScreen() {
  const route = useRoute<Props['route']>();
  const navigation = useNavigation<Props['navigation']>();
  const { tenantId } = route.params;
  const theme = useTheme();

  const [tenant, setTenant] = React.useState<TenantRecord | null>(null);
  const [profileSignedUrl, setProfileSignedUrl] = React.useState<string | undefined>();
  const [roomName, setRoomName] = React.useState<string>('No room assigned');
  const [joiningDateLine, setJoiningDateLine] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(false);
  const skipNextReloadRef = React.useRef(false);
  const [sharingLabel, setSharingLabel] = React.useState<string | null>(null);

  const createSignedUrl = async (fullUrl?: string | null) => {
    if (!fullUrl) return undefined;

    try {
      const marker = '/tenant-manager/';
      const index = fullUrl.indexOf(marker);
      if (index === -1) return undefined;

      const filePath = fullUrl.substring(index + marker.length);

      const { data, error } = await supabase.storage
        .from('tenant-manager')
        .createSignedUrl(filePath, 60 * 60); // 1 hour

      if (error) {
        console.warn('Signed URL error:', error.message);
        return undefined;
      }

      return data.signedUrl;
    } catch {
      return undefined;
    }
  };

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTenantById(tenantId);
      if (!data) {
        Alert.alert('Not found', 'Tenant could not be loaded', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      setTenant(data);

      const [signed, rooms, activeMap] = await Promise.all([
        // 🔐 Signed URL for profile photo
        createSignedUrl((data as any).profile_photo_url),

        // Rooms list to resolve room_id → room_name
        fetchRooms(),

        // Active mapping for this tenant (leaving_date is null)
        fetchActiveRoomForTenants([tenantId]),
      ]);

      setProfileSignedUrl(signed);

      const roomNameById: Record<number, string> = {};
      (rooms || []).forEach((r: any) => {
        if (r?.id != null) roomNameById[r.id] = r.name || '-';
      });

      const assignment = activeMap?.[tenantId];
      if (assignment) {
        setRoomName(roomNameById[assignment.room_id] || '-');
        setJoiningDateLine(`Joined on ${formatDate(assignment.joining_date)}`);
      } else {
        setRoomName('No room assigned');
        setJoiningDateLine(undefined);
      }
    } catch (err: any) {
      Alert.alert('Load Failed', err.message || 'Could not load tenant', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, navigation]);

  useFocusEffect(
    React.useCallback(() => {
      if (skipNextReloadRef.current) {
        skipNextReloadRef.current = false;
        return;
      }
      load();
    }, [load]),
  );

  if (loading || !tenant) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const openSignedDoc = async (label: string, url?: string | null) => {
    if (!url) {
      Alert.alert('Not available', 'Document not uploaded');
      return;
    }
    try {
      const signed = await createSignedUrl(url);
      if (!signed) {
        Alert.alert('Open failed', 'Could not generate a secure link. Please try again.');
        return;
      }
      skipNextReloadRef.current = true;
      navigation.navigate('TenantDocument', { title: label, url: signed });
    } catch (err: any) {
      Alert.alert('Open failed', err?.message || 'Could not open document');
    }
  };

  const shareSignedDoc = async (label: string, url?: string | null) => {
    if (!url) {
      Alert.alert('Not available', 'Document not uploaded');
      return;
    }
    try {
      setSharingLabel(label);
      const signed = await createSignedUrl(url);
      if (!signed) {
        Alert.alert('Share failed', 'Could not generate a secure link. Please try again.');
        return;
      }

      // Download to local temp file so native share sheet can offer:
      // - Save Image (for images)
      // - Save to Files (for PDFs)
      const safeBase = label.toLowerCase().replace(/\s+/g, '_');
      const extFromUrl = (() => {
        const cleaned = url.split('?')[0];
        const dot = cleaned.lastIndexOf('.');
        if (dot === -1) return '';
        const ext = cleaned.substring(dot + 1).toLowerCase();
        return ext.length <= 5 ? ext : '';
      })();
      const ext = extFromUrl || 'pdf';
      const fileName = `${safeBase}_${tenantId}.${ext}`;
      const destPath = `${RNBlobUtil.fs.dirs.CacheDir}/${fileName}`;

      await RNBlobUtil.config({ path: destPath, fileCache: true }).fetch('GET', signed);
      const fileUrl = `file://${destPath}`;

      await Share.share({
        title: label,
        message: `${label} document`,
        url: fileUrl,
      });
    } catch (err: any) {
      Alert.alert('Share failed', err?.message || 'Could not share document');
    } finally {
      setSharingLabel(null);
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        {/* HERO */}
        <Surface style={styles.hero} elevation={2}>
          <AvatarDisplay uri={profileSignedUrl} size={88} />
          <View style={styles.heroText}>
            <Text variant="titleLarge" style={styles.tenantName}>
              {tenant.name}
            </Text>
            <Text style={styles.subText}>{roomName}</Text>
            {!!joiningDateLine && (
              <Text style={styles.subSubText}>{joiningDateLine}</Text>
            )}
          </View>
        </Surface>

        {/* PERSONAL INFO */}
        <Section title="Personal Information">
          <InfoRow icon="phone" label="Mobile" value={tenant.mobile} />
          <InfoRow icon="phone-plus" label="Alternate Mobile" value={tenant.alternate_mobile} />
          <InfoRow
            icon="account-group"
            label="Family Members"
            value={tenant.total_family_members}
          />
        </Section>

        {/* ADDRESS */}
        <Section title="Address & Work">
          <InfoRow icon="map-marker" label="Address" value={tenant.address} />
          <InfoRow icon="office-building" label="Company" value={tenant.company_name} />
        </Section>

        {/* DOCUMENTS */}
        <Section title="Documents">
          <View style={styles.docGrid}>
            <DocTile
              icon="card-account-details"
              label="Aadhaar"
              url={tenant.adhar_card_url}
              onPress={() => openSignedDoc('Aadhaar', tenant.adhar_card_url)}
              onShare={() => shareSignedDoc('Aadhaar', tenant.adhar_card_url)}
              sharing={sharingLabel === 'Aadhaar'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
            <DocTile
              icon="card-bulleted"
              label="PAN"
              url={tenant.pan_card_url}
              onPress={() => openSignedDoc('PAN', tenant.pan_card_url)}
              onShare={() => shareSignedDoc('PAN', tenant.pan_card_url)}
              sharing={sharingLabel === 'PAN'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
            <DocTile
              icon="file-document"
              label="Agreement"
              url={tenant.agreement_url}
              onPress={() => openSignedDoc('Agreement', tenant.agreement_url)}
              onShare={() => shareSignedDoc('Agreement', tenant.agreement_url)}
              sharing={sharingLabel === 'Agreement'}
              shareTone={{
                bg: theme.colors.primaryContainer,
                border: theme.colors.primary,
                icon: theme.colors.primary,
              }}
            />
          </View>
        </Section>
      </ScrollView>

      {/* FLOATING EDIT */}
      <FAB
        icon="pencil"
        style={styles.fab}
        onPress={() =>
          navigation.navigate('TenantForm', { mode: 'edit', tenantId })
        }
      />
    </>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

const Section = ({ title, children }: any) => (
  <Surface style={styles.section} elevation={2}>
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {title}
    </Text>
    {children}
  </Surface>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string | number | null;
}) => (
  <View style={styles.infoRow}>
    <IconButton icon={icon} size={18} />
    <View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value ?? '-'}</Text>
    </View>
  </View>
);

const DocTile = ({
  icon,
  label,
  url,
  onPress,
  onShare,
  sharing,
  shareTone,
}: {
  icon: string;
  label: string;
  url?: string | null;
  onPress: () => void;
  onShare: () => void;
  sharing: boolean;
  shareTone: { bg: string; border: string; icon: string };
}) => (
  <Surface style={styles.docTile} elevation={1}>
    <View style={styles.docTileRow}>
      <View style={styles.docInfoCol}>
        <IconButton icon={icon} size={28} style={styles.docIconBtn} />
        <Text style={styles.docLabel} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        {!url ? (
          <Text style={styles.muted} numberOfLines={1} ellipsizeMode="tail">
            Not uploaded
          </Text>
        ) : null}
      </View>

      {url ? (
        <View style={styles.docActionsCol}>
          <IconButton
            icon="eye-outline"
            size={18}
            onPress={onPress}
            iconColor={shareTone.icon}
            style={[
              styles.docActionPill,
              { backgroundColor: shareTone.bg, borderColor: shareTone.border },
            ]}
          />
          <IconButton
            icon={sharing ? () => <ActivityIndicator size={16} color={shareTone.icon} /> : 'share-variant'}
            size={18}
            onPress={onShare}
            disabled={sharing}
            iconColor={shareTone.icon}
            style={[
              styles.docActionPill,
              { backgroundColor: shareTone.bg, borderColor: shareTone.border },
            ]}
          />
        </View>
      ) : null}
    </View>
  </Surface>
);

const AvatarDisplay = ({ uri, size }: { uri?: string; size: number }) =>
  uri ? (
    <Avatar.Image size={size} source={{ uri }} />
  ) : (
    <Avatar.Icon size={size} icon="account" />
  );

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 120,
    backgroundColor: '#F4F6FA',
  },

  hero: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroText: {
    flex: 1,
    marginLeft: 16,
  },
  tenantName: {
    fontWeight: '700',
    fontSize: 25, // +~5% more
  },
  subText: {
    color: '#666',
    marginTop: 4,
    fontSize: 16,
  },
  subSubText: {
    color: '#888',
    marginTop: 2,
    fontSize: 14,
    fontWeight: '500',
  },

  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 19,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '500',
  },

  docGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  docTile: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    minHeight: 120, // keep tile size consistent after layout change
  },
  docTileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  docInfoCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 8,
  },
  docIconBtn: {
    margin: 0,
  },
  docActionsCol: {
    flexDirection: 'column',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docActionPill: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docLabel: {
    fontWeight: '600',
    marginBottom: 2,
    fontSize: 16,
    maxWidth: '100%',
    flexShrink: 1,
    textAlign: 'center',
  },
  muted: {
    color: '#999',
    fontSize: 14,
  },

  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },

  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
