import {
  CompositeNavigationProp,
  useNavigation,
} from '@react-navigation/native';
import * as React from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Button,
  Icon,
  Text,
  Surface,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AuthStackParamList,
  RootStackParamList,
} from '../../navigation/StackParam';
import { Login } from '../../service/IdentityService';
import { FormInput } from '../../components/FormInput';

type AuthNav = NativeStackNavigationProp<AuthStackParamList, 'LoginScreen'>;
type RootNav = NativeStackNavigationProp<RootStackParamList>;
import { trackEvent } from '../../service/analyticsTracker';

export default function LoginScreen() {
  const theme = useTheme();
  const navigation = useNavigation<CompositeNavigationProp<AuthNav, RootNav>>();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(false);

  const handleBack = () => {
    navigation.navigate('AuthScreen');
    trackEvent('Auth_Login_Back_Pressed', {
      source: 'Auth',
    });
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const result = await Login(email, password);
      const user = result.data?.user;

      if (!user || result.error) {
        Alert.alert('Invalid email or password');
        return;
      }
      trackEvent('Auth_Login_Success', {
        source: 'Auth',
        email: email,
      });
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const content = (

    <View style={styles.stage}>
        {/* Soft background accents (same as AuthScreen) */}
        <View pointerEvents="none" style={styles.bgAccents}>
          <View
            style={[
              styles.blob,
              styles.blobOne,
              { backgroundColor: theme.colors.primaryContainer, opacity: 0.55 },
            ]}
          />
          <View
            style={[
              styles.blob,
              styles.blobTwo,
              {
                backgroundColor: theme.colors.secondaryContainer,
                opacity: 0.45,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>
            {/* HERO (Room/Tenant standard) */}
            <Surface
              style={[
                styles.hero,
                {
                  borderColor: outlineColor(theme),
                  backgroundColor: theme.colors.surface,
                },
              ]}
              elevation={2}
            >
              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="lock-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.heroTitle, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  Welcome back
                </Text>
                <Text
                  style={[
                    styles.heroSub,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={2}
                >
                  Sign in to manage tenants, rooms, and payments.
                </Text>
              </View>
            </Surface>

            {/* FORM */}
            <Surface
              style={[
                styles.card,
                {
                  borderColor: outlineColor(theme),
                  backgroundColor: theme.colors.surface,
                },
              ]}
              elevation={2}
            >
              <View style={styles.sectionTitleRow}>
                <View
                  style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.colors.primaryContainer },
                  ]}
                >
                  <Icon
                    source="account-circle-outline"
                    size={18}
                    color={theme.colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: theme.colors.onSurface },
                  ]}
                >
                  Login
                </Text>
              </View>

              <FormInput
                label="Email *"
                value={email}
                onChange={t => {
                  setEmail(t);
                  setErrors(p => ({ ...p, email: '' }));
                }}
                error={errors.email}
                keyboard="default"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                autoComplete="off"
                importantForAutofill="no"
                maxLength={50}
              />

              <FormInput
                label="Password *"
                value={password}
                onChange={t => {
                  setPassword(t);
                  setErrors(p => ({ ...p, password: '' }));
                }}
                error={errors.password}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                autoComplete="password"
                maxLength={50}
              />

              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  onPress={handleBack}
                  style={styles.secondaryButton}
                  contentStyle={styles.buttonContent}
                  disabled={loading}
                >
                  Back
                </Button>

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  style={styles.primaryButton}
                  contentStyle={styles.buttonContent}
                  disabled={loading}
                  loading={loading}
                >
                  Login
                </Button>
              </View>
            </Surface>
          </View>
        </ScrollView>
      </View>
  )
  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

function outlineColor(theme: any) {
  return (theme.colors as any).outlineVariant ?? theme.colors.outline;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  stage: {
    flex: 1,
    overflow: 'hidden',
  },
  bgAccents: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobOne: {
    width: 260,
    height: 260,
    top: -90,
    left: -70,
  },
  blobTwo: {
    width: 220,
    height: 220,
    bottom: -90,
    right: -70,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 120,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
  },

  hero: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },
  heroSub: { marginTop: 2, color: '#6B7280', fontWeight: '800', fontSize: 13 },

  card: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontWeight: '900', fontSize: 16, color: '#111827' },

  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12, // RN >= 0.71
    marginTop: 4,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
  },
});
