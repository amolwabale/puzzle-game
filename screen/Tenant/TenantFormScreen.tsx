import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import {
  Alert,
  Keyboard,
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
  FAB,
  IconButton,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pick, types as pickerTypes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import { TenantStackParamList } from '../../navigation/StackParam';
import {
  fetchTenantById,
  fetchTenants,
  FileInput,
  saveTenant,
  TenantRecord,
} from '../../service/tenantService';
import { supabase } from '../../service/SupabaseClient';
import { FormInput } from '../../components/FormInput';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';
type FileState = { file?: FileInput | null; url?: string | null };
type Props = NativeStackScreenProps<TenantStackParamList, 'TenantForm'>;

const isNumeric = (v: string) => /^\d+$/.test(v);
const isMobile = (v: string) => /^\d{10}$/.test(v);

export default function TenantFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<Props['route']>();
  const { mode, tenantId } = route.params || { mode: 'add' as const };
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  const [name, setName] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [alternateMobile, setAlternateMobile] = React.useState('');
  const [familyMembers, setFamilyMembers] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [company, setCompany] = React.useState('');

  const [profile, setProfile] = React.useState<FileState>({});
  const [profileSignedUrl, setProfileSignedUrl] = React.useState<
    string | undefined
  >();

  const [adhar, setAdhar] = React.useState<FileState>({});
  const [pan, setPan] = React.useState<FileState>({});
  const [agreement, setAgreement] = React.useState<FileState>({});

  React.useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const subShow = Keyboard.addListener(showEvent as any, e => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvent as any, () => {
      setKeyboardHeight(0);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  /* ---------- SIGNED URL HELPER ---------- */
  const createSignedUrl = async (fullUrl?: string | null) => {
    if (!fullUrl) return undefined;

    try {
      const marker = '/tenant-manager/';
      const idx = fullUrl.indexOf(marker);
      if (idx === -1) return undefined;

      const filePath = fullUrl.substring(idx + marker.length);

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

  const loadTenant = React.useCallback(async () => {
    if (mode !== 'edit' || !tenantId) return;

    try {
      setLoading(true);
      const t = await fetchTenantById(tenantId);
      if (!t) return;

      setName(t.name || '');
      setMobile(t.mobile || '');
      setAlternateMobile(t.alternate_mobile || '');
      setFamilyMembers(t.total_family_members || '');
      setAddress(t.address || '');
      setCompany(t.company_name || '');

      setProfile({ url: (t as any).profile_photo_url });

      const signed = await createSignedUrl((t as any).profile_photo_url);
      setProfileSignedUrl(signed);

      setAdhar({ url: t.adhar_card_url });
      setPan({ url: t.pan_card_url });
      setAgreement({ url: t.agreement_url });
    } finally {
      setLoading(false);
    }
  }, [mode, tenantId]);

  useFocusEffect(
    React.useCallback(() => {
      loadTenant();
    }, [loadTenant]),
  );

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Required';
    if (!address.trim()) e.address = 'Required';
    if (!isMobile(mobile)) e.mobile = 'Invalid mobile';
    if (alternateMobile && !isNumeric(alternateMobile))
      e.alternateMobile = 'Numbers only';
    if (familyMembers && !isNumeric(familyMembers))
      e.familyMembers = 'Numbers only';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

  const pickPhoto = async () => {
    const r = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    const a = r.assets?.[0];
    if (!a?.uri) return;

    const fileSize = (a as any).fileSize != null ? Number((a as any).fileSize) : null;
    if (fileSize != null && Number.isFinite(fileSize) && fileSize > MAX_FILE_BYTES) {
      Alert.alert('File too large', 'Please choose a file smaller than 20 MB.');
      return;
    }

    setProfile({
      file: { uri: a.uri, name: a.fileName || 'photo.jpg', type: a.type },
      url: null,
    });

    setProfileSignedUrl(undefined); // local preview takes over
  };

  const pickFile = async (setter: (f: FileState) => void) => {
    try {
      const results = await pick({
        // Allow any file type (pdf, images, docs, etc).
        type: [pickerTypes.allFiles],
        allowMultiSelection: false,
      });
  
      const file = results[0];

      const size = (file as any).size != null ? Number((file as any).size) : null;
      if (size != null && Number.isFinite(size) && size > MAX_FILE_BYTES) {
        Alert.alert('File too large', 'Please choose a file smaller than 20 MB.');
        return;
      }
  
      setter({
        file: {
          uri: file.uri,
          name: file.name ?? 'file',
          type: file.type ?? undefined, // ✅ FIXED
        },
        url: null,
      });
    } catch (e: any) {
      if (e?.code === 'DOCUMENT_PICKER_CANCELED') {
        return;
      }
      console.error('File pick failed', e);
    }
  };

  const normalizeFile = (file?: {
    uri?: string;
    name?: string;
    type?: string;
  }) => {
    if (!file?.uri) return null;
  
    let uri = file.uri;
  
    // Android fix: content:// → file://
    if (Platform.OS === 'android' && uri.startsWith('content://')) {
      uri = uri;
    }
  
    return {
      uri,
      name: file.name || `file-${Date.now()}`,
      type: file.type || 'application/octet-stream',
    };
  };

  const save = async () => {
    if (!validate()) return;

    try {
      setSaving(true);

      // Name uniqueness (case-insensitive, trimmed)
      const normalized = name.trim().toLowerCase();
      const existing = await fetchTenants();
      const duplicate = (existing || []).find((t: any) => {
        const tn = String(t?.name || '')
          .trim()
          .toLowerCase();
        if (!tn) return false;
        if (mode === 'edit' && tenantId != null && t?.id === tenantId)
          return false;
        return tn === normalized;
      });
      if (duplicate) {
        setErrors(prev => ({
          ...prev,
          name: 'Tenant with same name already exists',
        }));
        return;
      }

      await saveTenant({
        id: mode === 'edit' ? tenantId : undefined,
        name,
        mobile,
        alternate_mobile: alternateMobile,
        total_family_members: familyMembers,
        address,
        company_name: company,
        files: { profile, adhar, pan, agreement },
      });
      if (mode === 'add') {
        trackEvent('Tenant_Created', {
          source: 'Tenant',
          tenant_id: tenantId,
        });
      } else {
        trackEvent('Tenant_Updated', {
          source: 'Tenant',
          tenant_id: tenantId,
        });
      }
      Alert.alert('Saved', 'Tenant saved successfully', [
        { text: 'OK', onPress: navigation.goBack },
      ]);
    } catch (e: any) {
      const message =
        typeof e?.message === 'string' && e.message.trim()
          ? e.message
          : 'Something went wrong while saving. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const avatarUri = profile.file ? profile.file.uri : profileSignedUrl;
  const fabBottom = 50 + Math.max(0, keyboardHeight - insets.bottom);

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          {/* HERO */}
          <Surface style={styles.hero} elevation={4}>
            <AvatarDisplay uri={avatarUri} size={88} />

            <View style={{ marginLeft: 16, flex: 1 }}>
              <Text variant="titleLarge" style={styles.heroTitle}>
                {mode === 'edit' ? 'Edit Tenant' : 'Add Tenant'}
              </Text>

              <TouchableRipple
                onPress={pickPhoto}
                borderless
                style={[
                  styles.photoAction,
                  {
                    borderColor: theme.colors.primary,
                    backgroundColor: theme.colors.primaryContainer,
                  },
                ]}
              >
                <View style={styles.photoActionContent}>
                  <IconButton
                    icon={
                      profile.file || profile.url
                        ? 'camera-outline'
                        : 'upload-outline'
                    }
                    size={18}
                    style={styles.photoIcon}
                  />
                  <Text style={styles.photoActionText}>
                    {profile.file || profile.url
                      ? 'Change photo'
                      : 'Upload photo'}
                  </Text>
                </View>
              </TouchableRipple>
            </View>
          </Surface>

          {/* PERSONAL */}
          <Section title="Personal Information">
            <FormInput
              label="Full Name *"
              value={name}
              onChange={setName}
              error={errors.name}
              maxLength={70}
            />
            <FormInput
              label="Mobile *"
              value={mobile}
              onChange={setMobile}
              error={errors.mobile}
              keyboard="number-pad"
              maxLength={10}
            />
            <FormInput
              label="Alternate Mobile"
              value={alternateMobile}
              onChange={setAlternateMobile}
              maxLength={10}
            />
            <FormInput
              label="Family Members"
              value={familyMembers}
              onChange={setFamilyMembers}
              keyboard="number-pad"
              maxLength={2}
            />
          </Section>

          {/* ADDRESS */}
          <Section title="Address & Work">
            <FormInput
              label="Address *"
              value={address}
              onChange={setAddress}
              error={errors.address}
              multiline={true}
              maxLength={255}
            />
            <FormInput
              label="Company Name"
              value={company}
              onChange={setCompany}
              maxLength={50}
            />
          </Section>

          {/* DOCUMENTS */}
          <Section title="Documents">
            <View style={styles.docGrid}>
              <DocTile
                icon="card-account-details"
                label="Aadhaar"
                state={adhar}
                onPick={() => pickFile(setAdhar)}
              />
              <DocTile
                icon="card-bulleted"
                label="PAN"
                state={pan}
                onPick={() => pickFile(setPan)}
              />
              <DocTile
                icon="file-document"
                label="Agreement"
                state={agreement}
                onPick={() => pickFile(setAgreement)}
              />
            </View>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>

      <FAB
        icon="content-save"
        style={[styles.fab, { bottom: fabBottom }]}
        loading={saving}
        onPress={save}
      />
    </>
  );
}

/* ---------------- UI HELPERS ---------------- */

const Section = ({ title, children }: any) => (
  <Surface style={styles.section} elevation={2}>
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {title}
    </Text>
    {children}
  </Surface>
);

const DocTile = ({ icon, label, state, onPick }: any) => (
  <Surface style={styles.docTile} elevation={2}>
    <IconButton icon={icon} size={28} />
    <Text style={styles.docLabel}>{label}</Text>
    <Button mode="text" onPress={onPick} labelStyle={styles.docButtonLabel}>
      {state.file || state.url ? 'Change' : 'Upload'}
    </Button>
  </Surface>
);

const AvatarDisplay = ({ uri, size }: any) =>
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
    backgroundColor: '#FFFFFF',
  },
  // ~15% typography bump
  heroTitle: { fontWeight: '700', fontSize: 25 },
  heroLinkLabel: { fontSize: 15 },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 18,
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
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  docLabel: {
    fontWeight: '600',
    marginVertical: 6,
    fontSize: 16,
  },
  docButtonLabel: { fontSize: 15 },
  fab: {
    position: 'absolute',
    right: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAction: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 20,
  },

  photoActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },

  photoIcon: {
    margin: 0,
    marginRight: 4,
  },

  photoActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
});
