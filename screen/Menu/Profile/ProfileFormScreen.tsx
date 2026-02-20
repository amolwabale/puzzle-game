import { useNavigation, useRoute } from '@react-navigation/native';
import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  FAB,
  Icon,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormInput } from '../../../components/FormInput';
import {
  fetchUserProfile,
  updateUserProfile,
  UserProfile,
} from '../../../service/MenuService';

type Fields = {
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  address: string;
};

const MAX = {
  first_name: 100,
  last_name: 100,
  mobile: 10,
  email: 100,
  address: 250,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProfileFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const passedProfile: UserProfile | undefined = route.params?.profile;

  const [fields, setFields] = React.useState<Fields>({
    first_name: '',
    last_name: '',
    mobile: '',
    email: '',
    address: '',
  });
  const [errors, setErrors] = React.useState<Partial<Record<keyof Fields, string>>>({});
  const [loading, setLoading] = React.useState(!passedProfile);
  const [saving, setSaving] = React.useState(false);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);

  React.useEffect(() => {
    if (passedProfile) {
      setFields({
        first_name: passedProfile.first_name ?? '',
        last_name: passedProfile.last_name ?? '',
        mobile: passedProfile.mobile ?? '',
        email: passedProfile.email ?? '',
        address: passedProfile.address ?? '',
      });
      return;
    }
    (async () => {
      try {
        const p = await fetchUserProfile();
        if (p) {
          setFields({
            first_name: p.first_name ?? '',
            last_name: p.last_name ?? '',
            mobile: p.mobile ?? '',
            email: p.email ?? '',
            address: p.address ?? '',
          });
        }
      } catch (e) {
        console.error('ProfileFormScreen: load failed', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [passedProfile]);

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

  const setField = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    const sanitised = k === 'mobile' ? v.replace(/[^0-9]/g, '') : v;
    setFields(prev => ({ ...prev, [k]: sanitised }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof Fields, string>> = {};
    if (!fields.first_name.trim()) e.first_name = 'First name is required';
    if (!fields.last_name.trim()) e.last_name = 'Last name is required';
    if (!fields.email.trim()) {
      e.email = 'Email is required';
    } else if (!EMAIL_RE.test(fields.email.trim())) {
      e.email = 'Enter a valid email address';
    }
    if (fields.mobile.trim() && fields.mobile.trim().length !== 10) {
      e.mobile = 'Mobile must be exactly 10 digits';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await updateUserProfile({
        first_name: fields.first_name.trim(),
        last_name: fields.last_name.trim(),
        mobile: fields.mobile.trim() || undefined,
        email: fields.email.trim(),
        address: fields.address.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save profile');
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

  const keyboardLift = Math.max(0, keyboardHeight - insets.bottom);
  // Keep a fixed gap between FAB and keyboard on open.
  const fabBottom = keyboardHeight > 0 ? keyboardHeight + 15 : 24 + insets.bottom;

  return (
    <View style={styles.screenRoot}>
      <KeyboardAvoidingView
        style={styles.flex}
        // Android needs an explicit behavior to avoid the keyboard covering the form.
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            // Ensure last field (Address) can be scrolled above the keyboard.
            { paddingBottom: 100 + keyboardLift },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View pointerEvents={saving ? 'none' : 'auto'}>
          <Surface style={styles.heroCard} elevation={2}>
            <View style={styles.heroRow}>
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="account-edit-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroKicker}>Edit</Text>
                <Text style={styles.heroTitle}>Profile</Text>
              </View>
            </View>
          </Surface>

          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Basic information
            </Text>
            <FormInput
              label="First name *"
              value={fields.first_name}
              onChange={v => setField('first_name', v)}
              error={errors.first_name}
              maxLength={MAX.first_name}
              autoCapitalize="words"
            />
            <FormInput
              label="Last name *"
              value={fields.last_name}
              onChange={v => setField('last_name', v)}
              error={errors.last_name}
              maxLength={MAX.last_name}
              autoCapitalize="words"
            />
          </Surface>

          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Contact
            </Text>
            <FormInput
              label="Mobile"
              value={fields.mobile}
              onChange={v => setField('mobile', v)}
              error={errors.mobile}
              maxLength={MAX.mobile}
              keyboard="number-pad"
            />
            <FormInput
              label="Email *"
              value={fields.email}
              onChange={v => setField('email', v)}
              error={errors.email}
              disabled
              maxLength={MAX.email}
              keyboard="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Surface>

          <Surface style={styles.section} elevation={2}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Address
            </Text>
            <FormInput
              label="Address"
              value={fields.address}
              onChange={v => setField('address', v)}
              error={errors.address}
              maxLength={MAX.address}
              multiline
            />
          </Surface>
        </View>

      </ScrollView>

      <FAB
        icon="content-save"
        style={[styles.fab, { bottom: fabBottom }]}
        loading={saving}
        onPress={handleSave}
        disabled={saving}
      />
      </KeyboardAvoidingView>
      {saving ? <View pointerEvents="none" style={styles.screenScrim} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
    position: 'relative',
  },
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 100 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  heroCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: {
    fontWeight: '900',
    fontSize: 12,
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 2,
    fontWeight: '900',
    fontSize: 18,
    color: '#111827',
  },

  section: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontWeight: '900',
    marginBottom: 12,
    fontSize: 15,
    color: '#111827',
  },

  fab: {
    position: 'absolute',
    right: 16,
  },
  screenScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(17, 24, 39, 0.08)',
  },
});
