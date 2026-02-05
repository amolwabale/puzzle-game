import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as React from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Icon, Text, Surface, useTheme } from 'react-native-paper';
import { AuthStackParamList } from '../../navigation/StackParam';
import { RegisterUser } from '../../service/IdentityService';
import { FormInput } from '../../components/FormInput';
import analytics from '@react-native-firebase/analytics';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { trackEvent } from '../../service/analyticsTracker';

export default function RegisterScreen() {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<AuthStackParamList, 'AuthScreen'>
    >();
  const handleBack = () => {
    navigation.navigate('AuthScreen');
    trackEvent('Auth_Register_Back_Pressed', {
      source: 'Auth',
    });
  };

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[0-9]{10}$/.test(mobile)) {
      newErrors.mobile = 'Mobile number must be 10 digits';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Minimum 6 characters required';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      await RegisterUser({
        firstName,
        lastName,
        email,
        password,
        mobile,
        address,
      });

      trackEvent('Auth_Register_Success', {
        source: 'Auth',
        email: email,
      });

      Alert.alert(
        'Registration Successful',
        'Your account has been created successfully. Please login.',
        [{ text: 'OK', onPress: handleBack }],
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
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
          // Note: using BOTH KeyboardAvoidingView + automaticallyAdjustKeyboardInsets can feel jumpy on long forms.
          // We rely on KeyboardAvoidingView + natural scrolling for smoother behavior.
          automaticallyAdjustKeyboardInsets={false}
          contentInsetAdjustmentBehavior={
            Platform.OS === 'ios' ? 'automatic' : undefined
          }
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
          showsVerticalScrollIndicator={false}
        >
          {/* HERO */}
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
            <View style={styles.heroRow}>
              <View
                style={[
                  styles.heroIconWrap,
                  { backgroundColor: theme.colors.primaryContainer },
                ]}
              >
                <Icon
                  source="account-plus-outline"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[styles.heroTitle, { color: theme.colors.onSurface }]}
                  numberOfLines={1}
                >
                  Create account
                </Text>
                <Text
                  style={[
                    styles.heroSub,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                  numberOfLines={2}
                >
                  Set up your profile to get started.
                </Text>
              </View>
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
                  source="form-textbox"
                  size={18}
                  color={theme.colors.primary}
                />
              </View>
              <Text
                style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
              >
                Registration
              </Text>
            </View>

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="First name *"
                  value={firstName}
                  onChange={t => {
                    setFirstName(t);
                    setErrors(p => ({ ...p, firstName: '' }));
                  }}
                  error={errors.firstName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="givenName"
                  autoComplete="name-given"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Last name *"
                  value={lastName}
                  onChange={t => {
                    setLastName(t);
                    setErrors(p => ({ ...p, lastName: '' }));
                  }}
                  error={errors.lastName}
                  maxLength={50}
                  autoCapitalize="words"
                  autoCorrect={false}
                  textContentType="familyName"
                  autoComplete="name-family"
                />
              </View>
            </View>

            <FormInput
              label="Email *"
              value={email}
              onChange={t => {
                setEmail(t);
                setErrors(p => ({ ...p, email: '' }));
              }}
              error={errors.email}
              keyboard="email-address"
              maxLength={254}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="email"
            />

            <FormInput
              label="Mobile number *"
              value={mobile}
              onChange={t => {
                const next = String(t ?? '')
                  .replace(/[^\d]/g, '')
                  .slice(0, 10);
                setMobile(next);
                setErrors(p => ({ ...p, mobile: '' }));
              }}
              error={errors.mobile}
              keyboard="phone-pad"
              maxLength={10}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="telephoneNumber"
              autoComplete="tel"
            />

            <FormInput
              label="Address (optional)"
              value={address}
              onChange={t => setAddress(t)}
              maxLength={120}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="fullStreetAddress"
            />

            <View style={styles.twoColRow}>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Password *"
                  value={password}
                  onChange={t => {
                    setPassword(t);
                    setErrors(p => ({ ...p, password: '' }));
                  }}
                  error={errors.password}
                  maxLength={64}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormInput
                  label="Confirm *"
                  value={confirmPassword}
                  onChange={t => {
                    setConfirmPassword(t);
                    setErrors(p => ({ ...p, confirmPassword: '' }));
                  }}
                  error={errors.confirmPassword}
                  secureTextEntry
                  maxLength={64}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="password-new"
                />
              </View>
            </View>

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
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                style={styles.primaryButton}
                contentStyle={styles.buttonContent}
              >
                Register
              </Button>
            </View>
          </Surface>
        </ScrollView>
      </View>
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

  hero: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontWeight: '900', fontSize: 16 },
  heroSub: { marginTop: 2, fontWeight: '800', fontSize: 13 },

  card: {
    marginTop: 14,
    borderRadius: 16,
    padding: 14,
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
  sectionTitle: { fontWeight: '900', fontSize: 16 },

  twoColRow: { flexDirection: 'row', gap: 12 },

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
